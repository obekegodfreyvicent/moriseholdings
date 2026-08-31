import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundAppException } from '../../common/app-exception';
import { ContentTranslationService } from '../../common/translation/content-translation.service';
import { resolveHoldingCompany } from '../../common/company-group.util';
import { AuthenticatedCustomer } from '../common/customer-auth.types';
import { OrdersService } from '../../sales/orders.service';
import { InvoicesService } from '../../sales/invoices.service';
import { SupportService } from '../../support/support.service';
import { UpdateCustomerProfileDto } from './dto/update-customer-profile.dto';
import { CreateDeliveryAddressDto } from './dto/create-delivery-address.dto';

function toProfileResource(
  c: any,
  extra: Record<string, unknown> = {},
  lang = 'en',
  translation?: ContentTranslationService,
) {
  // Content localisation (29 August 2026): `name` / `address` are stored in
  // English; show the customer their own wording back when they are browsing
  // in the language they typed it in, otherwise glossary-translate the stored
  // English. Every other read field (company / branch / holding names, which
  // are database words) is also rendered in the chosen language as far as the
  // glossary reaches. The admin CRM always reads the English columns.
  const useOriginal = (src: string | undefined) => lang !== 'en' && src === lang;
  const own = (en: string | null, orig: string | null) =>
    useOriginal(c.sourceLanguage) && orig != null
      ? orig
      : lang !== 'en' && translation
        ? (translation.toLocale(en, lang) as string | null)
        : en;
  const loc = (s: string | null | undefined) =>
    lang !== 'en' && translation ? (translation.toLocale(s ?? null, lang) as string | null) : (s ?? null);
  return {
    id: c.id,
    name: own(c.name, c.nameOriginal ?? null),
    accountNumber: c.accountNumber,
    category: c.category,
    contactEmail: c.contactEmail,
    contactPhone: c.contactPhone,
    address: own(c.address ?? null, c.addressOriginal ?? null),
    creditLimit: c.creditLimit?.toString() ?? null,
    paymentTermsDays: c.paymentTermsDays,
    // Storefront group catalogue (29 August 2026): which subsidiary and
    // branch the customer's account belongs to, plus the holding company —
    // so the storefront can always tell the customer "you buy through
    // <subsidiary> · <branch>, part of <holding>".
    companyId: c.companyId,
    companyName: loc(c.company?.name ?? null),
    homeBranchId: c.homeBranchId ?? null,
    homeBranchName: loc(c.homeBranch?.name ?? null),
    homeBranchAddress: loc(c.homeBranch?.address ?? null),
    ...extra,
  };
}

// Content localisation (27 Aug 2026): show the customer their own wording
// back only when the language they are browsing in matches the one they
// typed it in; otherwise (including the English/canonical view) show the
// stored English, glossary-translated to the requested language.
function toAddressResource(a: any, lang = 'en', translation?: ContentTranslationService) {
  const useOriginal = lang !== 'en' && a.sourceLanguage === lang;
  const loc = (en: string, orig: string | null) =>
    useOriginal && orig != null ? orig : lang !== 'en' && translation ? (translation.toLocale(en, lang) as string) : en;
  return {
    id: a.id,
    label: loc(a.label, a.labelOriginal ?? null),
    addressLine: loc(a.addressLine, a.addressLineOriginal ?? null),
    isDefault: a.isDefault,
  };
}

const IN_PROGRESS_STATUSES = new Set(['placed', 'confirmed', 'packed', 'out_for_delivery']);

