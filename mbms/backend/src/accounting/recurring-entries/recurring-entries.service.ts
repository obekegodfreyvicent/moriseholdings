import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundAppException, PeriodClosedException, UnbalancedEntryException } from '../../common/app-exception';
import { AuthenticatedUser } from '../../common/strategies/jwt.strategy';
import { isCompanyInScope } from '../../common/scope.util';
import { CreateRecurringEntryDto, GenerateRecurringEntryDto, UpdateRecurringEntryDto } from './dto/recurring-entry.dto';
import { AuditService } from '../../common/audit/audit.service';

const GROUP_PERM = 'accounting.viewAll';

function toResource(r: any) {
  return {
    id: r.id,
    companyId: r.companyId,
    name: r.name,
    description: r.description,
    isActive: r.isActive,
    lastGeneratedAt: r.lastGeneratedAt,
    timesGenerated: r.timesGenerated,
    createdAt: r.createdAt,
    items: (r.items ?? []).map((i: any) => ({
      id: i.id,
      accountId: i.accountId,
      accountCode: i.account?.accountCode,
      accountName: i.account?.accountName,
      debitAmount: i.debitAmount.toString(),
      creditAmount: i.creditAmount.toString(),
      description: i.description,
    })),
  };
}

@Injectable()
export class RecurringEntriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  // GET /accounting/recurring-entries?companyId=
  async list(user: AuthenticatedUser, companyId: string) {
    await this.assertScope(user, companyId);
    const rows = await this.prisma.recurringJournalEntry.findMany({
      where: { companyId },
      include: { items: { include: { account: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toResource);
  }

  // POST /accounting/recurring-entries — FR-ACC-07: a reusable line-item
  // template, balance-checked at save time so a broken template can't be
  // saved in the first place, not just caught later when it's generated.
  async create(user: AuthenticatedUser, dto: CreateRecurringEntryDto) {
    await this.assertScope(user, dto.companyId);
    this.assertBalanced(dto.items);

    const entry = await this.prisma.recurringJournalEntry.create({
      data: {
        companyId: dto.companyId,
        name: dto.name,
        description: dto.description,
        createdBy: user.id,
        items: {
          create: dto.items.map((i) => ({
            accountId: i.accountId,
            debitAmount: i.debitAmount ?? 0,
            creditAmount: i.creditAmount ?? 0,
            description: i.description,
          })),
        },
      },
      include: { items: { include: { account: true } } },
    });
    await this.auditService.record({
      eventType: 'accounting.recurring_entry.created',
      sourceService: 'accounting-service',
      userId: user.id,
      companyId: entry.companyId,
      entityType: 'recurring_journal_entry',
      entityId: entry.id,
      action: 'create',
      newValue: { name: entry.name },
    });
    return toResource(entry);
  }

  // GET /accounting/recurring-entries/{id}
  async get(user: AuthenticatedUser, id: string) {
    const entry = await this.findOrThrow(id);
    await this.assertScope(user, entry.companyId);
    return toResource(entry);
  }

  // PATCH /accounting/recurring-entries/{id} — name/description/isActive
  // only; the line items themselves are immutable once saved (delete and
  // recreate the template if the split needs to change), the same
  // simplification this codebase already applies elsewhere rather than
  // building a full item-level PATCH for a low-traffic template resource.
  async update(user: AuthenticatedUser, id: string, dto: UpdateRecurringEntryDto) {
    const entry = await this.findOrThrow(id);
    await this.assertScope(user, entry.companyId);
    const updated = await this.prisma.recurringJournalEntry.update({
      where: { id },
      data: { name: dto.name, description: dto.description, isActive: dto.isActive },
      include: { items: { include: { account: true } } },
    });
    await this.auditService.record({
      eventType: 'accounting.recurring_entry.updated',
      sourceService: 'accounting-service',
      userId: user.id,
      companyId: updated.companyId,
      entityType: 'recurring_journal_entry',
      entityId: updated.id,
      action: 'update',
      previousValue: { isActive: entry.isActive },
      newValue: { isActive: updated.isActive },
    });
    return toResource(updated);
  }

  // POST /accounting/recurring-entries/{id}/generate — clones the template
  // into a new DRAFT journal entry. Deliberately does NOT post it
  // automatically: the generated entry goes through the same
  // POST .../journal-entries/{id}/post endpoint (and its BR-03/BR-04
  // balance + period-closed checks) every manually-created entry already
  // does, so a stale template referencing a since-deactivated account still
  // gets caught at post time exactly like any other draft would be.
  async generate(user: AuthenticatedUser, id: string, dto: GenerateRecurringEntryDto) {
    const entry = await this.findOrThrow(id);
    await this.assertScope(user, entry.companyId);
    if (!entry.isActive) {
      throw new NotFoundAppException('This recurring entry template is inactive.');
    }

    const period = await this.prisma.financialPeriod.findUnique({ where: { id: dto.financialPeriodId } });
    if (!period || period.companyId !== entry.companyId) {
      throw new NotFoundAppException('Financial period not found for this company.');
    }
    if (period.status === 'closed') {
      throw new PeriodClosedException(`Cannot generate into "${period.periodName}" — this financial period is closed.`);
    }

    const items = await this.prisma.recurringJournalEntryItem.findMany({ where: { recurringJournalEntryId: id } });
    const count = await this.prisma.journalEntry.count({ where: { companyId: entry.companyId } });
    const entryNumber = `JE-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

    const [journalEntry] = await this.prisma.$transaction([
      this.prisma.journalEntry.create({
        data: {
          companyId: entry.companyId,
          entryNumber,
          entryDate: new Date(dto.entryDate),
          description: `${entry.name} (recurring)`,
          financialPeriodId: dto.financialPeriodId,
          createdBy: user.id,
          items: {
            create: items.map((i) => ({
              accountId: i.accountId,
              debitAmount: i.debitAmount,
              creditAmount: i.creditAmount,
              description: i.description,
            })),
          },
        },
        include: { items: { include: { account: true } } },
      }),
      this.prisma.recurringJournalEntry.update({
        where: { id },
        data: { lastGeneratedAt: new Date(), timesGenerated: { increment: 1 } },
      }),
    ]);

    await this.auditService.record({
      eventType: 'accounting.recurring_entry.generated',
      sourceService: 'accounting-service',
      userId: user.id,
      companyId: entry.companyId,
      entityType: 'recurring_journal_entry',
      entityId: entry.id,
      action: 'create',
      newValue: { generatedJournalEntryId: journalEntry.id, entryNumber: journalEntry.entryNumber },
    });

    return {
      id: journalEntry.id,
      companyId: journalEntry.companyId,
      entryNumber: journalEntry.entryNumber,
      entryDate: journalEntry.entryDate,
      description: journalEntry.description,
      financialPeriodId: journalEntry.financialPeriodId,
      status: journalEntry.status,
      items: journalEntry.items.map((i) => ({
        accountId: i.accountId,
        accountCode: i.account.accountCode,
        accountName: i.account.accountName,
        debitAmount: i.debitAmount.toString(),
        creditAmount: i.creditAmount.toString(),
        description: i.description,
      })),
    };
  }

  private assertBalanced(items: { debitAmount?: number; creditAmount?: number }[]) {
    const debitTotal = items.reduce((s, i) => s + (i.debitAmount ?? 0), 0);
    const creditTotal = items.reduce((s, i) => s + (i.creditAmount ?? 0), 0);
    if (Math.abs(debitTotal - creditTotal) > 0.001) {
      throw new UnbalancedEntryException(
        `Recurring entry template does not balance: total debits (${debitTotal.toFixed(2)}) do not equal total credits (${creditTotal.toFixed(2)}).`,
        { field: 'items', debit_total: debitTotal.toFixed(2), credit_total: creditTotal.toFixed(2) },
      );
    }
  }

  private async assertScope(user: AuthenticatedUser, companyId: string) {
    if (!isCompanyInScope(user, companyId, GROUP_PERM)) {
      throw new NotFoundAppException('Company not found.');
    }
  }

  private async findOrThrow(id: string) {
    const entry = await this.prisma.recurringJournalEntry.findUnique({
      where: { id },
      include: { items: { include: { account: true } } },
    });
    if (!entry) throw new NotFoundAppException('Recurring entry template not found.');
    return entry;
  }
}
