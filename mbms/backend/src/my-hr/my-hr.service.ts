import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConflictAppException, NotFoundAppException } from '../common/app-exception';
import { AuthenticatedUser } from '../common/strategies/jwt.strategy';
import { AuditService } from '../common/audit/audit.service';
import { RequestMyAdvanceDto } from './dto/my-hr.dto';

// My HR (28 August 2026) — employee self-service. Every read is scoped to the
// Employee record linked to the caller's user (Employee.userId); a caller
// with no linked record gets `{ linked: false }` from `summary` and a 404
// from the detail endpoints. The self-service *actions* (clock in/out, apply
// for leave, submit a self-assessment) already exist un-gated on their own
// modules and the front end calls those directly; only "request a salary
// advance for myself" needs a new, permission-free endpoint here because the
// staff one requires payroll.manage.

const MONTHS = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

@Injectable()
export class MyHrService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  private me(user: AuthenticatedUser) {
    return this.prisma.employee.findFirst({ where: { userId: user.id } });
  }

  private async needMe(user: AuthenticatedUser) {
    const e = await this.me(user);
    if (!e) throw new NotFoundAppException('Your account is not linked to an employee record. Ask HR to link it.');
    return e;
  }

  async summary(user: AuthenticatedUser) {
    const e = await this.me(user);
    if (!e) return { linked: false };
    const [dept, company, shift] = await Promise.all([
      e.departmentId ? this.prisma.department.findUnique({ where: { id: e.departmentId } }) : null,
      this.prisma.company.findUnique({ where: { id: e.companyId } }),
      e.shiftId ? this.prisma.shift.findUnique({ where: { id: e.shiftId } }) : null,
    ]);
    return {
      linked: true,
      employee: {
        id: e.id,
        name: `${e.firstName} ${e.lastName}`,
        employeeNumber: e.employeeNumber,
        jobTitle: e.jobTitle,
        departmentName: dept?.name ?? null,
        companyName: company?.name ?? null,
        employmentStartDate: e.employmentStartDate,
        contractType: e.contractType,
        grossSalary: e.grossSalary?.toString() ?? null,
        shift: shift ? { name: shift.name, startTime: shift.startTime, endTime: shift.endTime } : null,
      },
    };
  }

  async attendance(user: AuthenticatedUser, from?: string, to?: string) {
    const e = await this.needMe(user);
    const where: any = { employeeId: e.id };
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = new Date(from);
      if (to) where.date.lte = new Date(to);
    }
    const records = await this.prisma.attendanceRecord.findMany({ where, orderBy: { date: 'desc' }, take: 90 });
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const todayRec = await this.prisma.attendanceRecord.findUnique({
      where: { employeeId_date: { employeeId: e.id, date: today } },
    });
    const last30 = records.filter((r) => r.date >= new Date(Date.now() - 30 * 86_400_000));
    return {
      today: todayRec
        ? { status: todayRec.status, clockInTime: todayRec.clockInTime, clockOutTime: todayRec.clockOutTime, lateMinutes: todayRec.lateMinutes }
        : null,
      last30: {
        present: last30.filter((r) => r.status === 'present').length,
        late: last30.filter((r) => r.status === 'late').length,
        absent: last30.filter((r) => r.status === 'absent').length,
        halfDay: last30.filter((r) => r.status === 'half_day').length,
      },
      records: records.map((r) => ({
        id: r.id,
        date: r.date,
        status: r.status,
        clockInTime: r.clockInTime,
        clockOutTime: r.clockOutTime,
        lateMinutes: r.lateMinutes,
        overtimeMinutes: r.overtimeMinutes,
      })),
    };
  }

  async leave(user: AuthenticatedUser) {
    const e = await this.needMe(user);
    const year = new Date().getFullYear();
    const [balances, applications] = await Promise.all([
      this.prisma.leaveBalance.findMany({ where: { employeeId: e.id, year }, orderBy: { leaveType: 'asc' } }),
      this.prisma.leaveApplication.findMany({ where: { employeeId: e.id }, orderBy: { createdAt: 'desc' }, take: 50 }),
    ]);
    return {
      year,
      leaveTypes: ['annual', 'sick', 'maternity', 'paternity', 'emergency'],
      balances: balances.map((b) => ({
        leaveType: b.leaveType,
        entitledDays: b.entitledDays,
        usedDays: b.usedDays,
        remainingDays: b.entitledDays - b.usedDays,
      })),
      applications: applications.map((a) => ({
        id: a.id,
        leaveType: a.leaveType,
        startDate: a.startDate,
        endDate: a.endDate,
        daysRequested: a.daysRequested,
        reason: a.reason,
        status: a.status,
        rejectionReason: a.rejectionReason,
        createdAt: a.createdAt,
      })),
    };
  }

  async shifts(user: AuthenticatedUser, from?: string, to?: string) {
    const e = await this.needMe(user);
    const where: any = { employeeId: e.id };
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = new Date(from);
      if (to) where.date.lte = new Date(to);
    } else {
      where.date = { gte: new Date(Date.now() - 7 * 86_400_000) };
    }
    const rows = await this.prisma.rosterEntry.findMany({
      where,
      include: { shift: { select: { name: true, startTime: true, endTime: true } } },
      orderBy: { date: 'asc' },
      take: 120,
    });
    return rows.map((r) => ({
      id: r.id,
      date: r.date,
      status: r.status,
      shiftName: r.shift?.name ?? null,
      shiftStart: r.shift?.startTime ?? null,
      shiftEnd: r.shift?.endTime ?? null,
      note: r.note,
    }));
  }

  async performance(user: AuthenticatedUser) {
    const e = await this.needMe(user);
    const [reviews, objectives] = await Promise.all([
      this.prisma.performanceReview.findMany({
        where: { employeeId: e.id },
        include: { cycle: { select: { name: true, startDate: true, endDate: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.performanceObjective.findMany({ where: { employeeId: e.id }, orderBy: { createdAt: 'desc' } }),
    ]);
    return {
      reviews: reviews.map((r) => ({
        id: r.id,
        cycleName: (r as any).cycle?.name ?? null,
        status: r.status,
        selfAssessment: r.selfAssessment,
        selfAssessmentAt: r.selfAssessmentAt,
        managerAssessment: r.status === 'completed' ? r.managerAssessment : null,
        managerRating: r.status === 'completed' ? r.managerRating : null,
        promotionRecommended: r.status === 'completed' ? r.promotionRecommended : null,
        trainingRecommendation: r.status === 'completed' ? r.trainingRecommendation : null,
        completedAt: r.completedAt,
      })),
      objectives: objectives.map((o) => ({
        id: o.id,
        title: o.title,
        description: o.description,
        weight: o.weight,
        targetValue: o.targetValue,
        status: o.status,
      })),
    };
  }

  async payslips(user: AuthenticatedUser) {
    const e = await this.needMe(user);
    const rows = await this.prisma.payslip.findMany({
      where: { employeeId: e.id, payrollRun: { status: 'paid' } },
      include: { payrollRun: { select: { periodYear: true, periodMonth: true, paidAt: true } } },
      orderBy: [{ payrollRun: { periodYear: 'desc' } }, { payrollRun: { periodMonth: 'desc' } }],
    });
    return rows.map((p) => ({
      id: p.id,
      periodLabel: `${MONTHS[(p as any).payrollRun.periodMonth]} ${(p as any).payrollRun.periodYear}`,
      paidAt: (p as any).payrollRun.paidAt,
      grossSalary: p.grossSalary.toString(),
      paye: p.paye.toString(),
      nssfEmployee: p.nssfEmployee.toString(),
      nssfEmployer: p.nssfEmployer.toString(),
      advanceRecovery: p.advanceRecovery.toString(),
      otherDeductions: p.otherDeductions.toString(),
      netPay: p.netPay.toString(),
    }));
  }

  async salaryAdvances(user: AuthenticatedUser) {
    const e = await this.needMe(user);
    const rows = await this.prisma.salaryAdvance.findMany({ where: { employeeId: e.id }, orderBy: { createdAt: 'desc' } });
    return rows.map((a) => ({
      id: a.id,
      amount: a.amount.toString(),
      reason: a.reason,
      installments: a.installments,
      amountRecovered: a.amountRecovered.toString(),
      outstanding: (Number(a.amount) - Number(a.amountRecovered)).toFixed(2),
      status: a.status,
      rejectionReason: a.rejectionReason,
      createdAt: a.createdAt,
    }));
  }

  async requestSalaryAdvance(user: AuthenticatedUser, dto: RequestMyAdvanceDto) {
    const e = await this.needMe(user);
    if (Number(dto.amount) <= 0) throw new ConflictAppException('The amount must be greater than zero.');
    const open = await this.prisma.salaryAdvance.findFirst({
      where: { employeeId: e.id, status: { in: ['requested', 'approved', 'recovering'] } },
    });
    if (open) {
      throw new ConflictAppException('You already have a salary advance in progress. It must be fully recovered before you can request another.');
    }
    const created = await this.prisma.salaryAdvance.create({
      data: {
        companyId: e.companyId,
        employeeId: e.id,
        employeeName: `${e.firstName} ${e.lastName}`,
        amount: dto.amount,
        reason: dto.reason ?? null,
        installments: dto.installments,
        requestedBy: user.id,
      },
    });
    await this.auditService.record({
      eventType: 'payroll.salary_advance.requested',
      sourceService: 'my-hr-service',
      userId: user.id,
      companyId: e.companyId,
      entityType: 'salary_advance',
      entityId: created.id,
      action: 'create',
      newValue: { amount: dto.amount, installments: dto.installments, selfService: true },
    });
    return {
      id: created.id,
      amount: created.amount.toString(),
      installments: created.installments,
      status: created.status,
    };
  }
}
