import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ConflictAppException, NotFoundAppException } from '../../common/app-exception';
import { AuthenticatedUser } from '../../common/strategies/jwt.strategy';
import { isCompanyInScope } from '../../common/scope.util';
import { AuditService } from '../../common/audit/audit.service';
import { CreateReconciliationDto } from './dto/reconciliation.dto';

const GROUP_PERM = 'accounting.viewAll';

// "Account reconciliation" (General Ledger bullet, 19 August 2026): ties
// one account's ledger balance, as of a date, to an external statement
// balance — most commonly a bank statement. Distinct from the trial
// balance's balanced/unbalanced flag, which only proves debits=credits
// system-wide, not that any one account matches reality outside the
// system.
@Injectable()
export class ReconciliationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async list(user: AuthenticatedUser, companyId: string, accountId?: string) {
    if (!isCompanyInScope(user, companyId, GROUP_PERM)) {
      throw new NotFoundAppException('Company not found.');
    }
    return this.prisma.accountReconciliation.findMany({
      where: { companyId, ...(accountId ? { accountId } : {}) },
      orderBy: { asOfDate: 'desc' },
    });
  }

  async create(user: AuthenticatedUser, dto: CreateReconciliationDto) {
    if (!isCompanyInScope(user, dto.companyId, GROUP_PERM)) {
      throw new NotFoundAppException('Company not found.');
    }
    const account = await this.prisma.account.findUnique({ where: { id: dto.accountId } });
    if (!account || account.companyId !== dto.companyId) {
      throw new NotFoundAppException('Account not found for this company.');
    }

    const asOfDate = new Date(dto.asOfDate);
    const items = await this.prisma.journalEntryItem.findMany({
      where: { accountId: dto.accountId, journalEntry: { companyId: dto.companyId, status: 'posted', entryDate: { lte: asOfDate } } },
    });
    const debitNormal = account.accountType === 'asset' || account.accountType === 'expense';
    let ledgerBalance = 0;
    for (const item of items) {
      const debit = Number(item.debitAmount);
      const credit = Number(item.creditAmount);
      ledgerBalance += debitNormal ? debit - credit : credit - debit;
    }
    const variance = dto.statementBalance - ledgerBalance;

    const row = await this.prisma.accountReconciliation.create({
      data: {
        companyId: dto.companyId,
        accountId: dto.accountId,
        asOfDate,
        statementBalance: dto.statementBalance,
        ledgerBalance,
        variance,
        notes: dto.notes,
        createdBy: user.id,
      },
    });
    await this.auditService.record({
      eventType: 'accounting.reconciliation.created',
      sourceService: 'accounting-service',
      userId: user.id,
      companyId: dto.companyId,
      entityType: 'account_reconciliation',
      entityId: row.id,
      action: 'create',
      newValue: { accountId: dto.accountId, variance: variance.toFixed(2) },
    });
    return row;
  }

  async reconcile(user: AuthenticatedUser, id: string) {
    const row = await this.prisma.accountReconciliation.findUnique({ where: { id } });
    if (!row || !isCompanyInScope(user, row.companyId, GROUP_PERM)) {
      throw new NotFoundAppException('Reconciliation not found.');
    }
    if (row.status === 'reconciled') {
      throw new ConflictAppException('This reconciliation is already marked reconciled.');
    }
    const updated = await this.prisma.accountReconciliation.update({
      where: { id },
      data: { status: 'reconciled', reconciledBy: user.id, reconciledAt: new Date() },
    });
    await this.auditService.record({
      eventType: 'accounting.reconciliation.completed',
      sourceService: 'accounting-service',
      userId: user.id,
      companyId: row.companyId,
      entityType: 'account_reconciliation',
      entityId: id,
      action: 'approve',
      newValue: { variance: row.variance.toString() },
    });
    return updated;
  }
}
