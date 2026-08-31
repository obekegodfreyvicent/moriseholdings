import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConflictAppException, NotFoundAppException, PeriodClosedException } from '../common/app-exception';
import { AuthenticatedUser } from '../common/strategies/jwt.strategy';
import { hasGroupVisibility, isCompanyInScope } from '../common/scope.util';
import { AuditService } from '../common/audit/audit.service';
import { CreateSupplierCreditNoteDto, CreateSupplierInvoiceDto, RecordSupplierPaymentDto } from './dto/accounts-payable.dto';

const GROUP_PERM = 'ap.viewAll';
const MANAGE_PERM = 'ap.manage';
const APPROVE_PERM = 'ap.approve';

@Injectable()
export class AccountsPayableService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  // ---------------------------------------------------------------- Invoices

  async listInvoices(user: AuthenticatedUser, filters: { companyId?: string; supplierId?: string; status?: string }) {
    const where: any = {};
    if (filters.status) where.status = filters.status;
    if (filters.supplierId) where.supplierId = filters.supplierId;
    if (hasGroupVisibility(user, GROUP_PERM)) {
      if (filters.companyId) where.companyId = filters.companyId;
    } else {
      const scoped = user.scopes.map((s) => s.companyId);
      where.companyId = filters.companyId && scoped.includes(filters.companyId) ? filters.companyId : { in: scoped.length > 0 ? scoped : ['__none__'] };
    }
    return this.prisma.supplierInvoice.findMany({ where, include: { items: true }, orderBy: { invoiceDate: 'desc' } });
  }

  async createInvoice(user: AuthenticatedUser, dto: CreateSupplierInvoiceDto) {
    if (!isCompanyInScope(user, dto.companyId, GROUP_PERM)) {
      throw new NotFoundAppException('Company not found.');
    }
    const items = dto.items.map((i) => ({ description: i.description, quantity: i.quantity ?? 1, unitPrice: i.unitPrice, lineTotal: (i.quantity ?? 1) * i.unitPrice }));
    const subtotal = items.reduce((s, i) => s + i.lineTotal, 0);
    const taxAmount = dto.taxAmount ?? 0;
    const totalAmount = subtotal + taxAmount;

    const count = await this.prisma.supplierInvoice.count({ where: { companyId: dto.companyId } });
    const invoiceNumber = `AP-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

    const invoice = await this.prisma.supplierInvoice.create({
      data: {
        companyId: dto.companyId,
        supplierId: dto.supplierId,
        invoiceNumber,
        invoiceDate: new Date(dto.invoiceDate),
        dueDate: new Date(dto.dueDate),
        currency: dto.currency,
        subtotal,
        taxAmount,
        totalAmount,
        apAccountId: dto.apAccountId,
        expenseAccountId: dto.expenseAccountId,
        financialPeriodId: dto.financialPeriodId,
        createdBy: user.id,
        items: { create: items },
      },
      include: { items: true },
    });
    await this.record(user.id, 'ap.invoice.created', invoice.companyId, 'supplier_invoice', invoice.id, { invoiceNumber, totalAmount: totalAmount.toFixed(2) });
    return invoice;
  }

  async submitForApproval(user: AuthenticatedUser, id: string) {
    const invoice = await this.findInvoiceOrThrow(user, id);
    if (invoice.status !== 'draft') {
      throw new ConflictAppException(`Invoice is "${invoice.status}", not draft.`);
    }
    const updated = await this.prisma.supplierInvoice.update({ where: { id }, data: { status: 'pending_approval' } });
    await this.record(user.id, 'ap.invoice.submitted_for_approval', invoice.companyId, 'supplier_invoice', id, {});
    return updated;
  }

  async approve(user: AuthenticatedUser, id: string) {
    const invoice = await this.prisma.supplierInvoice.findUnique({ where: { id } });
    if (!invoice || !isCompanyInScope(user, invoice.companyId, APPROVE_PERM)) {
      throw new NotFoundAppException('Supplier invoice not found.');
    }
    if (invoice.status !== 'pending_approval') {
      throw new ConflictAppException(`Invoice is "${invoice.status}", not pending_approval.`);
    }
    const period = await this.prisma.financialPeriod.findUnique({ where: { id: invoice.financialPeriodId! } });
    if (!period || period.status === 'closed') {
      throw new PeriodClosedException('Cannot approve into a closed financial period.');
    }

    const journalEntry = await this.postJournalEntry(
      invoice.companyId,
      invoice.financialPeriodId!,
      invoice.invoiceDate,
      `Supplier invoice ${invoice.invoiceNumber} approved`,
      [
        { accountId: invoice.expenseAccountId!, debitAmount: Number(invoice.totalAmount), creditAmount: 0 },
        { accountId: invoice.apAccountId!, debitAmount: 0, creditAmount: Number(invoice.totalAmount) },
      ],
      user.id,
    );

    const updated = await this.prisma.supplierInvoice.update({
      where: { id },
      data: { status: 'approved', approvedBy: user.id, approvedAt: new Date(), journalEntryId: journalEntry.id },
    });
    await this.record(user.id, 'ap.invoice.approved', invoice.companyId, 'supplier_invoice', id, { journalEntryId: journalEntry.id });
    return updated;
  }

  // ---------------------------------------------------------------- Payments

  async recordPayment(user: AuthenticatedUser, dto: RecordSupplierPaymentDto) {
    if (!isCompanyInScope(user, dto.companyId, MANAGE_PERM)) {
      throw new NotFoundAppException('Company not found.');
    }
    const invoice = await this.prisma.supplierInvoice.findUnique({ where: { id: dto.invoiceId } });
    if (!invoice || invoice.companyId !== dto.companyId) {
      throw new NotFoundAppException('Invoice not found for this company.');
    }
    if (!['approved', 'partially_paid'].includes(invoice.status)) {
      throw new ConflictAppException(`Invoice is "${invoice.status}" — only an approved (or partially paid) invoice can be paid.`);
    }
    const remaining = Number(invoice.totalAmount) - Number(invoice.amountPaid);
    if (dto.amount > remaining + 0.001) {
      throw new ConflictAppException(`Payment (${dto.amount.toFixed(2)}) exceeds the remaining balance (${remaining.toFixed(2)}).`);
    }

    const period = await this.prisma.financialPeriod.findFirst({ where: { companyId: dto.companyId, status: 'open' } });
    if (!period) throw new ConflictAppException('No open financial period for this company.');

    const journalEntry = await this.postJournalEntry(
      dto.companyId,
      period.id,
      new Date(dto.paymentDate),
      `Payment to supplier — invoice ${invoice.invoiceNumber}`,
      [
        { accountId: invoice.apAccountId!, debitAmount: dto.amount, creditAmount: 0 },
        { accountId: dto.bankAccountId, debitAmount: 0, creditAmount: dto.amount },
      ],
      user.id,
    );

    const payment = await this.prisma.supplierPayment.create({
      data: {
        companyId: dto.companyId,
        supplierId: dto.supplierId,
        paymentDate: new Date(dto.paymentDate),
        amount: dto.amount,
        currency: dto.currency,
        method: dto.method,
        reference: dto.reference,
        bankAccountId: dto.bankAccountId,
        journalEntryId: journalEntry.id,
        paidBy: user.id,
        applications: { create: [{ invoiceId: dto.invoiceId, amountApplied: dto.amount }] },
      },
    });

    const newAmountPaid = Number(invoice.amountPaid) + dto.amount;
    await this.prisma.supplierInvoice.update({
      where: { id: dto.invoiceId },
      data: { amountPaid: newAmountPaid, status: newAmountPaid >= Number(invoice.totalAmount) - 0.001 ? 'paid' : 'partially_paid' },
    });

    await this.record(user.id, 'ap.payment.recorded', dto.companyId, 'supplier_payment', payment.id, { amount: dto.amount.toFixed(2), invoiceId: dto.invoiceId });
    return payment;
  }

  // ---------------------------------------------------------------- Credit notes

  async createCreditNote(user: AuthenticatedUser, dto: CreateSupplierCreditNoteDto) {
    if (!isCompanyInScope(user, dto.companyId, MANAGE_PERM)) {
      throw new NotFoundAppException('Company not found.');
    }
    if (dto.appliedToInvoiceId) {
      const invoice = await this.prisma.supplierInvoice.findUnique({ where: { id: dto.appliedToInvoiceId } });
      if (!invoice || invoice.companyId !== dto.companyId) {
        throw new NotFoundAppException('Invoice not found for this company.');
      }
    }
    const count = await this.prisma.supplierCreditNote.count({ where: { companyId: dto.companyId } });
    const creditNoteNumber = `APCN-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

    // Reduces what we owe: debit AP (liability decreases), credit the
    // offset account (usually the same expense/asset account the original
    // purchase hit, reversing part of it).
    const supplierAccounts = await this.prisma.account.findMany({ where: { companyId: dto.companyId, accountSubType: 'payable' } });
    const apAccount = supplierAccounts[0];
    if (!apAccount) {
      throw new NotFoundAppException('No Accounts Payable account (accountSubType=payable) exists for this company.');
    }

    const journalEntry = await this.postJournalEntry(
      dto.companyId,
      dto.financialPeriodId,
      new Date(dto.creditDate),
      `Supplier credit note ${creditNoteNumber}`,
      [
        { accountId: apAccount.id, debitAmount: dto.amount, creditAmount: 0 },
        { accountId: dto.offsetAccountId, debitAmount: 0, creditAmount: dto.amount },
      ],
      user.id,
    );

    const note = await this.prisma.supplierCreditNote.create({
      data: {
        companyId: dto.companyId,
        supplierId: dto.supplierId,
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
    await this.record(user.id, 'ap.credit_note.created', dto.companyId, 'supplier_credit_note', note.id, { amount: dto.amount.toFixed(2) });
    return note;
  }

  // ---------------------------------------------------------------- Reports

  // "Aging reports" / "Outstanding bills": every approved/partially_paid
  // invoice, bucketed by days overdue past dueDate.
  async aging(user: AuthenticatedUser, companyId: string) {
    if (!isCompanyInScope(user, companyId, GROUP_PERM)) {
      throw new NotFoundAppException('Company not found.');
    }
    const invoices = await this.prisma.supplierInvoice.findMany({ where: { companyId, status: { in: ['approved', 'partially_paid'] } } });
    const now = new Date();
    const buckets = { current: 0, days_1_30: 0, days_31_60: 0, days_61_90: 0, days_90_plus: 0 };
    const lines = invoices.map((inv) => {
      const remaining = Number(inv.totalAmount) - Number(inv.amountPaid);
      const daysOverdue = Math.floor((now.getTime() - inv.dueDate.getTime()) / (24 * 60 * 60 * 1000));
      let bucket: keyof typeof buckets = 'current';
      if (daysOverdue > 90) bucket = 'days_90_plus';
      else if (daysOverdue > 60) bucket = 'days_61_90';
      else if (daysOverdue > 30) bucket = 'days_31_60';
      else if (daysOverdue > 0) bucket = 'days_1_30';
      buckets[bucket] += remaining;
      return { invoiceId: inv.id, invoiceNumber: inv.invoiceNumber, supplierId: inv.supplierId, dueDate: inv.dueDate, remaining: remaining.toFixed(2), daysOverdue, bucket };
    });
    return {
      companyId,
      buckets: Object.fromEntries(Object.entries(buckets).map(([k, v]) => [k, v.toFixed(2)])),
      total: lines.reduce((s, l) => s + Number(l.remaining), 0).toFixed(2),
      lines,
    };
  }

  // "Supplier statements": chronological invoice + payment + credit-note
  // rows with a running balance — the same shape the Sales module's own
  // customer statement already uses (InvoicesService.statementForCustomer),
  // mirrored here for the payable side.
  async statement(user: AuthenticatedUser, companyId: string, supplierId: string) {
    if (!isCompanyInScope(user, companyId, GROUP_PERM)) {
      throw new NotFoundAppException('Company not found.');
    }
    const [invoices, payments, creditNotes] = await Promise.all([
      this.prisma.supplierInvoice.findMany({ where: { companyId, supplierId, status: { not: 'draft' } } }),
      this.prisma.supplierPayment.findMany({ where: { companyId, supplierId } }),
      this.prisma.supplierCreditNote.findMany({ where: { companyId, supplierId } }),
    ]);
    type Row = { date: Date; type: string; reference: string; amount: number };
    const rows: Row[] = [
      ...invoices.map((i) => ({ date: i.invoiceDate, type: 'invoice', reference: i.invoiceNumber, amount: Number(i.totalAmount) })),
      ...payments.map((p) => ({ date: p.paymentDate, type: 'payment', reference: p.reference ?? p.method ?? 'payment', amount: -Number(p.amount) })),
      ...creditNotes.map((c) => ({ date: c.creditDate, type: 'credit_note', reference: c.creditNoteNumber, amount: -Number(c.amount) })),
    ].sort((a, b) => a.date.getTime() - b.date.getTime());

    let running = 0;
    const transactions = rows.map((r) => {
      running += r.amount;
      return { date: r.date, type: r.type, reference: r.reference, amount: r.amount.toFixed(2), runningBalance: running.toFixed(2) };
    });
    return { companyId, supplierId, transactions, closingBalance: running.toFixed(2) };
  }

  // "Payment schedules": outstanding bills sorted by due date — a query
  // view, not a stored entity, the same pattern Leave's "calendar" and
  // AR's aging already use.
  async paymentSchedule(user: AuthenticatedUser, companyId: string) {
    if (!isCompanyInScope(user, companyId, GROUP_PERM)) {
      throw new NotFoundAppException('Company not found.');
    }
    const invoices = await this.prisma.supplierInvoice.findMany({
      where: { companyId, status: { in: ['approved', 'partially_paid'] } },
      orderBy: { dueDate: 'asc' },
    });
    return invoices.map((i) => ({ invoiceId: i.id, invoiceNumber: i.invoiceNumber, supplierId: i.supplierId, dueDate: i.dueDate, remaining: (Number(i.totalAmount) - Number(i.amountPaid)).toFixed(2) }));
  }

  private async findInvoiceOrThrow(user: AuthenticatedUser, id: string) {
    const invoice = await this.prisma.supplierInvoice.findUnique({ where: { id }, include: { items: true } });
    if (!invoice || !isCompanyInScope(user, invoice.companyId, GROUP_PERM)) {
      throw new NotFoundAppException('Supplier invoice not found.');
    }
    return invoice;
  }

  // Same system-generated-and-already-balanced posting pattern Expense.pay()
  // and Asset.dispose() use — created directly via Prisma, already `posted`,
  // not routed through JournalEntriesService's draft-then-post flow.
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
      data: {
        companyId,
        entryNumber,
        entryDate,
        description,
        financialPeriodId,
        status: 'posted',
        postedAt: new Date(),
        createdBy: userId,
        items: { create: lines },
      },
    });
  }

  private async record(userId: string, eventType: string, companyId: string, entityType: string, entityId: string, newValue: Record<string, unknown>) {
    await this.auditService.record({ eventType, sourceService: 'accounts-payable-service', userId, companyId, entityType, entityId, action: 'update', newValue });
  }
}
