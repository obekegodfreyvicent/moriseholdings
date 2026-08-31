import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConflictAppException, NotFoundAppException } from '../common/app-exception';
import { AuthenticatedUser } from '../common/strategies/jwt.strategy';
import { hasGroupVisibility, isCompanyInScope } from '../common/scope.util';
import { AuditService } from '../common/audit/audit.service';
import { NotificationsService } from '../common/notifications/notifications.service';
import { computePay } from './uganda-statutory.util';
import { CreatePayrollRunDto, RejectDto, RequestSalaryAdvanceDto } from './dto/payroll.dto';

const GROUP_PERM = 'payroll.viewAll';
const MONTHS = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function runResource(r: any) {
  return {
    id: r.id,
    companyId: r.companyId,
    periodYear: r.periodYear,
    periodMonth: r.periodMonth,
    periodLabel: `${MONTHS[r.periodMonth]} ${r.periodYear}`,
    status: r.status,
    totalGross: r.totalGross?.toString() ?? '0',
    totalPaye: r.totalPaye?.toString() ?? '0',
    totalNssfEmployee: r.totalNssfEmployee?.toString() ?? '0',
    totalNssfEmployer: r.totalNssfEmployer?.toString() ?? '0',
    totalAdvances: r.totalAdvances?.toString() ?? '0',
    totalNet: r.totalNet?.toString() ?? '0',
    employeeCount: r.employeeCount,
    approvedAt: r.approvedAt,
    paidAt: r.paidAt,
    journalEntryId: r.journalEntryId,
    createdAt: r.createdAt,
    payslips: Array.isArray(r.payslips)
      ? r.payslips.map((p: any) => ({
          id: p.id,
          employeeId: p.employeeId,
          employeeName: p.employeeName,
          grossSalary: p.grossSalary.toString(),
          paye: p.paye.toString(),
          nssfEmployee: p.nssfEmployee.toString(),
          nssfEmployer: p.nssfEmployer.toString(),
          advanceRecovery: p.advanceRecovery.toString(),
          otherDeductions: p.otherDeductions.toString(),
          netPay: p.netPay.toString(),
        }))
      : undefined,
  };
}

function advanceResource(a: any) {
  return {
    id: a.id,
    companyId: a.companyId,
    employeeId: a.employeeId,
    employeeName: a.employeeName,
    amount: a.amount.toString(),
    reason: a.reason,
    installments: a.installments,
    amountRecovered: a.amountRecovered.toString(),
    outstanding: (Number(a.amount) - Number(a.amountRecovered)).toFixed(2),
    status: a.status,
    approvedAt: a.approvedAt,
    rejectionReason: a.rejectionReason,
    createdAt: a.createdAt,
  };
}

