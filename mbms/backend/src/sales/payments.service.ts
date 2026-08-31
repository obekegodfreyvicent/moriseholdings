import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConflictAppException, NotFoundAppException } from '../common/app-exception';
import { AuthenticatedCustomer } from '../customer-portal/common/customer-auth.types';
import { AuditService } from '../common/audit/audit.service';
import { ContentTranslationService } from '../common/translation/content-translation.service';
import { CreatePaymentDto } from './dto/create-payment.dto';

function toPaymentResource(p: any) {
  return {
    id: p.id,
    companyId: p.companyId,
    customerId: p.customerId,
    method: p.method,
    reference: p.reference,
    amount: p.amount.toString(),
    createdAt: p.createdAt,
    invoiceIds: Array.isArray(p.allocations) ? p.allocations.map((a: any) => a.invoiceId) : undefined,
  };
}

/**
 * Judgment call (see OrdersService.createForCustomer's own comment): the
 * payment-method selector shown at checkout captures intent only — actual
 * money movement and GL posting always happens through this single flow,
 * matching screenshots/Customer/08-payment.png's "Make a Payment" screen
 * being the one place real settlement happens. A payment can cover several
 * invoices at once (the mockup's checkbox list); each is paid in full —
 * this codebase's storefront has no partial-invoice-payment UI.
 */
@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly translation: ContentTranslationService,
  ) {}

  // A payment reference (a bank / mobile-money transaction id) is matched
  // against a statement that always uses 0-9, so a customer who typed it in
  // another numeral script has its digits normalised to Western before it is
  // stored. It is an identifier, not prose — nothing else about it changes.
  private normaliseReference(reference: string | null | undefined): string | null {
    if (!reference || !reference.trim()) return null;
    return this.translation.toEnglish(reference.trim(), 'en').english || null;
  }

  async listForCustomer(customer: AuthenticatedCustomer, page: number, pageSize: number) {
    const where = { customerId: customer.id };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.payment.findMany({ where, include: { allocations: true }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
      this.prisma.payment.count({ where }),
    ]);
    return { items: rows.map(toPaymentResource), page, pageSize, total };
  }

  async createForCustomer(customer: AuthenticatedCustomer, dto: CreatePaymentDto) {
    const reference = this.normaliseReference(dto.reference);
    const invoices = await this.prisma.invoice.findMany({ where: { id: { in: dto.invoiceIds } } });
    if (invoices.length !== dto.invoiceIds.length) throw new NotFoundAppException('One or more invoices not found.');
    for (const inv of invoices) {
      if (inv.customerId !== customer.id) throw new NotFoundAppException('One or more invoices not found.');
      if (inv.paidAt) throw new ConflictAppException(`Invoice ${inv.invoiceNumber} is already paid.`);
    }

    const totalAmount = invoices.reduce((sum, inv) => sum + Number(inv.amount), 0);

    const cashAccount = await this.prisma.account.findFirst({
      where: { companyId: customer.companyId, accountSubType: { in: ['bank', 'cash'] } },
      orderBy: { accountCode: 'asc' },
    });
    const receivableAccount = await this.prisma.account.findFirst({ where: { companyId: customer.companyId, accountSubType: 'receivable' } });
    if (!cashAccount || !receivableAccount) {
      throw new ConflictAppException('This company has no Cash/Bank or Accounts Receivable account configured — contact Morise Holdings.');
    }
    const period = await this.prisma.financialPeriod.findFirst({ where: { companyId: customer.companyId, status: 'open' }, orderBy: { startDate: 'desc' } });
    if (!period) throw new ConflictAppException('This company has no open financial period — contact Morise Holdings.');

    const entryCount = await this.prisma.journalEntry.count({ where: { companyId: customer.companyId } });
    const entryNumber = `JE-${new Date().getFullYear()}-${String(entryCount + 1).padStart(4, '0')}`;

    const payment = await this.prisma.$transaction(async (tx) => {
      const journalEntry = await tx.journalEntry.create({
        data: {
          companyId: customer.companyId,
          entryNumber,
          entryDate: new Date(),
          description: `Payment received — ${invoices.map((i) => i.invoiceNumber).join(', ')}`,
          financialPeriodId: period.id,
          status: 'posted',
          createdBy: customer.id,
          postedAt: new Date(),
          items: {
            create: [
              { accountId: cashAccount.id, debitAmount: totalAmount, creditAmount: 0, description: 'Payment received' },
              { accountId: receivableAccount.id, debitAmount: 0, creditAmount: totalAmount, description: 'Accounts receivable settled' },
            ],
          },
        },
      });

      const created = await tx.payment.create({
        data: {
          companyId: customer.companyId,
          customerId: customer.id,
          method: dto.method,
          reference,
          amount: totalAmount,
          journalEntryId: journalEntry.id,
          allocations: { create: invoices.map((inv) => ({ invoiceId: inv.id, amountApplied: inv.amount })) },
        },
        include: { allocations: true },
      });

      await tx.invoice.updateMany({ where: { id: { in: invoices.map((i) => i.id) } }, data: { paidAt: new Date() } });

      return created;
    });

    await this.auditService.record({
      eventType: 'sales.payment.received',
      sourceService: 'sales-service',
      userId: customer.id,
      companyId: customer.companyId,
      entityType: 'payment',
      entityId: payment.id,
      action: 'create',
      newValue: { method: dto.method, amount: totalAmount.toString(), invoiceNumbers: invoices.map((i) => i.invoiceNumber) },
    });

    return toPaymentResource(payment);
  }
}
