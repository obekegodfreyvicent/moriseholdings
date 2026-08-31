import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConflictAppException, ForbiddenAppException, NotFoundAppException } from '../common/app-exception';
import { Paginated } from '../common/interceptors/response.interceptor';
import { AuthenticatedUser } from '../common/strategies/jwt.strategy';
import { hasGroupVisibility, isCompanyInScope } from '../common/scope.util';
import { AuditService } from '../common/audit/audit.service';
import { NotificationsService } from '../common/notifications/notifications.service';
import { AuthenticatedCustomer } from '../customer-portal/common/customer-auth.types';
import { CreateOrderDto } from './dto/create-order.dto';
import { CancelOrderDto } from './dto/cancel-order.dto';
import { evaluateDiscountCode } from '../marketing/discount.util';
import { resolveHoldingGroupCompanyIds } from '../common/company-group.util';
import { ContentTranslationService } from '../common/translation/content-translation.service';

// Content localisation (29 August 2026): the customer-typed cancellation
// reason, ready to store — English plus the customer's exact original and
// its source language. Staff always store/read English (original = null).
interface CancellationReason {
  english: string | null;
  original: string | null;
  lang: string | null;
}

const GROUP_PERM = 'sales.order.viewAll';
const MANAGE_PERM = 'sales.order.manage';
const DELIVERY_FEE = 30_000;
const VAT_RATE = 0.18;
const DEFAULT_PAYMENT_TERMS_DAYS = 30;

const STATUS_SEQUENCE = ['placed', 'confirmed', 'packed', 'out_for_delivery', 'delivered'] as const;

// Content localisation (29 August 2026): with `lang` + a translation service
// the customer-facing fields (subsidiary name, line-item product names, and
// the cancellation reason) are rendered in the customer's chosen language.
// When the customer cancelled in that same language their exact original
// wording is shown back; otherwise the stored English is glossary-translated.
// Staff callers omit both args and always get English.
export function toOrderResource(o: any, lang = 'en', translation?: ContentTranslationService) {
  const loc = (s: string | null | undefined) =>
    lang !== 'en' && translation && s != null ? (translation.toLocale(s, lang) as string) : (s ?? null);

  const cancellationReason =
    o.cancellationSourceLanguage && o.cancellationSourceLanguage === lang && o.cancellationReasonOriginal != null
      ? o.cancellationReasonOriginal
      : loc(o.cancellationReason);

  return {
    id: o.id,
    orderNumber: o.orderNumber,
    companyId: o.companyId,
    companyName: loc(o.company?.name ?? null),
    customerId: o.customerId,
    status: o.status,
    deliveryAddressId: o.deliveryAddressId,
    requestedDeliveryDate: o.requestedDeliveryDate,
    paymentMethodPreference: o.paymentMethodPreference,
    subtotal: o.subtotal.toString(),
    deliveryFee: o.deliveryFee.toString(),
    vatAmount: o.vatAmount.toString(),
    discountCode: o.discountCode ?? null,
    discountAmount: (o.discountAmount ?? 0).toString(),
    totalAmount: o.totalAmount.toString(),
    cancelledAt: o.cancelledAt,
    cancellationReason,
    // Always exposed so the admin app can show a customer's exact words
    // alongside the English (a "show original" toggle, like Support tickets).
    cancellationReasonOriginal: o.cancellationReasonOriginal ?? null,
    cancellationSourceLanguage: o.cancellationSourceLanguage ?? null,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
    items: Array.isArray(o.items)
      ? o.items.map((i: any) => ({
          id: i.id,
          productId: i.productId,
          productName: loc(i.productName),
          unitPrice: i.unitPrice.toString(),
          quantity: i.quantity,
          subtotal: i.subtotal.toString(),
        }))
      : undefined,
    invoice: o.invoice
      ? {
          id: o.invoice.id,
          invoiceNumber: o.invoice.invoiceNumber,
          amount: o.invoice.amount.toString(),
          dueDate: o.invoice.dueDate,
          paidAt: o.invoice.paidAt,
        }
      : undefined,
    trackerSteps:
      o.status === 'cancelled'
        ? null
        : STATUS_SEQUENCE.map((step, idx) => ({
            step,
            completed: idx <= STATUS_SEQUENCE.indexOf(o.status),
          })),
  };
}

const ORDER_INCLUDE = { items: true, invoice: true, company: { select: { name: true } } };