@Injectable()
export class PayrollService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  private companyFilter(user: AuthenticatedUser, companyId?: string) {
    if (hasGroupVisibility(user, GROUP_PERM)) return companyId ? { companyId } : {};
    const ids = user.scopes.map((s) => s.companyId);
    return { companyId: companyId && ids.includes(companyId) ? companyId : { in: ids.length ? ids : ['__none__'] } };
  }

  // -------------------------------- runs --------------------------------

  async listRuns(user: AuthenticatedUser, companyId?: string) {
    const rows = await this.prisma.payrollRun.findMany({
      where: this.companyFilter(user, companyId),
      orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }],
    });
    return rows.map(runResource);
  }

  async getRun(user: AuthenticatedUser, id: string) {
    const run = await this.prisma.payrollRun.findUnique({ where: { id }, include: { payslips: { orderBy: { employeeName: 'asc' } } } });
    if (!run || !isCompanyInScope(user, run.companyId, GROUP_PERM)) throw new NotFoundAppException('Payroll run not found.');
    return runResource(run);
  }

  async createRun(user: AuthenticatedUser, dto: CreatePayrollRunDto) {
    if (!isCompanyInScope(user, dto.companyId, GROUP_PERM)) throw new NotFoundAppException('Company not found.');

    const existing = await this.prisma.payrollRun.findFirst({
      where: { companyId: dto.companyId, periodYear: dto.periodYear, periodMonth: dto.periodMonth },
    });
    if (existing) {
      throw new ConflictAppException(`A payroll run for ${MONTHS[dto.periodMonth]} ${dto.periodYear} already exists (${existing.status}).`);
    }

    const employees = await this.prisma.employee.findMany({
      where: { companyId: dto.companyId, status: 'active', grossSalary: { not: null } },
      select: { id: true, firstName: true, lastName: true, grossSalary: true },
    });
    if (employees.length === 0) {
      throw new ConflictAppException('No active employees in this company have a gross salary set — nothing to run.');
    }

    // Active salary advances, oldest first, so a run can plan an instalment.
    const advances = await this.prisma.salaryAdvance.findMany({
      where: { companyId: dto.companyId, status: { in: ['approved', 'recovering'] } },
      orderBy: { createdAt: 'asc' },
    });
    const advancesByEmployee = new Map<string, typeof advances>();
    for (const a of advances) {
      const list = advancesByEmployee.get(a.employeeId) ?? [];
      list.push(a);
      advancesByEmployee.set(a.employeeId, list);
    }

    const payslipData: any[] = [];
    const totals = { gross: 0, paye: 0, nssfEmp: 0, nssfEmployer: 0, advances: 0, net: 0 };
    for (const e of employees) {
      const gross = Number(e.grossSalary);
      // Plan this month's advance recovery: one instalment per active advance,
      // never more than what is still outstanding.
      let plannedRecovery = 0;
      for (const a of advancesByEmployee.get(e.id) ?? []) {
        const outstanding = Number(a.amount) - Number(a.amountRecovered);
        const instalment = Math.min(outstanding, Math.ceil(Number(a.amount) / a.installments));
        plannedRecovery += Math.max(0, instalment);
      }
      // Never push net below zero.
      const base = computePay(gross);
      const maxRecoverable = Math.max(0, base.gross - base.paye - base.nssfEmployee);
      const advanceRecovery = Math.min(plannedRecovery, maxRecoverable);
      const pay = computePay(gross, { advanceRecovery });

      payslipData.push({
        employeeId: e.id,
        employeeName: `${e.firstName} ${e.lastName}`,
        grossSalary: pay.gross,
        paye: pay.paye,
        nssfEmployee: pay.nssfEmployee,
        nssfEmployer: pay.nssfEmployer,
        advanceRecovery: pay.advanceRecovery,
        otherDeductions: 0,
        netPay: pay.net,
      });
      totals.gross += pay.gross;
      totals.paye += pay.paye;
      totals.nssfEmp += pay.nssfEmployee;
      totals.nssfEmployer += pay.nssfEmployer;
      totals.advances += pay.advanceRecovery;
      totals.net += pay.net;
    }

    const run = await this.prisma.payrollRun.create({
      data: {
        companyId: dto.companyId,
        periodYear: dto.periodYear,
        periodMonth: dto.periodMonth,
        status: 'draft',
        totalGross: totals.gross,
        totalPaye: totals.paye,
        totalNssfEmployee: totals.nssfEmp,
        totalNssfEmployer: totals.nssfEmployer,
        totalAdvances: totals.advances,
        totalNet: totals.net,
        employeeCount: employees.length,
        createdBy: user.id,
        payslips: { create: payslipData },
      },
      include: { payslips: { orderBy: { employeeName: 'asc' } } },
    });
    await this.audit(user, 'payroll.run.created', dto.companyId, run.id, null, {
      period: runResource(run).periodLabel,
      employeeCount: run.employeeCount,
      totalNet: run.totalNet.toString(),
    });
    return runResource(run);
  }

  async approveRun(user: AuthenticatedUser, id: string) {
    const run = await this.prisma.payrollRun.findUnique({ where: { id } });
    if (!run || !isCompanyInScope(user, run.companyId, GROUP_PERM)) throw new NotFoundAppException('Payroll run not found.');
    if (run.status !== 'draft') throw new ConflictAppException(`This run is already ${run.status}.`);
    const updated = await this.prisma.payrollRun.update({
      where: { id },
      data: { status: 'approved', approvedBy: user.id, approvedAt: new Date() },
      include: { payslips: { orderBy: { employeeName: 'asc' } } },
    });
    await this.audit(user, 'payroll.run.approved', run.companyId, id, { status: 'draft' }, { status: 'approved' });
    return runResource(updated);
  }

  async payRun(user: AuthenticatedUser, id: string) {
    const run = await this.prisma.payrollRun.findUnique({ where: { id }, include: { payslips: true } });
    if (!run || !isCompanyInScope(user, run.companyId, GROUP_PERM)) throw new NotFoundAppException('Payroll run not found.');
    if (run.status !== 'approved') throw new ConflictAppException(`A run must be approved before it can be paid (this one is ${run.status}).`);

    const period = await this.prisma.financialPeriod.findFirst({
      where: { companyId: run.companyId, status: 'open' },
      orderBy: { startDate: 'desc' },
    });
    if (!period) throw new ConflictAppException('This company has no open financial period — contact Finance.');

    const gross = Number(run.totalGross);
    const paye = Number(run.totalPaye);
    const nssfEmp = Number(run.totalNssfEmployee);
    const nssfEmployer = Number(run.totalNssfEmployer);
    const advances = Number(run.totalAdvances);
    const net = Number(run.totalNet);

    const [expenseAcct, payePayable, nssfPayable, staffAdvances, salariesPayable] = await Promise.all([
      this.ensureAccount(run.companyId, '6200', 'Salaries and Wages', 'expense'),
      this.ensureAccount(run.companyId, '2210', 'PAYE Payable', 'liability'),
      this.ensureAccount(run.companyId, '2220', 'NSSF Payable', 'liability'),
      this.ensureAccount(run.companyId, '1310', 'Staff Advances', 'asset'),
      this.ensureAccount(run.companyId, '2200', 'Salaries Payable', 'liability'),
    ]);

    const entryCount = await this.prisma.journalEntry.count({ where: { companyId: run.companyId } });
    const entryNumber = `PAY-${run.periodYear}-${String(entryCount + 1).padStart(4, '0')}`;
    const label = `${MONTHS[run.periodMonth]} ${run.periodYear}`;

    const items = [
      { accountId: expenseAcct.id, debitAmount: gross + nssfEmployer, creditAmount: 0, description: `Staff costs — payroll ${label}` },
      { accountId: payePayable.id, debitAmount: 0, creditAmount: paye, description: `PAYE withheld — ${label}` },
      { accountId: nssfPayable.id, debitAmount: 0, creditAmount: nssfEmp + nssfEmployer, description: `NSSF payable — ${label}` },
      ...(advances > 0
        ? [{ accountId: staffAdvances.id, debitAmount: 0, creditAmount: advances, description: `Salary advance recovery — ${label}` }]
        : []),
      { accountId: salariesPayable.id, debitAmount: 0, creditAmount: net, description: `Net pay — ${label}` },
    ];

    const paidAt = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      const entry = await tx.journalEntry.create({
        data: {
          companyId: run.companyId,
          entryNumber,
          entryDate: paidAt,
          description: `Payroll ${label}`,
          financialPeriodId: period.id,
          status: 'posted',
          createdBy: user.id,
          postedAt: paidAt,
          items: { create: items },
        },
      });

      // Advance each employee's active advances by their payslip recovery amount.
      for (const slip of run.payslips) {
        let remaining = Number(slip.advanceRecovery);
        if (remaining <= 0) continue;
        const empAdvances = await tx.salaryAdvance.findMany({
          where: { companyId: run.companyId, employeeId: slip.employeeId, status: { in: ['approved', 'recovering'] } },
          orderBy: { createdAt: 'asc' },
        });
        for (const a of empAdvances) {
          if (remaining <= 0) break;
          const outstanding = Number(a.amount) - Number(a.amountRecovered);
          const take = Math.min(outstanding, remaining);
          const newRecovered = Number(a.amountRecovered) + take;
          await tx.salaryAdvance.update({
            where: { id: a.id },
            data: {
              amountRecovered: newRecovered,
              status: newRecovered >= Number(a.amount) ? 'recovered' : 'recovering',
            },
          });
          remaining -= take;
        }
      }

      return tx.payrollRun.update({
        where: { id },
        data: { status: 'paid', paidAt, journalEntryId: entry.id },
        include: { payslips: { orderBy: { employeeName: 'asc' } } },
      });
    });

    await this.audit(user, 'payroll.run.paid', run.companyId, id, { status: 'approved' }, { status: 'paid', journalEntry: entryNumber, totalNet: net.toFixed(2) });

    // Notify each employee with a login that their payslip is available.
    const emps = await this.prisma.employee.findMany({
      where: { id: { in: run.payslips.map((p) => p.employeeId) }, userId: { not: null } },
      select: { id: true, userId: true },
    });
    for (const e of emps) {
      await this.notifications.notifyUsers([e.userId as string], {
        companyId: run.companyId,
        type: 'payroll.payslip_available',
        title: `Your payslip for ${label} is available.`,
        entityType: 'payroll_run',
        entityId: id,
      });
    }

    return runResource(updated);
  }

  async cancelRun(user: AuthenticatedUser, id: string) {
    const run = await this.prisma.payrollRun.findUnique({ where: { id } });
    if (!run || !isCompanyInScope(user, run.companyId, GROUP_PERM)) throw new NotFoundAppException('Payroll run not found.');
    if (run.status === 'paid') throw new ConflictAppException('A paid run cannot be cancelled.');
    await this.prisma.$transaction([
      this.prisma.payslip.deleteMany({ where: { payrollRunId: id } }),
      this.prisma.payrollRun.update({ where: { id }, data: { status: 'cancelled' } }),
    ]);
    await this.audit(user, 'payroll.run.cancelled', run.companyId, id, { status: run.status }, { status: 'cancelled' });
    return { cancelled: true };
  }

  // --------------------------- salary advances ---------------------------

  async listAdvances(user: AuthenticatedUser, filters: { companyId?: string; employeeId?: string }) {
    const where: any = { ...this.companyFilter(user, filters.companyId) };
    if (filters.employeeId) where.employeeId = filters.employeeId;
    const rows = await this.prisma.salaryAdvance.findMany({ where, orderBy: { createdAt: 'desc' } });
    return rows.map(advanceResource);
  }

  async requestAdvance(user: AuthenticatedUser, dto: RequestSalaryAdvanceDto) {
    if (!isCompanyInScope(user, dto.companyId, GROUP_PERM)) throw new NotFoundAppException('Company not found.');
    const employee = await this.prisma.employee.findUnique({ where: { id: dto.employeeId } });
    if (!employee || employee.companyId !== dto.companyId) throw new NotFoundAppException('Employee not found in this company.');
    if (Number(dto.amount) <= 0) throw new ConflictAppException('The advance amount must be greater than zero.');

    const created = await this.prisma.salaryAdvance.create({
      data: {
        companyId: dto.companyId,
        employeeId: dto.employeeId,
        employeeName: `${employee.firstName} ${employee.lastName}`,
        amount: dto.amount,
        reason: dto.reason ?? null,
        installments: dto.installments,
        requestedBy: user.id,
      },
    });
    await this.audit(user, 'payroll.salary_advance.requested', dto.companyId, created.id, null, advanceResource(created));
    return advanceResource(created);
  }

  async approveAdvance(user: AuthenticatedUser, id: string) {
    const a = await this.prisma.salaryAdvance.findUnique({ where: { id } });
    if (!a || !isCompanyInScope(user, a.companyId, GROUP_PERM)) throw new NotFoundAppException('Salary advance not found.');
    if (a.status !== 'requested') throw new ConflictAppException(`This advance is already ${a.status}.`);
    const updated = await this.prisma.salaryAdvance.update({
      where: { id },
      data: { status: 'approved', approvedBy: user.id, approvedAt: new Date() },
    });
    await this.audit(user, 'payroll.salary_advance.approved', a.companyId, id, { status: 'requested' }, { status: 'approved' });
    return advanceResource(updated);
  }

  async rejectAdvance(user: AuthenticatedUser, id: string, dto: RejectDto) {
    const a = await this.prisma.salaryAdvance.findUnique({ where: { id } });
    if (!a || !isCompanyInScope(user, a.companyId, GROUP_PERM)) throw new NotFoundAppException('Salary advance not found.');
    if (a.status !== 'requested') throw new ConflictAppException(`This advance is already ${a.status}.`);
    const updated = await this.prisma.salaryAdvance.update({
      where: { id },
      data: { status: 'rejected', rejectionReason: dto.reason ?? null },
    });
    await this.audit(user, 'payroll.salary_advance.rejected', a.companyId, id, { status: 'requested' }, { status: 'rejected' });
    return advanceResource(updated);
  }

  // ------------------------------- helpers -------------------------------

  private async ensureAccount(companyId: string, code: string, name: string, type: 'expense' | 'liability' | 'asset') {
    const existing = await this.prisma.account.findFirst({
      where: { companyId, OR: [{ accountName: name }, { accountCode: code }] },
    });
    if (existing) return existing;
    try {
      return await this.prisma.account.create({
        data: { companyId, accountCode: code, accountName: name, accountType: type as any, isActive: true },
      });
    } catch {
      // account_code collided with an unrelated account — fall back to a
      // payroll-suffixed code.
      return this.prisma.account.create({
        data: { companyId, accountCode: `${code}-PR`, accountName: name, accountType: type as any, isActive: true },
      });
    }
  }

  private audit(
    user: AuthenticatedUser,
    eventType: string,
    companyId: string,
    entityId: string,
    previousValue: unknown,
    newValue: unknown,
  ) {
    return this.auditService.record({
      eventType,
      sourceService: 'payroll-service',
      userId: user.id,
      companyId,
      entityType: eventType.split('.')[1],
      entityId,
      action: eventType.endsWith('created') || eventType.endsWith('requested') ? 'create' : eventType.endsWith('approved') || eventType.endsWith('paid') ? 'approve' : 'update',
      previousValue,
      newValue,
    });
  }
}
