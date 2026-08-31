import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConflictAppException, ForbiddenAppException, NotFoundAppException } from '../common/app-exception';
import { Paginated } from '../common/interceptors/response.interceptor';
import { AuthenticatedUser } from '../common/strategies/jwt.strategy';
import { hasGroupVisibility, isCompanyInScope } from '../common/scope.util';
import { CreateExpenseDto, PayExpenseDto, RejectExpenseDto } from './dto/expense.dto';
import { AuditService } from '../common/audit/audit.service';
import { NotificationsService } from '../common/notifications/notifications.service';

const GROUP_PERM = 'expense.viewAll';
const MANAGER_APPROVE_PERM = 'expense.approve.manager';
const FINANCE_APPROVE_PERM = 'expense.approve.finance';

function toResource(e: any) {
  return {
    id: e.id,
    companyId: e.companyId,
    branchId: e.branchId,
    departmentId: e.departmentId,
    projectId: e.projectId,
    submittedBy: e.submittedBy,
    category: e.category,
    description: e.description,
    amount: e.amount.toString(),
    currency: e.currency,
    expenseDate: e.expenseDate,
    receiptReference: e.receiptReference,
    expenseAccountId: e.expenseAccountId,
    status: e.status,
    managerApprovedBy: e.managerApprovedBy,
    managerApprovedAt: e.managerApprovedAt,
    financeApprovedBy: e.financeApprovedBy,
    financeApprovedAt: e.financeApprovedAt,
    rejectedBy: e.rejectedBy,
    rejectedAt: e.rejectedAt,
    rejectionReason: e.rejectionReason,
    paidBy: e.paidBy,
    paidAt: e.paidAt,
    journalEntryId: e.journalEntryId,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
  };
}

