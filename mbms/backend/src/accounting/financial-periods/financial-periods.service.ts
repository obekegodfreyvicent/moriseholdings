import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundAppException } from '../../common/app-exception';
import { AuthenticatedUser } from '../../common/strategies/jwt.strategy';
import { isCompanyInScope } from '../../common/scope.util';
import { CloseFinancialPeriodDto, CreateFinancialPeriodDto } from './dto/financial-period.dto';
import { ConflictAppException } from '../../common/app-exception';
import { AuditService } from '../../common/audit/audit.service';

const GROUP_PERM = 'accounting.viewAll';

function toResource(p: any) {
  return {
    id: p.id,
    companyId: p.companyId,
    periodName: p.periodName,
    startDate: p.startDate,
    endDate: p.endDate,
    status: p.status,
    closedAt: p.closedAt,
    closedBy: p.closedBy,
  };
}

@Injectable()
export class FinancialPeriodsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  // GET /accounting/financial-periods?companyId=... — FR-ACC-05
  async list(user: AuthenticatedUser, companyId: string) {
    await this.assertScope(user, companyId);
    const rows = await this.prisma.financialPeriod.findMany({
      where: { companyId },
      orderBy: { startDate: 'desc' },
    });
    return rows.map(toResource);
  }

  // POST /accounting/financial-periods — FR-ACC-05
  async create(user: AuthenticatedUser, dto: CreateFinancialPeriodDto) {
    await this.assertScope(user, dto.companyId);
    const period = await this.prisma.financialPeriod.create({
      data: {
        companyId: dto.companyId,
        periodName: dto.periodName,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
      },
    });
    return toResource(period);
  }

  // POST /accounting/financial-periods/{id}/close — FR-ACC-05, BR-04.
  // Financial Module deepening (19 August 2026): if the caller provides
  // retainedEarningsAccountId, generates and posts a real closing journal
  // entry BEFORE marking the period closed (posting after would trip
  // BR-04's own period-closed guard) — one line per revenue/expense account
  // with posted activity this period, zeroing each to its opposite normal
  // balance, with the net difference (profit credited, loss debited) to
  // Retained Earnings. Built and posted directly via Prisma, not through
  // JournalEntriesService's draft-then-post flow — the same
  // system-generated-and-already-balanced pattern Expense.pay() and
  // Asset.dispose() already use.
  async close(user: AuthenticatedUser, id: string, dto: CloseFinancialPeriodDto = {}) {
    const period = await this.findOrThrow(id);
    await this.assertScope(user, period.companyId);
    if (period.status === 'closed') {
      throw new ConflictAppException('This financial period is already closed.');
    }

    let closingJournalEntryId: string | null = null;
    if (dto.retainedEarningsAccountId) {
      const items = await this.prisma.journalEntryItem.findMany({
        where: { journalEntry: { companyId: period.companyId, financialPeriodId: id, status: 'posted' } },
        include: { account: true },
      });
      const byAccount = new Map<string, { debit: number; credit: number; type: string }>();
      for (const item of items) {
        if (item.account.accountType !== 'revenue' && item.account.accountType !== 'expense') continue;
        const row = byAccount.get(item.accountId) ?? { debit: 0, credit: 0, type: item.account.accountType };
        row.debit += Number(item.debitAmount);
        row.credit += Number(item.creditAmount);
        byAccount.set(item.accountId, row);
      }

      if (byAccount.size > 0) {
        const closingLines: { accountId: string; debitAmount: number; creditAmount: number; description: string }[] = [];
        let netIncome = 0;
        for (const [accountId, row] of byAccount) {
          const balance = row.type === 'revenue' ? row.credit - row.debit : row.debit - row.credit;
          if (Math.abs(balance) < 0.001) continue;
          netIncome += row.type === 'revenue' ? balance : -balance;
          // Zero the account to its opposite normal balance: a revenue
          // account (credit-normal) is debited by its credit balance; an
          // expense account (debit-normal) is credited by its debit balance.
          closingLines.push({
            accountId,
            debitAmount: row.type === 'revenue' ? balance : 0,
            creditAmount: row.type === 'expense' ? balance : 0,
            description: `Closing entry — ${period.periodName}`,
          });
        }
        if (netIncome > 0) {
          closingLines.push({ accountId: dto.retainedEarningsAccountId, debitAmount: 0, creditAmount: netIncome, description: `Net income closed to Retained Earnings — ${period.periodName}` });
        } else if (netIncome < 0) {
          closingLines.push({ accountId: dto.retainedEarningsAccountId, debitAmount: -netIncome, creditAmount: 0, description: `Net loss closed to Retained Earnings — ${period.periodName}` });
        }

        if (closingLines.length > 0) {
          const count = await this.prisma.journalEntry.count({ where: { companyId: period.companyId } });
          const entryNumber = `JE-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
          const closingEntry = await this.prisma.journalEntry.create({
            data: {
              companyId: period.companyId,
              entryNumber,
              entryDate: period.endDate,
              description: `Closing entry for ${period.periodName}`,
              financialPeriodId: id,
              entryType: 'closing',
              status: 'posted',
              postedAt: new Date(),
              createdBy: user.id,
              items: { create: closingLines },
            },
          });
          closingJournalEntryId = closingEntry.id;
          await this.auditService.record({
            eventType: 'accounting.journal_entry.posted',
            sourceService: 'accounting-service',
            userId: user.id,
            companyId: period.companyId,
            entityType: 'journal_entry',
            entityId: closingEntry.id,
            action: 'approve',
            newValue: { entryNumber, entryType: 'closing', netIncome: netIncome.toFixed(2) },
          });
        }
      }
    }

    const updated = await this.prisma.financialPeriod.update({
      where: { id },
      data: { status: 'closed', closedAt: new Date(), closedBy: user.id },
    });
    await this.auditService.record({
      eventType: 'accounting.financial_period.closed',
      sourceService: 'accounting-service',
      userId: user.id,
      companyId: updated.companyId,
      entityType: 'financial_period',
      entityId: updated.id,
      action: 'update',
      previousValue: { status: 'open' },
      newValue: { status: 'closed', closingJournalEntryId },
    });
    return { ...toResource(updated), closingJournalEntryId };
  }

  async findOrThrow(id: string) {
    const period = await this.prisma.financialPeriod.findUnique({ where: { id } });
    if (!period) throw new NotFoundAppException('Financial period not found.');
    return period;
  }

  async assertScope(user: AuthenticatedUser, companyId: string) {
    if (!isCompanyInScope(user, companyId, GROUP_PERM)) {
      throw new NotFoundAppException('Company not found.');
    }
  }
}
