import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ConflictAppException,
  NotFoundAppException,
  PeriodClosedException,
  UnbalancedEntryException,
} from '../../common/app-exception';
import { Paginated } from '../../common/interceptors/response.interceptor';
import { AuthenticatedUser } from '../../common/strategies/jwt.strategy';
import { isCompanyInScope } from '../../common/scope.util';
import { CreateJournalEntryDto } from './dto/journal-entry.dto';
import { AuditService } from '../../common/audit/audit.service';

const GROUP_PERM = 'accounting.viewAll';

function toResource(e: any) {
  return {
    id: e.id,
    companyId: e.companyId,
    entryNumber: e.entryNumber,
    entryDate: e.entryDate,
    description: e.description,
    financialPeriodId: e.financialPeriodId,
    status: e.status,
    entryType: e.entryType,
    createdBy: e.createdBy,
    postedAt: e.postedAt,
    createdAt: e.createdAt,
    items: (e.items ?? []).map((i: any) => ({
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
export class JournalEntriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  // GET /accounting/journal-entries?companyId=&periodId=&status= — FR-ACC-02, 03
  async list(
    user: AuthenticatedUser,
    page: number,
    pageSize: number,
    companyId: string,
    filters: { financialPeriodId?: string; status?: string },
  ): Promise<Paginated<unknown>> {
    await this.assertScope(user, companyId);
    const where: any = { companyId };
    if (filters.financialPeriodId) where.financialPeriodId = filters.financialPeriodId;
    if (filters.status) where.status = filters.status;

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.journalEntry.findMany({
        where,
        include: { items: { include: { account: true } } },
        orderBy: { entryDate: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.journalEntry.count({ where }),
    ]);
    return { items: rows.map(toResource), page, pageSize, total };
  }

  // POST /accounting/journal-entries — FR-ACC-02 / AC-08 (draft; balance is
  // only enforced at post time, per BR-03's own wording: "before it can be
  // posted to the general ledger")
  async create(user: AuthenticatedUser, dto: CreateJournalEntryDto) {
    await this.assertScope(user, dto.companyId);

    const period = await this.prisma.financialPeriod.findUnique({ where: { id: dto.financialPeriodId } });
    if (!period || period.companyId !== dto.companyId) {
      throw new NotFoundAppException('Financial period not found for this company.');
    }

    const count = await this.prisma.journalEntry.count({ where: { companyId: dto.companyId } });
    const entryNumber = `JE-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

    const entry = await this.prisma.journalEntry.create({
      data: {
        companyId: dto.companyId,
        entryNumber,
        entryDate: new Date(dto.entryDate),
        description: dto.description,
        financialPeriodId: dto.financialPeriodId,
        entryType: dto.entryType ?? 'standard',
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
      eventType: 'accounting.journal_entry.created',
      sourceService: 'accounting-service',
      userId: user.id,
      companyId: entry.companyId,
      entityType: 'journal_entry',
      entityId: entry.id,
      action: 'create',
      newValue: { entryNumber: entry.entryNumber, description: entry.description },
    });
    return toResource(entry);
  }

  // POST /accounting/journal-entries/{id}/post — FR-ACC-03, BR-03, BR-04 / AC-08
  async post(user: AuthenticatedUser, id: string) {
    const entry = await this.prisma.journalEntry.findUnique({
      where: { id },
      include: { items: true, financialPeriod: true },
    });
    if (!entry) throw new NotFoundAppException('Journal entry not found.');
    await this.assertScope(user, entry.companyId);

    if (entry.status === 'posted') {
      throw new ConflictAppException('This journal entry has already been posted.');
    }

    if (entry.financialPeriod.status === 'closed') {
      throw new PeriodClosedException(
        `Cannot post into "${entry.financialPeriod.periodName}" — this financial period is closed.`,
      );
    }

    const debitTotal = entry.items.reduce((sum, i) => sum + Number(i.debitAmount), 0);
    const creditTotal = entry.items.reduce((sum, i) => sum + Number(i.creditAmount), 0);
    if (Math.abs(debitTotal - creditTotal) > 0.001) {
      throw new UnbalancedEntryException(
        `Journal entry does not balance: total debits (${debitTotal.toFixed(2)}) do not equal ` +
          `total credits (${creditTotal.toFixed(2)}).`,
        { field: 'items', debit_total: debitTotal.toFixed(2), credit_total: creditTotal.toFixed(2) },
      );
    }

    const posted = await this.prisma.journalEntry.update({
      where: { id },
      data: { status: 'posted', postedAt: new Date() },
      include: { items: { include: { account: true } } },
    });
    // accounting.journal_entry.posted — the one event topic 09_API
    // Specification, Section 11 names explicitly by example, since it's
    // the event 08_Database Design Document's dashboard read-models
    // (Section 10.2) are built to consume.
    await this.auditService.record({
      eventType: 'accounting.journal_entry.posted',
      sourceService: 'accounting-service',
      userId: user.id,
      companyId: posted.companyId,
      entityType: 'journal_entry',
      entityId: posted.id,
      action: 'approve',
      previousValue: { status: 'draft' },
      newValue: { status: 'posted', debitTotal: debitTotal.toFixed(2), creditTotal: creditTotal.toFixed(2) },
    });
    return toResource(posted);
  }

  async assertScope(user: AuthenticatedUser, companyId: string) {
    if (!isCompanyInScope(user, companyId, GROUP_PERM)) {
      throw new NotFoundAppException('Company not found.');
    }
  }
}