/**
 * Sprint 16 (Customer Storefront) — used by both the customer-facing
 * controller (create/list/get/cancel one's own orders) and the staff-facing
 * controller (list/get/advance any in-scope order), the same "one shared
 * service, two differently-scoped controllers" shape NotificationsService
 * already uses across Expenses/Assets/etc.
 */
@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
    private readonly translation: ContentTranslationService,
  ) {}

  // ---------------------------- Customer-facing ----------------------------

  async listForCustomer(
    customer: AuthenticatedCustomer,
    page: number,
    pageSize: number,
    filters: { status?: string },
    lang = 'en',
  ) {
    const where: any = { customerId: customer.id };
    if (filters.status) where.status = filters.status;
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({ where, include: ORDER_INCLUDE, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
      this.prisma.order.count({ where }),
    ]);
    return { items: rows.map((r) => toOrderResource(r, lang, this.translation)), page, pageSize, total } as Paginated<unknown>;
  }

  async getForCustomer(customer: AuthenticatedCustomer, id: string, lang = 'en') {
    const order = await this.prisma.order.findUnique({ where: { id }, include: ORDER_INCLUDE });
    if (!order || order.customerId !== customer.id) throw new NotFoundAppException('Order not found.');
    return toOrderResource(order, lang, this.translation);
  }

  // POST /customer-portal/orders — places an order and, in the same
  // transaction, generates its invoice and posts a balanced sale entry (Dr
  // Accounts Receivable, Cr Sales Revenue). Judgment call: dto.
  // paymentMethodPreference is stored as stated intent only — actual money
  // movement and GL posting always happens later through PaymentsService,
  // never here, since this codebase has no real payment gateway to execute
  // a "pay now" choice against anyway. Every order is therefore invoiced on
  // credit, so the credit-limit check below applies unconditionally, not
  // only to an "on account" choice.
  async createForCustomer(customer: AuthenticatedCustomer, dto: CreateOrderDto, lang = 'en') {
    const productIds = dto.items.map((i) => i.productId);
    const products = await this.prisma.product.findMany({ where: { id: { in: productIds } } });
    const productById = new Map(products.map((p) => [p.id, p]));

    // Storefront group catalogue (29 August 2026): the storefront now sells
    // every Morise subsidiary's products in one shop, so an item's owning
    // company may not be the customer's own selling company — but it must be
    // one of the subsidiaries in the customer's holding group. The order (and
    // its invoice + GL posting) belongs to the *selling* subsidiary, so a
    // single call must not mix subsidiaries; the storefront splits a
    // multi-subsidiary cart into one order per company and posts them in
    // turn.
    const groupCompanyIds = await resolveHoldingGroupCompanyIds(this.prisma, customer.companyId);
    const sellingCompanyIds = new Set<string>();

    const items = dto.items.map((i) => {
      const product = productById.get(i.productId);
      if (!product || !groupCompanyIds.includes(product.companyId) || product.status !== 'active' || product.unitPrice === null) {
        throw new NotFoundAppException(`Product ${i.productId} is not available for order.`);
      }
      sellingCompanyIds.add(product.companyId);
      const unitPrice = Number(product.unitPrice);
      return { productId: product.id, productName: product.name, unitPrice, quantity: i.quantity, subtotal: unitPrice * i.quantity };
    });

    if (sellingCompanyIds.size > 1) {
      throw new ConflictAppException(
        'This order mixes products from more than one Morise company. Check out each company separately.',
      );
    }
    const orderCompanyId = [...sellingCompanyIds][0];

    let deliveryAddressId = dto.deliveryAddressId ?? null;
    if (deliveryAddressId) {
      const address = await this.prisma.deliveryAddress.findUnique({ where: { id: deliveryAddressId } });
      if (!address || address.customerId !== customer.id) throw new NotFoundAppException('Delivery address not found.');
    } else {
      const defaultAddress = await this.prisma.deliveryAddress.findFirst({ where: { customerId: customer.id, isDefault: true } });
      deliveryAddressId = defaultAddress?.id ?? null;
    }

    const subtotal = items.reduce((sum, i) => sum + i.subtotal, 0);

    // Marketing & Promos (28 August 2026): re-validate the discount code
    // server-side and compute the amount off the subtotal. An invalid code
    // is rejected here rather than silently ignored, so the customer never
    // sees a total that differs from what the cart showed.
    let discountAmount = 0;
    let appliedCode: { id: string; code: string } | null = null;
    // A discount code the customer typed is matched in canonical form —
    // digits normalised to 0-9 (a code entered as "SAVE١٠" still finds
    // "SAVE10"), then upper-cased. Content localisation, 30 August 2026.
    const rawCode = dto.discountCode
      ? this.translation.toEnglish(dto.discountCode.trim(), 'en').english.toUpperCase()
      : undefined;
    if (rawCode) {
      const codeRow = await this.prisma.discountCode.findFirst({
        where: { companyId: orderCompanyId, code: rawCode },
      });
      const evaluation = evaluateDiscountCode(codeRow as any, subtotal);
      if (!evaluation.ok) {
        throw new ConflictAppException(evaluation.reason ?? 'That discount code cannot be applied.');
      }
      discountAmount = evaluation.discountAmount;
      appliedCode = { id: codeRow!.id, code: codeRow!.code };
    }

    const discountedSubtotal = subtotal - discountAmount;
    const vatAmount = Math.round(discountedSubtotal * VAT_RATE);
    const totalAmount = discountedSubtotal + DELIVERY_FEE + vatAmount;

    const customerRecord = await this.prisma.customer.findUniqueOrThrow({ where: { id: customer.id } });
    if (customerRecord.creditLimit !== null) {
      const outstanding = await this.outstandingBalance(customer.id);
      if (outstanding + totalAmount > Number(customerRecord.creditLimit)) {
        throw new ConflictAppException(
          `This order (UGX ${totalAmount.toLocaleString()}) would exceed your credit limit — outstanding balance UGX ${outstanding.toLocaleString()} of UGX ${Number(customerRecord.creditLimit).toLocaleString()}.`,
        );
      }
    }

    const receivableAccount = await this.prisma.account.findFirst({ where: { companyId: orderCompanyId, accountSubType: 'receivable' } });
    const revenueAccount = await this.prisma.account.findFirst({ where: { companyId: orderCompanyId, accountType: 'revenue' }, orderBy: { accountCode: 'asc' } });
    if (!receivableAccount || !revenueAccount) {
      throw new ConflictAppException('This company has no Accounts Receivable / Sales Revenue account configured — contact Morise Holdings.');
    }
    const period = await this.prisma.financialPeriod.findFirst({ where: { companyId: orderCompanyId, status: 'open' }, orderBy: { startDate: 'desc' } });
    if (!period) {
      throw new ConflictAppException('This company has no open financial period — contact Morise Holdings.');
    }

    const orderCount = await this.prisma.order.count({ where: { companyId: orderCompanyId } });
    const orderNumber = `ORD-${new Date().getFullYear()}-${String(orderCount + 1).padStart(4, '0')}`;
    const invoiceCount = await this.prisma.invoice.count({ where: { companyId: orderCompanyId } });
    const invoiceNumber = `INV-${new Date().getFullYear()}-${String(invoiceCount + 1).padStart(4, '0')}`;
    const entryCount = await this.prisma.journalEntry.count({ where: { companyId: orderCompanyId } });
    const entryNumber = `JE-${new Date().getFullYear()}-${String(entryCount + 1).padStart(4, '0')}`;

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + (customerRecord.paymentTermsDays ?? DEFAULT_PAYMENT_TERMS_DAYS));

    const { order, invoice } = await this.prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          orderNumber,
          companyId: orderCompanyId,
          customerId: customer.id,
          deliveryAddressId,
          requestedDeliveryDate: dto.requestedDeliveryDate ? new Date(dto.requestedDeliveryDate) : null,
          paymentMethodPreference: dto.paymentMethodPreference,
          subtotal,
          deliveryFee: DELIVERY_FEE,
          vatAmount,
          discountCode: appliedCode?.code ?? null,
          discountAmount,
          totalAmount,
          items: { create: items },
        },
        include: ORDER_INCLUDE,
      });

      if (appliedCode) {
        await tx.discountCode.update({
          where: { id: appliedCode.id },
          data: { timesRedeemed: { increment: 1 } },
        });
      }

      const saleEntry = await tx.journalEntry.create({
        data: {
          companyId: orderCompanyId,
          entryNumber,
          entryDate: new Date(),
          description: `Sale — order ${orderNumber} (${customerRecord.name})`,
          financialPeriodId: period.id,
          status: 'posted',
          createdBy: customer.id,
          postedAt: new Date(),
          items: {
            create: [
              { accountId: receivableAccount.id, debitAmount: totalAmount, creditAmount: 0, description: 'Accounts receivable — customer order' },
              { accountId: revenueAccount.id, debitAmount: 0, creditAmount: totalAmount, description: 'Sales revenue — customer order' },
            ],
          },
        },
      });

      const createdInvoice = await tx.invoice.create({
        data: {
          invoiceNumber,
          companyId: orderCompanyId,
          customerId: customer.id,
          orderId: created.id,
          amount: totalAmount,
          dueDate,
          journalEntryId: saleEntry.id,
        },
      });

      return { order: created, invoice: createdInvoice };
    });

    await this.auditService.record({
      eventType: 'sales.order.placed',
      sourceService: 'sales-service',
      userId: customer.id,
      companyId: orderCompanyId,
      entityType: 'order',
      entityId: order.id,
      action: 'create',
      newValue: {
        orderNumber,
        totalAmount: totalAmount.toString(),
        invoiceNumber,
        discountCode: appliedCode?.code ?? null,
        discountAmount: discountAmount.toString(),
      },
    });

    const staffIds = await this.notificationsService.findUsersWithPermissionInCompany(orderCompanyId, MANAGE_PERM);
    await this.notificationsService.notifyUsers(staffIds, {
      companyId: orderCompanyId,
      type: 'sales.order.placed',
      title: `New order ${orderNumber} from ${customerRecord.name} — UGX ${totalAmount.toLocaleString()}`,
      entityType: 'order',
      entityId: order.id,
    });

    return toOrderResource({ ...order, invoice }, lang, this.translation);
  }

  async cancelForCustomer(customer: AuthenticatedCustomer, id: string, dto: CancelOrderDto, lang = 'en') {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order || order.customerId !== customer.id) throw new NotFoundAppException('Order not found.');

    // Store the reason in English; keep the customer's exact wording +
    // source language when they cancelled in a non-English language.
    let reason: CancellationReason = { english: null, original: null, lang: null };
    if (dto.reason && dto.reason.trim()) {
      const raw = dto.reason.trim();
      const { english, changed } = this.translation.toEnglish(raw, lang);
      reason = {
        english: english || raw,
        original: lang !== 'en' && changed ? raw : null,
        lang: lang !== 'en' ? lang : null,
      };
    }
    return this.cancel(order, customer.id, reason, lang);
  }

  // -------------------------------- Staff-facing ----------------------------

  async listForStaff(user: AuthenticatedUser, page: number, pageSize: number, filters: { companyId?: string; status?: string }) {
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
    }
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({ where, include: ORDER_INCLUDE, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
      this.prisma.order.count({ where }),
    ]);
    return { items: rows.map((r) => toOrderResource(r)), page, pageSize, total } as Paginated<unknown>;
  }

  async getForStaff(user: AuthenticatedUser, id: string) {
    const order = await this.findOrThrow(id);
    if (!isCompanyInScope(user, order.companyId, GROUP_PERM)) throw new NotFoundAppException('Order not found.');
    return toOrderResource(order);
  }

  // POST /sales/orders/{id}/advance-status — one step at a time through
  // STATUS_SEQUENCE, the same single-action-repeated-per-step shape Asset
  // disposal's request/approve/dispose already uses.
  async advanceStatus(user: AuthenticatedUser, id: string) {
    const order = await this.findOrThrow(id);
    if (!isCompanyInScope(user, order.companyId, GROUP_PERM)) throw new NotFoundAppException('Order not found.');
    if (!user.permissions.includes(MANAGE_PERM)) {
      throw new ForbiddenAppException(`Your role does not include the "${MANAGE_PERM}" permission required for this action.`);
    }

    const currentIdx = STATUS_SEQUENCE.indexOf(order.status as (typeof STATUS_SEQUENCE)[number]);
    if (currentIdx === -1 || currentIdx === STATUS_SEQUENCE.length - 1) {
      throw new ConflictAppException(`Cannot advance an order with status "${order.status}".`);
    }
    const nextStatus = STATUS_SEQUENCE[currentIdx + 1];

    const updated = await this.prisma.order.update({ where: { id }, data: { status: nextStatus }, include: ORDER_INCLUDE });
    await this.auditService.record({
      eventType: 'sales.order.status_advanced',
      sourceService: 'sales-service',
      userId: user.id,
      companyId: updated.companyId,
      entityType: 'order',
      entityId: updated.id,
      action: 'update',
      previousValue: { status: order.status },
      newValue: { status: nextStatus },
    });
    return toOrderResource(updated);
  }

  async cancelForStaff(user: AuthenticatedUser, id: string, dto: CancelOrderDto) {
    const order = await this.findOrThrow(id);
    if (!isCompanyInScope(user, order.companyId, GROUP_PERM)) throw new NotFoundAppException('Order not found.');
    if (!user.permissions.includes(MANAGE_PERM)) {
      throw new ForbiddenAppException(`Your role does not include the "${MANAGE_PERM}" permission required for this action.`);
    }
    // Staff type English; no translation, no original.
    return this.cancel(order, user.id, { english: dto.reason ?? null, original: null, lang: null });
  }

  // ------------------------------- Shared ------------------------------------

  // Only while placed/confirmed (before physical fulfillment begins) — a
  // packed/out-for-delivery order has already left the warehouse and isn't
  // cancellable through this endpoint. Reverses the sale entry (Dr Sales
  // Revenue, Cr Accounts Receivable) rather than deleting anything, per
  // this codebase's own "status-not-hard-delete" convention — the invoice
  // row is kept for history but excluded from outstanding-balance/overdue
  // calculations by InvoicesService, which always checks order.status.
  private async cancel(
    order: { id: string; status: string; companyId: string; orderNumber: string; totalAmount: any },
    actorId: string,
    reason: CancellationReason,
    lang = 'en',
  ) {
    if (order.status !== 'placed' && order.status !== 'confirmed') {
      throw new ConflictAppException(`Cannot cancel an order with status "${order.status}" — it has already entered fulfillment.`);
    }

    const invoice = await this.prisma.invoice.findUnique({ where: { orderId: order.id } });
    const updated = await this.prisma.$transaction(async (tx) => {
      const cancelled = await tx.order.update({
        where: { id: order.id },
        data: {
          status: 'cancelled',
          cancelledAt: new Date(),
          cancellationReason: reason.english ?? null,
          cancellationReasonOriginal: reason.original ?? null,
          cancellationSourceLanguage: reason.lang ?? null,
        },
        include: ORDER_INCLUDE,
      });

      if (invoice && !invoice.paidAt) {
        const receivableAccount = await tx.account.findFirst({ where: { companyId: order.companyId, accountSubType: 'receivable' } });
        const revenueAccount = await tx.account.findFirst({ where: { companyId: order.companyId, accountType: 'revenue' }, orderBy: { accountCode: 'asc' } });
        const period = await tx.financialPeriod.findFirst({ where: { companyId: order.companyId, status: 'open' }, orderBy: { startDate: 'desc' } });
        if (receivableAccount && revenueAccount && period) {
          const entryCount = await tx.journalEntry.count({ where: { companyId: order.companyId } });
          await tx.journalEntry.create({
            data: {
              companyId: order.companyId,
              entryNumber: `JE-${new Date().getFullYear()}-${String(entryCount + 1).padStart(4, '0')}`,
              entryDate: new Date(),
              description: `Sale reversal — order ${order.orderNumber} cancelled`,
              financialPeriodId: period.id,
              status: 'posted',
              createdBy: actorId,
              postedAt: new Date(),
              items: {
                create: [
                  { accountId: revenueAccount.id, debitAmount: invoice.amount, creditAmount: 0, description: 'Sales revenue reversal — order cancelled' },
                  { accountId: receivableAccount.id, debitAmount: 0, creditAmount: invoice.amount, description: 'Accounts receivable reversal — order cancelled' },
                ],
              },
            },
          });
        }
      }

      return cancelled;
    });

    await this.auditService.record({
      eventType: 'sales.order.cancelled',
      sourceService: 'sales-service',
      userId: actorId,
      companyId: order.companyId,
      entityType: 'order',
      entityId: order.id,
      action: 'update',
      previousValue: { status: order.status },
      newValue: { status: 'cancelled', reason: reason.english ?? null },
    });
    return toOrderResource(updated, lang, this.translation);
  }

  private async outstandingBalance(customerId: string): Promise<number> {
    const invoices = await this.prisma.invoice.findMany({
      where: { customerId, paidAt: null, order: { status: { not: 'cancelled' } } },
      select: { amount: true },
    });
    return invoices.reduce((sum, inv) => sum + Number(inv.amount), 0);
  }

  private async findOrThrow(id: string) {
    const order = await this.prisma.order.findUnique({ where: { id }, include: ORDER_INCLUDE });
    if (!order) throw new NotFoundAppException('Order not found.');
    return order;
  }
}