@Injectable()
export class ExpensesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
  ) {}

  // GET /expenses — scoped per BR-01; unless the caller holds
  // expense.viewAll, they see only their own submitted claims plus claims
  // currently awaiting whichever approval step their permissions cover, not
  // every claim in their company scope. This is narrower than every other
  // module's default list view (Customers/Suppliers/etc. show the full
  // in-scope list to any authenticated scoped user) — a deliberate
  // difference: expense claims carry another employee's spending detail, not
  // shared master data, so "your own + pending your action" is the correct
  // default rather than a company-wide feed.
  async list(
    user: AuthenticatedUser,
    page: number,
    pageSize: number,
    filters: { companyId?: string; status?: string },
  ): Promise<Paginated<unknown>> {
    const where: any = {};
    if (filters.status) where.status = filters.status;

    if (hasGroupVisibility(user, GROUP_PERM)) {
      if (filters.companyId) where.companyId = filters.companyId;
    } else {
      const scopedCompanyIds = user.scopes.map((s) => s.companyId);
      where.companyId =
        filters.companyId && scopedCompanyIds.includes(filters.companyId)
          ? filters.companyId
          : { in: scopedCompanyIds.length > 0 ? scopedCompanyIds : ['__none__'] };

      const canApproveManager = user.permissions.includes(MANAGER_APPROVE_PERM);
      const canApproveFinance = user.permissions.includes(FINANCE_APPROVE_PERM);
      const or: any[] = [{ submittedBy: user.id }];
      if (canApproveManager) or.push({ status: 'submitted' });
      // finance_approved is included too, not just manager_approved: pay()
      // is also this permission holder's action, and a claim they already
      // finance-approved must stay findable afterward or they'd have no way
      // to locate it again to pay it.
      if (canApproveFinance) or.push({ status: { in: ['manager_approved', 'finance_approved'] } });
      where.OR = or;
    }

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.expense.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.expense.count({ where }),
    ]);
    return { items: rows.map(toResource), page, pageSize, total };
  }

  // POST /expenses — FR-EXP-01: any authenticated user in scope can submit a
  // claim for themselves (self-service, per 01_Project Proposal/
  // 02_Project Charter's "end users of self-service functions ... expense
  // claims"), gated only by expense.create so Auditor's read-only role
  // doesn't pick this up too.
  async create(user: AuthenticatedUser, dto: CreateExpenseDto) {
    if (!isCompanyInScope(user, dto.companyId)) {
      throw new NotFoundAppException('Company not found.');
    }
    const account = await this.prisma.account.findUnique({ where: { id: dto.expenseAccountId } });
    if (!account || account.companyId !== dto.companyId || account.accountType !== 'expense') {
      throw new NotFoundAppException('Expense account not found for this company.');
    }
    if (dto.projectId) {
      const project = await this.prisma.project.findUnique({ where: { id: dto.projectId } });
      if (!project || project.companyId !== dto.companyId) {
        throw new NotFoundAppException('Project not found for this company.');
      }
    }

    const expense = await this.prisma.expense.create({
      data: {
        companyId: dto.companyId,
        branchId: dto.branchId,
        departmentId: dto.departmentId,
        projectId: dto.projectId,
        submittedBy: user.id,
        category: dto.category,
        description: dto.description,
        amount: dto.amount,
        currency: dto.currency,
        expenseDate: new Date(dto.expenseDate),
        receiptReference: dto.receiptReference,
        expenseAccountId: dto.expenseAccountId,
      },
    });
    await this.auditService.record({
      eventType: 'expense.claim.submitted',
      sourceService: 'expense-service',
      userId: user.id,
      companyId: expense.companyId,
      entityType: 'expense',
      entityId: expense.id,
      action: 'create',
      newValue: { amount: expense.amount.toString(), currency: expense.currency, category: expense.category },
    });
    const managerIds = await this.notificationsService.findUsersWithPermissionInCompany(expense.companyId, MANAGER_APPROVE_PERM);
    await this.notificationsService.notifyUsers(managerIds, {
      companyId: expense.companyId,
      type: 'expense.approval_needed',
      title: `Expense claim awaiting your approval — ${expense.category ?? 'Expense'} (${expense.currency} ${expense.amount})`,
      entityType: 'expense',
      entityId: expense.id,
    });
    return toResource(expense);
  }

  // GET /expenses/{id}
  async get(user: AuthenticatedUser, id: string) {
    const expense = await this.findOrThrow(id);
    this.assertVisible(user, expense);
    return toResource(expense);
  }

  // POST /expenses/{id}/approve — state-aware: advances submitted ->
  // manager_approved (requires expense.approve.manager) or manager_approved
  // -> finance_approved (requires expense.approve.finance). No static
  // @RequirePermission on the controller route for this one, since which
  // permission is required depends on the claim's current status.
  async approve(user: AuthenticatedUser, id: string) {
    const expense = await this.findOrThrow(id);
    if (!isCompanyInScope(user, expense.companyId, GROUP_PERM)) {
      throw new NotFoundAppException('Expense claim not found.');
    }

    if (expense.status === 'submitted') {
      this.requirePermission(user, MANAGER_APPROVE_PERM);
      const updated = await this.prisma.expense.update({
        where: { id },
        data: { status: 'manager_approved', managerApprovedBy: user.id, managerApprovedAt: new Date() },
      });
      await this.recordApproval(user, updated, 'expense.claim.manager_approved', 'submitted');
      const financeIds = await this.notificationsService.findUsersWithPermissionInCompany(updated.companyId, FINANCE_APPROVE_PERM);
      await this.notificationsService.notifyUsers(financeIds, {
        companyId: updated.companyId,
        type: 'expense.approval_needed',
        title: `Expense claim awaiting finance approval — ${updated.category ?? 'Expense'} (${updated.currency} ${updated.amount})`,
        entityType: 'expense',
        entityId: updated.id,
      });
      return toResource(updated);
    }

    if (expense.status === 'manager_approved') {
      this.requirePermission(user, FINANCE_APPROVE_PERM);
      const updated = await this.prisma.expense.update({
        where: { id },
        data: { status: 'finance_approved', financeApprovedBy: user.id, financeApprovedAt: new Date() },
      });
      await this.recordApproval(user, updated, 'expense.claim.finance_approved', 'manager_approved');
      await this.notificationsService.notifyUsers([updated.submittedBy], {
        companyId: updated.companyId,
        type: 'expense.finance_approved',
        title: `Your expense claim was finance-approved — ${updated.category ?? 'Expense'} (${updated.currency} ${updated.amount})`,
        entityType: 'expense',
        entityId: updated.id,
      });
      return toResource(updated);
    }

    throw new ConflictAppException(`Cannot approve a claim with status "${expense.status}".`);
  }

  // POST /expenses/{id}/reject — same dual-stage permission logic as
  // approve(): whoever can approve the claim's current stage can also
  // reject it there.
  async reject(user: AuthenticatedUser, id: string, dto: RejectExpenseDto) {
    const expense = await this.findOrThrow(id);
    if (!isCompanyInScope(user, expense.companyId, GROUP_PERM)) {
      throw new NotFoundAppException('Expense claim not found.');
    }

    if (expense.status === 'submitted') {
      this.requirePermission(user, MANAGER_APPROVE_PERM);
    } else if (expense.status === 'manager_approved') {
      this.requirePermission(user, FINANCE_APPROVE_PERM);
    } else {
      throw new ConflictAppException(`Cannot reject a claim with status "${expense.status}".`);
    }

    const updated = await this.prisma.expense.update({
      where: { id },
      data: { status: 'rejected', rejectedBy: user.id, rejectedAt: new Date(), rejectionReason: dto.reason },
    });
    await this.auditService.record({
      eventType: 'expense.claim.rejected',
      sourceService: 'expense-service',
      userId: user.id,
      companyId: updated.companyId,
      entityType: 'expense',
      entityId: updated.id,
      action: 'update',
      previousValue: { status: expense.status },
      newValue: { status: 'rejected', reason: dto.reason },
    });
    return toResource(updated);
  }

  // POST /expenses/{id}/pay — FR-EXP-04/05: combines "Payment/
  // Reimbursement" and "Posted to Accounting" from the source workflow into
  // one step (this proof-of-concept has no separate disbursement
  // infrastructure, the same simplification already made elsewhere). Posts
  // a balanced two-line journal entry directly as "posted" — the claim has
  // already passed both approval gates by this point, so there is no
  // separate draft-review step the way a manually-entered journal entry
  // gets via BR-03.
  async pay(user: AuthenticatedUser, id: string, dto: PayExpenseDto) {
    const expense = await this.findOrThrow(id);
    if (!isCompanyInScope(user, expense.companyId, GROUP_PERM)) {
      throw new NotFoundAppException('Expense claim not found.');
    }
    this.requirePermission(user, FINANCE_APPROVE_PERM);

    if (expense.status !== 'finance_approved') {
      throw new ConflictAppException(`Cannot pay a claim with status "${expense.status}" — it must be finance-approved first.`);
    }

    const period = await this.prisma.financialPeriod.findUnique({ where: { id: dto.financialPeriodId } });
    if (!period || period.companyId !== expense.companyId) {
      throw new NotFoundAppException('Financial period not found for this company.');
    }
    if (period.status === 'closed') {
      throw new ConflictAppException(`Cannot post into "${period.periodName}" — this financial period is closed.`);
    }
    const paymentAccount = await this.prisma.account.findUnique({ where: { id: dto.paymentAccountId } });
    if (!paymentAccount || paymentAccount.companyId !== expense.companyId) {
      throw new NotFoundAppException('Payment account not found for this company.');
    }

    const entryCount = await this.prisma.journalEntry.count({ where: { companyId: expense.companyId } });
    const entryNumber = `JE-${new Date().getFullYear()}-${String(entryCount + 1).padStart(4, '0')}`;

    const paid = await this.prisma.$transaction(async (tx) => {
      const journalEntry = await tx.journalEntry.create({
        data: {
          companyId: expense.companyId,
          entryNumber,
          entryDate: new Date(),
          description: `Expense claim ${expense.id} — ${expense.category ?? 'Expense'}`,
          financialPeriodId: dto.financialPeriodId,
          status: 'posted',
          createdBy: user.id,
          postedAt: new Date(),
          items: {
            create: [
              { accountId: expense.expenseAccountId, debitAmount: expense.amount, creditAmount: 0, description: 'Expense claim' },
              { accountId: dto.paymentAccountId, debitAmount: 0, creditAmount: expense.amount, description: 'Expense claim payment' },
            ],
          },
        },
      });
      return tx.expense.update({
        where: { id },
        data: { status: 'paid', paidBy: user.id, paidAt: new Date(), journalEntryId: journalEntry.id },
      });
    });

    await this.auditService.record({
      eventType: 'expense.claim.paid',
      sourceService: 'expense-service',
      userId: user.id,
      companyId: paid.companyId,
      entityType: 'expense',
      entityId: paid.id,
      action: 'approve',
      previousValue: { status: 'finance_approved' },
      newValue: { status: 'paid', journalEntryId: paid.journalEntryId, amount: paid.amount.toString() },
    });
    return toResource(paid);
  }

  private assertVisible(user: AuthenticatedUser, expense: any) {
    if (!isCompanyInScope(user, expense.companyId, GROUP_PERM)) {
      throw new NotFoundAppException('Expense claim not found.');
    }
    if (hasGroupVisibility(user, GROUP_PERM)) return;
    if (expense.submittedBy === user.id) return;
    if (expense.status === 'submitted' && user.permissions.includes(MANAGER_APPROVE_PERM)) return;
    if (
      (expense.status === 'manager_approved' || expense.status === 'finance_approved') &&
      user.permissions.includes(FINANCE_APPROVE_PERM)
    )
      return;
    throw new NotFoundAppException('Expense claim not found.');
  }

  private requirePermission(user: AuthenticatedUser, code: string) {
    if (!user.permissions.includes(code)) {
      throw new ForbiddenAppException(`Your role does not include the "${code}" permission required for this action.`);
    }
  }

  private async recordApproval(user: AuthenticatedUser, expense: any, eventType: string, previousStatus: string) {
    await this.auditService.record({
      eventType,
      sourceService: 'expense-service',
      userId: user.id,
      companyId: expense.companyId,
      entityType: 'expense',
      entityId: expense.id,
      action: 'approve',
      previousValue: { status: previousStatus },
      newValue: { status: expense.status },
    });
  }

  private async findOrThrow(id: string) {
    const expense = await this.prisma.expense.findUnique({ where: { id } });
    if (!expense) throw new NotFoundAppException('Expense claim not found.');
    return expense;
  }
}
