import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundAppException } from '../../common/app-exception';
import { ContentTranslationService } from '../../common/translation/content-translation.service';
import { resolveHoldingGroupCompanyIds, resolveHoldingCompany } from '../../common/company-group.util';
import { AuthenticatedCustomer } from '../common/customer-auth.types';

function toResource(p: any) {
  return {
    id: p.id,
    categoryId: p.categoryId,
    categoryName: p.category?.name ?? null,
    // Untranslated English category name, so the storefront can still key its
    // per-category icon off a stable value after `categoryName` is localised.
    categoryNameEn: p.category?.name ?? null,
    productCode: p.productCode,
    productType: p.productType,
    name: p.name,
    description: p.description,
    unitOfMeasure: p.unitOfMeasure,
    unitPrice: p.unitPrice?.toString() ?? null,
    stockQuantity: p.stockQuantity,
    // Storefront group catalogue (29 August 2026): every listing is tagged
    // with the subsidiary that sells it and the branch that produces /
    // stocks / fulfils it, so the customer always knows exactly who they are
    // buying from.
    companyId: p.companyId,
    companyName: p.company?.name ?? null,
    branchId: p.branchId,
    branchName: p.branch?.name ?? null,
    branchAddress: p.branch?.address ?? null,
  };
}

// Read-only. Since the Customer Storefront became a **group** shop
// (29 August 2026) the scope is the whole holding group the customer's
// selling company belongs to — the root holding company plus every active
// subsidiary — not the single companyId on the customer row. Each product is
// returned tagged with its owning subsidiary and its branch.
//
// Content localisation (27 August 2026): catalogue text (category name,
// product name, unit of measure, and the parts of the description the
// glossary reaches) is rendered in the customer's language, chosen from the
// Accept-Language header. Database rows are unchanged — the mapping happens
// on the way out.
@Injectable()
export class CustomerCatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly translation: ContentTranslationService,
  ) {}

  private localise(r: ReturnType<typeof toResource>, lang: string) {
    if (lang === 'en') return r;
    // Content localisation (29 August 2026): the subsidiary and branch a
    // product is tagged with are shown in the customer's language too, as far
    // as the glossary reaches (company / branch proper nouns largely pass
    // through; "Warehouse", "Forwarding", "Border", "Office" etc. translate).
    return this.translation.localiseFields(r, lang, [
      'categoryName',
      'name',
      'description',
      'unitOfMeasure',
      'companyName',
      'branchName',
      'branchAddress',
    ]);
  }

  private groupIds(customer: AuthenticatedCustomer) {
    return resolveHoldingGroupCompanyIds(this.prisma, customer.companyId);
  }

  // companyId is a logical reference on Product / ProductCategory (no
  // Prisma relation), so resolve the names in one extra query.
  private async companyNames(ids: string[]): Promise<Map<string, string>> {
    const unique = [...new Set(ids)].filter(Boolean);
    if (unique.length === 0) return new Map();
    const rows = await this.prisma.company.findMany({ where: { id: { in: unique } }, select: { id: true, name: true } });
    return new Map(rows.map((r) => [r.id, r.name]));
  }

  // Only priced, active products are visible — an unpriced product is
  // staff-incomplete data (unitPrice is nullable so existing seed products
  // don't break), not something to show at UGX 0.
  async listProducts(
    customer: AuthenticatedCustomer,
    filters: { categoryId?: string; search?: string; companyId?: string; branchId?: string },
    lang = 'en',
  ) {
    const groupIds = await this.groupIds(customer);
    const companyFilter =
      filters.companyId && groupIds.includes(filters.companyId) ? filters.companyId : { in: groupIds };
    const where: any = { companyId: companyFilter, status: 'active', unitPrice: { not: null } };
    if (filters.categoryId) where.categoryId = filters.categoryId;
    if (filters.branchId) where.branchId = filters.branchId;
    if (filters.search) where.name = { contains: filters.search, mode: 'insensitive' };
    const rows = await this.prisma.product.findMany({
      where,
      include: { category: true, branch: { select: { name: true, address: true } } },
      orderBy: { name: 'asc' },
    });
    const names = await this.companyNames(rows.map((p) => p.companyId));
    const mapped = rows.map((p) => this.localise(toResource({ ...p, company: { name: names.get(p.companyId) ?? null } }), lang));
    return mapped.sort((a, b) => (a.companyName || '').localeCompare(b.companyName || '') || a.name.localeCompare(b.name));
  }

  async getProduct(customer: AuthenticatedCustomer, id: string, lang = 'en') {
    const groupIds = await this.groupIds(customer);
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { category: true, branch: { select: { name: true, address: true } } },
    });
    if (!product || !groupIds.includes(product.companyId) || product.status !== 'active' || product.unitPrice === null) {
      throw new NotFoundAppException('Product not found.');
    }
    const names = await this.companyNames([product.companyId]);
    return this.localise(toResource({ ...product, company: { name: names.get(product.companyId) ?? null } }), lang);
  }

  async listCategories(customer: AuthenticatedCustomer, lang = 'en') {
    const groupIds = await this.groupIds(customer);
    const rows = await this.prisma.productCategory.findMany({
      where: { companyId: { in: groupIds } },
      orderBy: { name: 'asc' },
    });
    const names = await this.companyNames(rows.map((c) => c.companyId));
    return rows.map((c) => ({
      id: c.id,
      name: lang === 'en' ? c.name : this.translation.toLocale(c.name, lang),
      nameEn: c.name,
      parentCategoryId: c.parentCategoryId,
      companyId: c.companyId,
      companyName: lang === 'en' ? (names.get(c.companyId) ?? null) : (this.translation.toLocale(names.get(c.companyId) ?? null, lang) ?? null),
    }));
  }

  // GET /customer-portal/catalog/subsidiaries — the "which companies make up
  // this storefront" directory the group-shop landing page and catalogue
  // filter are built from. Lists every subsidiary in the group that has at
  // least one priced, active product, with its branch list and counts, plus
  // the name of the holding company at the top.
  async listSubsidiaries(customer: AuthenticatedCustomer, lang = 'en') {
    const groupIds = await this.groupIds(customer);
    const holding = await resolveHoldingCompany(this.prisma, customer.companyId);
    const loc = (s: string | null | undefined) =>
      lang === 'en' ? (s ?? null) : (this.translation.toLocale(s, lang) ?? null);

    const companies = await this.prisma.company.findMany({
      where: { id: { in: groupIds }, status: 'active' },
      select: {
        id: true,
        name: true,
        relationshipType: true,
        parentCompanyId: true,
        branches: { where: { status: 'active' }, select: { id: true, name: true, address: true }, orderBy: { name: 'asc' } },
      },
      orderBy: { name: 'asc' },
    });

    const productCounts = await this.prisma.product.groupBy({
      by: ['companyId'],
      where: { companyId: { in: groupIds }, status: 'active', unitPrice: { not: null } },
      _count: { _all: true },
    });
    const countByCompany = new Map(productCounts.map((r) => [r.companyId, r._count._all]));

    const subsidiaries = companies
      .filter((c) => c.id !== holding.id) // the holding company itself is not a shopfront
      .map((c) => ({
        id: c.id,
        name: loc(c.name),
        relationshipType: c.relationshipType,
        branchCount: c.branches.length,
        productCount: countByCompany.get(c.id) ?? 0,
        branches: c.branches.map((b) => ({ id: b.id, name: loc(b.name), address: loc(b.address) })),
      }))
      .sort((a, b) => b.productCount - a.productCount || (a.name ?? '').localeCompare(b.name ?? ''));

    return {
      holdingCompanyId: holding.id,
      holdingCompanyName: loc(holding.name),
      subsidiaries,
    };
  }

  // GET /customer-portal/public/overview — the pre-login corporate site
  // (holding-company landing, Companies directory, Group Overview) is built
  // from this. Unlike listSubsidiaries it takes no customer: the holding
  // group is the same for every visitor, so the root holding company is
  // resolved directly (the one active company with no parent). Every
  // subsidiary is listed — including those with no priced catalogue yet —
  // with its branches, ownership and counts, plus roll-up group figures.
  async listGroupOverview(lang = 'en') {
    const holding = await this.prisma.company.findFirst({
      where: { parentCompanyId: null, status: 'active' },
      select: { id: true, name: true, address: true, contactEmail: true, contactPhone: true, currency: true },
      orderBy: { createdAt: 'asc' },
    });

    if (!holding) {
      return {
        holdingCompany: null,
        figures: { subsidiaries: 0, branches: 0, products: 0, categories: 0 },
        subsidiaries: [] as any[],
      };
    }

    const loc = (s: string | null | undefined) =>
      lang === 'en' ? (s ?? null) : (this.translation.toLocale(s, lang) ?? null);

    const groupIds = await resolveHoldingGroupCompanyIds(this.prisma, holding.id);
    const subIds = groupIds.filter((id) => id !== holding.id);

    const companies = await this.prisma.company.findMany({
      where: { id: { in: subIds }, status: 'active' },
      select: {
        id: true,
        name: true,
        address: true,
        relationshipType: true,
        ownershipPercent: true,
        currency: true,
        branches: { where: { status: 'active' }, select: { id: true, name: true, address: true }, orderBy: { name: 'asc' } },
      },
      orderBy: { name: 'asc' },
    });

    const productCounts = await this.prisma.product.groupBy({
      by: ['companyId'],
      where: { companyId: { in: subIds }, status: 'active', unitPrice: { not: null } },
      _count: { _all: true },
    });
    const countByCompany = new Map(productCounts.map((r) => [r.companyId, r._count._all]));

    const categoryCount = await this.prisma.productCategory.count({ where: { companyId: { in: subIds } } });

    const subsidiaries = companies
      .map((c) => ({
        id: c.id,
        name: loc(c.name),
        address: loc(c.address),
        relationshipType: c.relationshipType,
        ownershipPercent: c.ownershipPercent != null ? Number(c.ownershipPercent) : null,
        currency: c.currency,
        branchCount: c.branches.length,
        productCount: countByCompany.get(c.id) ?? 0,
        branches: c.branches.map((b) => ({ id: b.id, name: loc(b.name), address: loc(b.address) })),
      }))
      .sort((a, b) => b.productCount - a.productCount || (a.name ?? '').localeCompare(b.name ?? ''));

    return {
      holdingCompany: {
        id: holding.id,
        name: loc(holding.name),
        address: loc(holding.address),
        contactEmail: holding.contactEmail ?? null,
        contactPhone: holding.contactPhone ?? null,
        currency: holding.currency,
      },
      figures: {
        subsidiaries: subsidiaries.length,
        branches: subsidiaries.reduce((n, s) => n + s.branchCount, 0),
        products: subsidiaries.reduce((n, s) => n + s.productCount, 0),
        categories: categoryCount,
      },
      subsidiaries,
    };
  }
}
