import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundAppException } from '../common/app-exception';
import { AuthenticatedUser } from '../common/strategies/jwt.strategy';
import { isCompanyInScope } from '../common/scope.util';
import { AuditService } from '../common/audit/audit.service';
import { CreateCustomerCreditNoteDto, CreateCustomerDebitNoteDto } from './dto/accounts-receivable.dto';

const GROUP_PERM = 'accounting.viewAll';
const MANAGE_PERM = 'accounting.manage';

// Financial Module deepening (19 August 2026), Accounts Receivable. Reads
// the real Invoice/Payment/PaymentAllocation/Order models a concurrent
// session already built (the "Customer Storefront" section of
// schema.prisma) — see the correction note directly above
// CreditDebitNoteStatus in that file for why this module does NOT define
// its own invoice/payment tables. Only genuinely missing pieces are added
// here: credit/debit notes, a STAFF-facing (not customer-portal) aging
// report and statement view (customer-portal's InvoicesService only lets a
// logged-in customer see their own data), and payment reminders.
@Injectable()
export class AccountsReceivableService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  // ---------------------------------------------------------------- Credit / Debit notes

  async createCreditNote(user: AuthenticatedUser, dto: CreateCustomerCreditNoteDto) {
    if (!isCompanyInScope(user, dto.companyId, MANAGE_PERM)) {
      throw new NotFoundAppException('Company not found.');
    }
    if (dto.appliedToInvoiceId) {
      const invoice = await this.prisma.invoice.findUnique({ where: { id: dto.appliedToInvoiceId } });
      if (!invoice || invoice.companyId !== dto.companyId) {
        throw new NotFoundAppException('Invoice not found for this company.');
      }
    }
    const arAccount = await this.prisma.account.findFirst({ where: { companyId: dto.companyId, accountSubType: 'receivable' } });
    if (!arAccount) {
      throw new NotFoundAppException('No Accounts Receivable account (accountSubType=receivable) exists for this company.');
    }
    const count = await this.prisma.customerCreditNote.count({ where: { companyId: dto.companyId } });
    const creditNoteNumber = `ARCN-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

    // Reduces what the customer owes: credit AR (receivable decreases),
    // debit the offset account (usually the revenue account the original
    // sale hit, reversing part of it).
    const journalEntry = await this.postJournalEntry(
      dto.companyId,
      dto.financialPeriodId,
      new Date(dto.creditDate),
      `Customer credit note ${creditNoteNumber}`,
      [
        { accountId: dto.offsetAccountId, debitAmount: dto.amount, creditAmount: 0 },
        { accountId: arAccount.id, debitAmount: 0, creditAmount: dto.amount },
      ],
      user.id,
    );

    const note = await this.prisma.customerCreditNote.create({
      data: {
        companyId: dto.companyId,
        customerId: dto.customerId,
        creditNoteNumber,
        creditDate: new Date(dto.creditDate),
        amount: dto.amount,
        reason: dto.reason,
        appliedToInvoiceId: dto.appliedToInvoiceId,
        status: dto.appliedToInvoiceId ? 'applied' : 'issued',
        financialPeriodId: dto.financialPeriodId,
        journalEntryId: journalEntry.id,
        createdBy: user.id,
      },
    });
    await this.record(user.id, 'ar.credit_note.created', dto.companyId, 'customer_credit_note', note.id, { amount: dto.amount.toFixed(2) });
    return note;
  }

  async createDebitNote(user: AuthenticatedUser, dto: CreateCustomerDebitNoteDto) {
    if (!isCompanyInScope(user, dto.companyId, MANAGE_PERM)) {
      throw new NotFoundAppException('Company not found.');
    }
    const arAccount = await this.prisma.account.findFirst({ where: { companyId: dto.companyId, accountSubType: 'receivable' } });
    if (!arAccount) {
      throw new NotFoundAppException('No Accounts Receivable account (accountSubType=receivable) exists for this company.');
    }
    const count = await this.prisma.customerDebitNote.count({ where: { companyId: dto.companyId } });
    const debitNoteNumber = `ARDN-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

    // Increases what the customer owes: debit AR, credit the offset account.
    const journalEntry = await this.postJournalEntry(
      dto.companyId,
      dto.financialPeriodId,
      new Date(dto.debitDate),
      `Customer debit note ${debitNoteNumber}`,
      [
        { accountId: arAccount.id, debitAmount: dto.amount, creditAmount: 0 },
        { accountId: dto.offsetAccountId, debitAmount: 0, creditAmount: dto.amount },
      ],
      user.id,
    );

    const note = await this.prisma.customerDebitNote.create({
      data: {
        companyId: dto.companyId,
        customerId: dto.customerId,
        debitNoteNumber,
        debitDate: new Date(dto.debitDate),
        amount: dto.amount,
        reason: dto.reason,
        financialPeriodId: dto.financialPeriodId,
        journalEntryId: journalEntry.id,
        createdBy: user.id,
      },
    });
    await this.record(user.id, 'ar.debit_note.created', dto.companyId, 'customer_debit_note', note.id, { amount: dto.amount.toFixed(2) });
    return note;
  }

  // ---------------------------------------------------------------- Reports (staff-facing)

  private async findOutstandingInvoices(companyId: string) {
    return this.prisma.invoice.findMany({
      where: { companyId, paidAt: null, order: { status: { not: 'cancelled' } } },
      include: { order: true },
    });
  }

  async aging(user: AuthenticatedUser, companyId: string) {
    if (!isCompanyInScope(user, companyId, GROUP_PERM)) {
      throw new NotFoundAppException('Company not found.');
    }
    const invoices = await this.findOutstandingInvoices(companyId);
    const now = new Date();
    const buckets = { current: 0, days_1_30: 0, days_31_60: 0, days_61_90: 0, days_90_plus: 0 };
    const lines = invoices.map((inv) => {
      const amount = Number(inv.amount);
      const daysOverdue = Math.floor((now.getTime() - inv.dueDate.getTime()) / (24 * 60 * 60 * 1000));
      let bucket: keyof typeof buckets = 'current';
      if (daysOverdue > 90) bucket = 'days_90_plus';
      else if (daysOverdue > 60) bucket = 'days_61_90';
      else if (daysOverdue > 30) bucket = 'days_31_60';
      else if (daysOverdue > 0) bucket = 'days_1_30';
      buckets[bucket] += amount;
      return { invoiceId: inv.id, invoiceNumber: inv.invoiceNumber, customerId: inv.customerId, dueDate: inv.dueDate, amount: amount.toFixed(2), daysOverdue, bucket };
    });
    return {
      companyId,
      buckets: Object.fromEntries(Object.entries(buckets).map(([k, v]) => [k, v.toFixed(2)])),
      total: lines.reduce((s, l) => s + Number(l.amount), 0).toFixed(2),
      lines,
    };
  }

  async outstandingInvoices(user: AuthenticatedUser, companyId: string) {
    if (!isCompanyInScope(user, companyId, GROUP_PERM)) {
      throw new NotFoundAppException('Company not found.');
    }
    return this.findOutstandingInvoices(companyId);
  }

  // Staff-facing statement — same chronological invoice + payment rows
  // with a running balance InvoicesService.statementForCustomer already
  // builds for a logged-in customer's own view, callable here for any
  // customer by staff, plus credit/debit notes folded in (the
  // customer-portal version predates those, since this pass added them).
  async statement(user: AuthenticatedUser, companyId: string, customerId: string) {
    if (!isCompanyInScope(user, companyId, GROUP_PERM)) {
      throw new NotFoundAppException('Company not found.');
    }
    const [invoices, payments, creditNotes, debitNotes] = await Promise.all([
      this.prisma.invoice.findMany({ where: { companyId, customerId, order: { status: { not: 'cancelled' } } }, include: { order: true } }),
      this.prisma.payment.findMany({ where: { companyId, customerId } }),
      this.prisma.customerCreditNote.findMany({ where: { companyId, customerId } }),
      this.prisma.customerDebitNote.findMany({ where: { companyId, customerId } }),
    ]);
    type Row = { date: Date; type: string; reference: string; amount: number };
    const rows: Row[] = [
      ...invoices.map((i) => ({ date: i.createdAt, type: 'invoice', reference: i.invoiceNumber, amount: Number(i.amount) })),
      ...payments.map((p) => ({ date: p.createdAt, type: 'payment', reference: p.reference ?? p.method, amount: -Number(p.amount) })),
      ...creditNotes.map((c) => ({ date: c.creditDate, type: 'credit_note', reference: c.creditNoteNumber, amount: -Number(c.amount) })),
      ...debitNotes.map((d) => ({ date: d.debitDate, type: 'debit_note', reference: d.debitNoteNumber, amount: Number(d.amount) })),
    ].sort((a, b) => a.date.getTime() - b.date.getTime());

    let running = 0;
    const transactions = rows.map((r) => {
      running += r.amount;
      return { date: r.date, type: r.type, reference: r.reference, amount: r.amount.toFixed(2), runningBalance: running.toFixed(2) };
    });
    return { companyId, customerId, transactions, closingBalance: running.toFixed(2) };
  }

  // "Payment reminders": no email/SMS delivery infrastructure exists in
  // this proof-of-concept (the same deferred-notification gap already
  // named throughout this project for real external delivery) — this
  // records that a reminder was triggered, via the audit trail, rather
  // than adding a dedicated table just to count reminders. GET
  // /audit/logs?filter[entityType]=invoice is how "was a reminder sent"
  // gets answered.
  async sendReminder(user: AuthenticatedUser, companyId: string, invoiceId: string) {
    if (!isCompanyInScope(user, companyId, GROUP_PERM)) {
      throw new NotFoundAppException('Company not found.');
    }
    const invoice = await this.prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice || invoice.companyId !== companyId) {
      throw new NotFoundAppException('Invoice not found for this company.');
    }
    if (invoice.paidAt) {
      throw new NotFoundAppException('This invoice is already paid — no reminder needed.');
    }
    await this.record(user.id, 'ar.invoice.reminder_sent', companyId, 'invoice', invoiceId, { invoiceNumber: invoice.invoiceNumber });
    return { message: 'Reminder recorded.', invoiceId, invoiceNumber: invoice.invoiceNumber };
  }

  private async postJournalEntry(
    companyId: string,
    financialPeriodId: string,
    entryDate: Date,
    description: string,
    lines: { accountId: string; debitAmount: number; creditAmount: number }[],
    userId: string,
  ) {
    const count = await this.prisma.journalEntry.count({ where: { companyId } });
    const entryNumber = `JE-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
    return this.prisma.journalEntry.create({
      data: { companyId, entryNumber, entryDate, description, financialPeriodId, status: 'posted', postedAt: new Date(), createdBy: userId, items: { create: lines } },
    });
  }

  private async record(userId: string, eventType: string, companyId: string, entityType: string, entityId: string, newValue: Record<string, unknown>) {
    await this.auditService.record({ eventType, sourceService: 'accounts-receivable-service', userId, companyId, entityType, entityId, action: 'update', newValue });
  }
}
