import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ConflictAppException, NotFoundAppException } from '../../common/app-exception';
import { AuthenticatedUser } from '../../common/strategies/jwt.strategy';
import { isCompanyInScope } from '../../common/scope.util';
import { CreateInterCompanyTransactionDto, PostInterCompanyTransactionDto } from './dto/inter-company-transaction.dto';
import { AuditService } from '../../common/audit/audit.service';

const GROUP_PERM = 'organization.intercompany.viewAll';

function toResource(t: any) {
  return {
    id: t.id,
    fromCompanyId: t.fromCompanyId,
    toCompanyId: t.toCompanyId,
    transactionType: t.transactionType,
    amount: Number(t.amount).toFixed(2),
    currency: t.currency,
    description: t.description,
    transactionDate: t.transactionDate,
    status: t.status,
    fromJournalEntryId: t.fromJournalEntryId,
    toJournalEntryId: t.toJournalEntryId,
    createdBy: t.createdBy,
    postedBy: t.postedBy,
    postedAt: t.postedAt,
    createdAt: t.createdAt,
  };
}

// morise.docx, Section 2: "Maintain inter-company transactions." Posted as
// two independently-balanced journal entries (BR-03 applies per company,
// not across the pair) — a receivable in the sending company's books, a
// matching payable in the receiving company's, the same way real
// inter-company accounting works, not a single entry spanning two
// separate charts of accounts (which no real ledger design supports).
@Injectable()
export class InterCompanyTransactionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  // GET /organization/inter-company-transactions?companyId= — companyId
  // matches either side of the transaction; omitted for the full list
  // (group-visibility permission holders only).
  async list(user: AuthenticatedUser, companyId?: string) {
    if (!user.permissions.includes(GROUP_PERM) && !user.permissions.includes('organization.intercompany.manage')) {
      throw new NotFoundAppException('Not found.');
    }
    const where: any = companyId ? { OR: [{ fromCompanyId: companyId }, { toCompanyId: companyId }] } : {};
    const rows = await this.prisma.interCompanyTransaction.findMany({ where, orderBy: { createdAt: 'desc' } });
    return rows.map(toResource);
  }

  async get(user: AuthenticatedUser, id: string) {
    const t = await this.findOrThrow(id);
    if (!isCompanyInScope(user, t.fromCompanyId, GROUP_PERM) || !isCompanyInScope(user, t.toCompanyId, GROUP_PERM)) {
      throw new NotFoundAppException('Inter-company transaction not found.');
    }
    return toResource(t);
  }

  // POST /organization/inter-company-transactions — draft only; posting
  // (and choosing the four GL accounts involved) is a separate step.
  async create(actor: AuthenticatedUser, dto: CreateInterCompanyTransactionDto) {
    if (dto.fromCompanyId === dto.toCompanyId) {
      throw new ConflictAppException('An inter-company transaction must be between two different companies.');
    }
    const [fromCompany, toCompany] = await Promise.all([
      this.prisma.company.findUnique({ where: { id: dto.fromCompanyId } }),
      this.prisma.company.findUnique({ where: { id: dto.toCompanyId } }),
    ]);
    if (!fromCompany || !toCompany) throw new NotFoundAppException('Company not found.');
    // An inter-company transaction by definition touches two companies —
    // isCompanyInScope against organization.intercompany.viewAll (which
    // every seeded role holding .manage also holds) formalizes the actual
    // access model: create/post are only usable by roles with genuine
    // group-wide reach into this domain, not an explicit scope row in
    // both companies individually, which would make the feature nearly
    // unusable for anyone but a group-wide user.
    if (!isCompanyInScope(actor, dto.fromCompanyId, GROUP_PERM) || !isCompanyInScope(actor, dto.toCompanyId, GROUP_PERM)) {
      throw new NotFoundAppException('Company not found.');
    }

    const transaction = await this.prisma.interCompanyTransaction.create({
      data: {
        fromCompanyId: dto.fromCompanyId,
        toCompanyId: dto.toCompanyId,
        transactionType: dto.transactionType as any,
        amount: dto.amount,
        currency: dto.currency,
        description: dto.description,
        transactionDate: new Date(dto.transactionDate),
        createdBy: actor.id,
      },
    });
    await this.auditService.record({
      eventType: 'organization.intercompany_transaction.created',
      sourceService: 'organization-service',
      userId: actor.id,
      companyId: dto.fromCompanyId,
      entityType: 'inter_company_transaction',
      entityId: transaction.id,
      action: 'create',
      newValue: { toCompanyId: dto.toCompanyId, transactionType: dto.transactionType, amount: dto.amount.toString() },
    });
    return toResource(transaction);
  }

  // POST /organization/inter-company-transactions/{id}/post — creates one
  // balanced journal entry in each company: fromCompany debits its
  // "Due from ToCompany" clearing account and credits the operational
  // account value is leaving from; toCompany debits the operational
  // account value arrives in and credits its "Due to FromCompany"
  // clearing account.
  async post(actor: AuthenticatedUser, id: string, dto: PostInterCompanyTransactionDto) {
    const transaction = await this.findOrThrow(id);
    if (!isCompanyInScope(actor, transaction.fromCompanyId, GROUP_PERM) || !isCompanyInScope(actor, transaction.toCompanyId, GROUP_PERM)) {
      throw new NotFoundAppException('Inter-company transaction not found.');
    }
    if (transaction.status === 'posted') {
      throw new ConflictAppException('This inter-company transaction has already been posted.');
    }

    await this.assertAccount(dto.fromAccountId, transaction.fromCompanyId, 'fromAccountId');
    await this.assertAccount(dto.fromClearingAccountId, transaction.fromCompanyId, 'fromClearingAccountId');
    await this.assertAccount(dto.toClearingAccountId, transaction.toCompanyId, 'toClearingAccountId');
    await this.assertAccount(dto.toAccountId, transaction.toCompanyId, 'toAccountId');

    const fromPeriod = await this.assertOpenPeriod(dto.fromFinancialPeriodId, transaction.fromCompanyId);
    const toPeriod = await this.assertOpenPeriod(dto.toFinancialPeriodId, transaction.toCompanyId);

    const amount = Number(transaction.amount);
    const [fromEntryNumber, toEntryNumber] = await Promise.all([
      this.nextEntryNumber(transaction.fromCompanyId),
      this.nextEntryNumber(transaction.toCompanyId),
    ]);

    const updated = await this.prisma.$transaction(async (tx) => {
      const fromEntry = await tx.journalEntry.create({
        data: {
          companyId: transaction.fromCompanyId,
          entryNumber: fromEntryNumber,
          entryDate: transaction.transactionDate,
          description: `Inter-company ${transaction.transactionType} to ${transaction.toCompanyId}`,
          financialPeriodId: fromPeriod.id,
          status: 'posted',
          createdBy: actor.id,
          postedAt: new Date(),
          items: {
            create: [
              { accountId: dto.fromClearingAccountId, debitAmount: amount, creditAmount: 0, description: 'Due from related company' },
              { accountId: dto.fromAccountId, debitAmount: 0, creditAmount: amount, description: 'Inter-company transaction' },
            ],
          },
        },
      });
      const toEntry = await tx.journalEntry.create({
        data: {
          companyId: transaction.toCompanyId,
          entryNumber: toEntryNumber,
          entryDate: transaction.transactionDate,
          description: `Inter-company ${transaction.transactionType} from ${transaction.fromCompanyId}`,
          financialPeriodId: toPeriod.id,
          status: 'posted',
          createdBy: actor.id,
          postedAt: new Date(),
          items: {
            create: [
              { accountId: dto.toAccountId, debitAmount: amount, creditAmount: 0, description: 'Inter-company transaction' },
              { accountId: dto.toClearingAccountId, debitAmount: 0, creditAmount: amount, description: 'Due to related company' },
            ],
          },
        },
      });
      return tx.interCompanyTransaction.update({
        where: { id },
        data: { status: 'posted', postedBy: actor.id, postedAt: new Date(), fromJournalEntryId: fromEntry.id, toJournalEntryId: toEntry.id },
      });
    });

    await this.auditService.record({
      eventType: 'organization.intercompany_transaction.posted',
      sourceService: 'organization-service',
      userId: actor.id,
      companyId: transaction.fromCompanyId,
      entityType: 'inter_company_transaction',
      entityId: updated.id,
      action: 'approve',
      newValue: { fromJournalEntryId: updated.fromJournalEntryId, toJournalEntryId: updated.toJournalEntryId },
    });
    return toResource(updated);
  }

  private async assertAccount(accountId: string, companyId: string, field: string) {
    const account = await this.prisma.account.findUnique({ where: { id: accountId } });
    if (!account || account.companyId !== companyId) {
      throw new NotFoundAppException(`${field}: account not found for this company.`);
    }
  }

  private async assertOpenPeriod(periodId: string, companyId: string) {
    const period = await this.prisma.financialPeriod.findUnique({ where: { id: periodId } });
    if (!period || period.companyId !== companyId) throw new NotFoundAppException('Financial period not found for this company.');
    if (period.status === 'closed') throw new ConflictAppException(`Cannot post into "${period.periodName}" — this financial period is closed.`);
    return period;
  }

  private async nextEntryNumber(companyId: string) {
    const count = await this.prisma.journalEntry.count({ where: { companyId } });
    return `JE-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
  }

  private async findOrThrow(id: string) {
    const transaction = await this.prisma.interCompanyTransaction.findUnique({ where: { id } });
    if (!transaction) throw new NotFoundAppException('Inter-company transaction not found.');
    return transaction;
  }
}