@Injectable()
export class CustomerAccountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ordersService: OrdersService,
    private readonly invoicesService: InvoicesService,
    private readonly supportService: SupportService,
    private readonly translation: ContentTranslationService,
  ) {}

  async getProfile(customer: AuthenticatedCustomer, lang = 'en') {
    const record = await this.prisma.customer.findUniqueOrThrow({
      where: { id: customer.id },
      include: { homeBranch: { select: { name: true, address: true } } },
    });
    const [company, holding] = await Promise.all([
      this.prisma.company.findUnique({ where: { id: record.companyId }, select: { name: true } }),
      resolveHoldingCompany(this.prisma, record.companyId),
    ]);
    return toProfileResource(
      { ...record, company },
      {
        holdingCompanyId: holding.id,
        holdingCompanyName: lang !== 'en' ? this.translation.toLocale(holding.name, lang) : holding.name,
      },
      lang,
      this.translation,
    );
  }

  // "Primary Contact" in the My Account mockup has no dedicated schema
  // field (Customer.name is the company name, not a contact person) — only
  // the fields that actually exist are editable here; adding a distinct
  // contact-person column is a real, but separate, schema decision left for
  // if/when this portal needs it.
  //
  // Content localisation (29 August 2026): whatever language the customer
  // edits their profile in, `name` and `address` are normalised to English
  // for storage (glossary + provider seam), with the source language and
  // their exact wording kept on the row. Numerals a customer typed in a
  // non-Western script (e.g. an Arabic-Indic phone number) are always
  // normalised to 0-9.
  async updateProfile(customer: AuthenticatedCustomer, dto: UpdateCustomerProfileDto, sourceLang = 'en') {
    const lang = this.translation.resolveLang(sourceLang);
    const keep = lang !== 'en';
    const data: Record<string, unknown> = { ...dto };

    if (dto.address !== undefined) {
      data.address = this.translation.toEnglish(dto.address ?? '', lang).english || null;
      data.addressOriginal = keep && dto.address ? dto.address : null;
    }
    if (dto.contactPhone !== undefined && dto.contactPhone) {
      // digits only — never translated, just script-normalised to 0-9.
      data.contactPhone = this.translation.toEnglish(dto.contactPhone, lang).english;
    }
    if (keep) data.sourceLanguage = lang;

    await this.prisma.customer.update({ where: { id: customer.id }, data: data as any });
    return this.getProfile(customer, lang);
  }

  async listAddresses(customer: AuthenticatedCustomer, lang = 'en') {
    const rows = await this.prisma.deliveryAddress.findMany({ where: { customerId: customer.id }, orderBy: { createdAt: 'asc' } });
    return rows.map((a) => toAddressResource(a, lang, this.translation));
  }

  // `label`/`addressLine` are normalised to English for storage; when the
  // customer typed them in another language the source language + original
  // wording are kept on the row.
  async createAddress(customer: AuthenticatedCustomer, dto: CreateDeliveryAddressDto, sourceLang = 'en') {
    if (dto.isDefault) {
      await this.prisma.deliveryAddress.updateMany({ where: { customerId: customer.id }, data: { isDefault: false } });
    }
    const lang = this.translation.resolveLang(sourceLang);
    const keep = lang !== 'en';
    const created = await this.prisma.deliveryAddress.create({
      data: {
        customerId: customer.id,
        label: this.translation.toEnglish(dto.label, lang).english,
        addressLine: this.translation.toEnglish(dto.addressLine, lang).english,
        isDefault: dto.isDefault ?? false,
        sourceLanguage: lang,
        labelOriginal: keep ? dto.label : null,
        addressLineOriginal: keep ? dto.addressLine : null,
      },
    });
    return toAddressResource(created, lang, this.translation);
  }

  async updateAddress(customer: AuthenticatedCustomer, id: string, dto: CreateDeliveryAddressDto, sourceLang = 'en') {
    const address = await this.prisma.deliveryAddress.findUnique({ where: { id } });
    if (!address || address.customerId !== customer.id) throw new NotFoundAppException('Delivery address not found.');
    if (dto.isDefault) {
      await this.prisma.deliveryAddress.updateMany({ where: { customerId: customer.id }, data: { isDefault: false } });
    }
    const lang = this.translation.resolveLang(sourceLang);
    const keep = lang !== 'en';
    const updated = await this.prisma.deliveryAddress.update({
      where: { id },
      data: {
        label: this.translation.toEnglish(dto.label, lang).english,
        addressLine: this.translation.toEnglish(dto.addressLine, lang).english,
        isDefault: dto.isDefault ?? address.isDefault,
        sourceLanguage: lang,
        labelOriginal: keep ? dto.label : null,
        addressLineOriginal: keep ? dto.addressLine : null,
      },
    });
    return toAddressResource(updated, lang, this.translation);
  }

  // GET /customer-portal/dashboard-summary — every tile on the Home
  // screen's KPI row plus its Recent Orders widget, computed here once so
  // the figures can never drift between the dashboard and the screens they
  // summarize (Orders, Invoices & Payments, Support).
  async dashboardSummary(customer: AuthenticatedCustomer, lang = 'en') {
    const [invoiceSummary, orders, tickets, record] = await Promise.all([
      this.invoicesService.summaryForCustomer(customer),
      this.ordersService.listForCustomer(customer, 1, 100, {}, lang),
      this.supportService.listForCustomer(customer, 1, 100),
      this.prisma.customer.findUniqueOrThrow({ where: { id: customer.id } }),
    ]);
    const ordersInProgress = (orders.items as any[]).filter((o) => IN_PROGRESS_STATUSES.has(o.status)).length;
    const openTickets = (tickets.items as any[]).filter((t) => t.status !== 'resolved' && t.status !== 'closed').length;

    return {
      accountBalance: invoiceSummary.totalOutstanding,
      overdueInvoiceCount: invoiceSummary.overdueCount,
      ordersInProgress,
      openTickets,
      creditLimit: record.creditLimit?.toString() ?? null,
      creditUtilizedPercent: record.creditLimit ? Math.round((Number(invoiceSummary.totalOutstanding) / Number(record.creditLimit)) * 100) : null,
      recentOrders: (orders.items as any[]).slice(0, 3),
    };
  }
}
