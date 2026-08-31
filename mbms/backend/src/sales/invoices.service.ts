import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundAppException } from '../common/app-exception';
import { AuthenticatedCustomer } from '../customer-portal/common/customer-auth.types';
import { buildPdfTable } from '../common/reports/pdf.util';
import { ContentTranslationService } from '../common/translation/content-translation.service';

const DUE_SOON_DAYS = 10;

// Overdue/due-soon/paid is computed here, at read time, from dueDate/paidAt
// — never stored (see the Invoice model's own schema comment). A
// cancelled-order's invoice is excluded from the outstanding total exactly
// like OrdersService.outstandingBalance excludes it, via the same
// order.status !== 'cancelled' join condition.
function computeStatus(invoice: { dueDate: Date; paidAt: Date | null }): 'paid' | 'overdue' | 'due_soon' | 'upcoming' {
  if (invoice.paidAt) return 'paid';
  const now = new Date();
  const dueSoonThreshold = new Date(now.getTime() + DUE_SOON_DAYS * 24 * 60 * 60_000);
  if (invoice.dueDate < now) return 'overdue';
  if (invoice.dueDate <= dueSoonThreshold) return 'due_soon';
  return 'upcoming';
}

function toInvoiceResource(inv: any) {
  return {
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    companyId: inv.companyId,
    customerId: inv.customerId,
    orderId: inv.orderId,
    orderNumber: inv.order?.orderNumber,
    amount: inv.amount.toString(),
    dueDate: inv.dueDate,
    paidAt: inv.paidAt,
    status: computeStatus(inv),
    createdAt: inv.createdAt,
  };
}

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly translation: ContentTranslationService,
  ) {}

  // Content localisation (30 August 2026): render a stored English value in
  // the customer's language (glossary reach + digit script). Used for the
  // statement's row-type / reference and its PDF's labels.
  private loc(text: string | null | undefined, lang: string): string {
    if (text == null) return '';
    return lang === 'en' ? String(text) : (this.translation.toLocale(String(text), lang) as string);
  }

  private async findCustomerInvoices(customerId: string) {
    return this.prisma.invoice.findMany({
      where: { customerId, order: { status: { not: 'cancelled' } } },
      include: { order: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listForCustomer(customer: AuthenticatedCustomer, page: number, pageSize: number, filters: { status?: string }) {
    const all = (await this.findCustomerInvoices(customer.id)).map(toInvoiceResource);
    const filtered = filters.status ? all.filter((i) => i.status === filters.status) : all;
    const start = (page - 1) * pageSize;
    return { items: filtered.slice(start, start + pageSize), page, pageSize, total: filtered.length };
  }

  async getForCustomer(customer: AuthenticatedCustomer, id: string) {
    const invoice = await this.prisma.invoice.findUnique({ where: { id }, include: { order: true } });
    if (!invoice || invoice.customerId !== customer.id) throw new NotFoundAppException('Invoice not found.');
    return toInvoiceResource(invoice);
  }

  // GET /customer-portal/me — summary tiles (Home dashboard, My Account,
  // Invoices & Payments header) all derive from this one computation, kept
  // in one place so the "outstanding balance" figure can never drift
  // between screens.
  async summaryForCustomer(customer: AuthenticatedCustomer) {
    const invoices = (await this.findCustomerInvoices(customer.id)).map(toInvoiceResource);
    const outstanding = invoices.filter((i) => i.status !== 'paid');
    const totalOutstanding = outstanding.reduce((sum, i) => sum + Number(i.amount), 0);
    const overdueCount = outstanding.filter((i) => i.status === 'overdue').length;
    return {
      totalOutstanding: totalOutstanding.toFixed(2),
      overdueCount,
      invoiceCount: invoices.length,
    };
  }

  // GET /customer-portal/invoices/statement — replaces
  // customers.service.ts's honest-empty statement() stub now that real
  // sales transactions exist. Chronological invoice + payment rows with a
  // running balance.
  async statementForCustomer(customer: AuthenticatedCustomer, lang = 'en') {
    const invoices = await this.findCustomerInvoices(customer.id);
    const payments = await this.prisma.payment.findMany({ where: { customerId: customer.id }, orderBy: { createdAt: 'asc' } });

    type Row = { date: Date; type: 'invoice' | 'payment'; reference: string; amount: number };
    const rows: Row[] = [
      ...invoices.map((i) => ({ date: i.createdAt, type: 'invoice' as const, reference: i.invoiceNumber, amount: Number(i.amount) })),
      ...payments.map((p) => ({ date: p.createdAt, type: 'payment' as const, reference: p.reference ?? p.method, amount: -Number(p.amount) })),
    ].sort((a, b) => a.date.getTime() - b.date.getTime());

    let running = 0;
    const transactions = rows.map((r) => {
      running += r.amount;
      return {
        date: r.date,
        // Machine value kept for the storefront's own logic; `typeLabel` is
        // the same word in the customer's language.
        type: r.type,
        typeLabel: this.loc(r.type, lang),
        reference: r.reference,
        amount: r.amount.toFixed(2),
        runningBalance: running.toFixed(2),
      };
    });

    return {
      customerId: customer.id,
      customerName: customer.name,
      transactions,
      balance: running.toFixed(2),
    };
  }

  async statementPdfForCustomer(customer: AuthenticatedCustomer, lang = 'en'): Promise<Buffer> {
    const statement = await this.statementForCustomer(customer, lang);
    const L = (s: string) => this.loc(s, lang);
    return buildPdfTable(
      `${L('Account Statement')} — ${statement.customerName}`,
      `${L('Balance')}: UGX ${statement.balance}`,
      [L('Date'), L('Type'), L('Reference'), L('Amount'), L('Running Balance')],
      statement.transactions.map((t) => [
        new Date(t.date).toLocaleDateString(),
        t.typeLabel,
        t.reference,
        t.amount,
        t.runningBalance,
      ]),
    );
  }

  async invoicePdfForCustomer(customer: AuthenticatedCustomer, id: string, lang = 'en'): Promise<Buffer> {
    const invoice = await this.getForCustomer(customer, id);
    const L = (s: string) => this.loc(s, lang);
    return buildPdfTable(
      `${L('Invoice')} ${invoice.invoiceNumber}`,
      `${customer.name} — ${L('Order')} ${invoice.orderNumber} — ${L('Status')}: ${L(invoice.status)}`,
      [L('Field'), L('Value')],
      [
        [L('Invoice Number'), invoice.invoiceNumber],
        [L('Order Number'), invoice.orderNumber ?? ''],
        [L('Amount'), `UGX ${invoice.amount}`],
        [L('Due Date'), new Date(invoice.dueDate).toLocaleDateString()],
        [L('Status'), L(invoice.status)],
        [L('Paid At'), invoice.paidAt ? new Date(invoice.paidAt).toLocaleDateString() : '—'],
      ],
    );
  }
}
