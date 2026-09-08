import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConflictAppException, NotFoundAppException } from '../common/app-exception';
import { Paginated } from '../common/interceptors/response.interceptor';
import { AuthenticatedUser } from '../common/strategies/jwt.strategy';
import { hasGroupVisibility, isCompanyInScope } from '../common/scope.util';
import { CreateProductCategoryDto, CreateProductDto, UpdateProductDto } from './dto/product.dto';
import { AuditService } from '../common/audit/audit.service';

const GROUP_PERM = 'product.viewAll';

// Every read of a product carries its owning company and producing branch,
// so the Admin list can label which subsidiary/mill a row belongs to.
const PRODUCT_INCLUDE = {
  category: true,
  branch: { select: { id: true, name: true } },
  company: { select: { id: true, name: true } },
} as const;

function toResource(p: any) {
  return {
    id: p.id,
    companyId: p.companyId,
    // Group catalogue (29 August 2026 / 5 September 2026): with seven
    // companies in one product list, the owning subsidiary and the
    // producing branch are part of a product's identity — an Admin looking
    // at "Maize Flour, 50kg" needs to see it belongs to Morise Milling Ltd
    // and comes off the Masindi mill, not just its code.
    companyName: p.company?.name ?? null,
    categoryId: p.categoryId,
    categoryName: p.category?.name ?? null,
    branchId: p.branchId ?? null,
    branchName: p.branch?.name ?? null,
    productCode: p.productCode,
    productType: p.productType,
    name: p.name,
    description: p.description,
    unitOfMeasure: p.unitOfMeasure,
    barcode: p.barcode,
    unitPrice: p.unitPrice?.toString() ?? null,
    stockQuantity: p.stockQuantity,
    status: p.status,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

function categoryToResource(c: any) {
  return { id: c.id, companyId: c.companyId, name: c.name, parentCategoryId: c.parentCategoryId };
}

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  // GET /products — FR-PROD-01, scoped per BR-01
  async list(
    user: AuthenticatedUser,
    page: number,
    pageSize: number,
    filters: { companyId?: string; categoryId?: string; status?: string },
  ): Promise<Paginated<unknown>> {
    const where: any = {};
    if (filters.categoryId) where.categoryId = filters.categoryId;
    if (filters.status) where.status = filters.status;

    if (hasGroupVisibility(user, GROUP_PERM)) {
      if (filters.companyId) where.companyId = filters.companyId;
    } else {
      // BR-01 / Alpha 5.2: see the identical fix and comment in
      // employees.service.ts's list() — filters.companyId must be checked
      // against the caller's own scope before use.
      const scopedCompanyIds = user.scopes.map((s) => s.companyId);
      where.companyId =
        filters.companyId && scopedCompanyIds.includes(filters.companyId)
          ? filters.companyId
          : { in: scopedCompanyIds.length > 0 ? scopedCompanyIds : ['__none__'] };
    }

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        include: PRODUCT_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.product.count({ where }),
    ]);
    return { items: rows.map(toResource), page, pageSize, total };
  }

  // POST /products — FR-PROD-01 / AC-07
  async create(user: AuthenticatedUser, dto: CreateProductDto) {
    if (!isCompanyInScope(user, dto.companyId, GROUP_PERM)) {
      throw new NotFoundAppException('Company not found.');
    }
    const existing = await this.prisma.product.findFirst({
      where: { companyId: dto.companyId, productCode: dto.productCode },
    });
    if (existing) {
      throw new ConflictAppException(`Product code "${dto.productCode}" already exists for this company.`);
    }
    await this.assertReferencesBelongTo(dto.companyId, dto.categoryId, dto.branchId);
    const product = await this.prisma.product.create({ data: dto, include: PRODUCT_INCLUDE });
    await this.auditService.record({
      eventType: 'product.record.created',
      sourceService: 'product-service',
      userId: user.id,
      companyId: product.companyId,
      entityType: 'product',
      entityId: product.id,
      action: 'create',
      newValue: { productCode: product.productCode, name: product.name },
    });
    return toResource(product);
  }

  // GET /products/{id} — FR-PROD-01
  async get(user: AuthenticatedUser, id: string) {
    const product = await this.findOrThrow(id);
    if (!isCompanyInScope(user, product.companyId, GROUP_PERM)) {
      throw new NotFoundAppException('Product not found.');
    }
    return toResource(product);
  }

  // PATCH /products/{id} — FR-PROD-02, 03
  async update(user: AuthenticatedUser, id: string, dto: UpdateProductDto) {
    const product = await this.findOrThrow(id);
    if (!isCompanyInScope(user, product.companyId, GROUP_PERM)) {
      throw new NotFoundAppException('Product not found.');
    }
    await this.assertReferencesBelongTo(product.companyId, dto.categoryId, dto.branchId);
    const updated = await this.prisma.product.update({ where: { id }, data: dto, include: PRODUCT_INCLUDE });
    await this.auditService.record({
      eventType: 'product.record.updated',
      sourceService: 'product-service',
      userId: user.id,
      companyId: updated.companyId,
      entityType: 'product',
      entityId: updated.id,
      action: 'update',
      previousValue: toResource(product),
      newValue: toResource(updated),
    });
    return toResource(updated);
  }

  // GET /product-categories?companyId=... — FR-PROD-01
  async listCategories(user: AuthenticatedUser, companyId: string) {
    if (!isCompanyInScope(user, companyId, GROUP_PERM)) {
      throw new NotFoundAppException('Company not found.');
    }
    const rows = await this.prisma.productCategory.findMany({ where: { companyId }, orderBy: { name: 'asc' } });
    return rows.map(categoryToResource);
  }

  // POST /product-categories — FR-PROD-01
  async createCategory(user: AuthenticatedUser, dto: CreateProductCategoryDto) {
    if (!isCompanyInScope(user, dto.companyId, GROUP_PERM)) {
      throw new NotFoundAppException('Company not found.');
    }
    const category = await this.prisma.productCategory.create({ data: dto });
    await this.auditService.record({
      eventType: 'product.category.created',
      sourceService: 'product-service',
      userId: user.id,
      companyId: category.companyId,
      entityType: 'product_category',
      entityId: category.id,
      action: 'create',
      newValue: { name: category.name, parentCategoryId: category.parentCategoryId },
    });
    return categoryToResource(category);
  }

  // A product's category and producing branch must both belong to the same
  // company as the product. Without this, a caller with group visibility
  // could hang a Morise Milling Ltd flour off a Morise Agro Ltd category or
  // a Morise Logistics Ltd branch, and the storefront's company/branch tag
  // would contradict the product's own companyId. Reported as "not found"
  // rather than a validation error, matching how the rest of the service
  // hides records outside the caller's reach.
  private async assertReferencesBelongTo(companyId: string, categoryId?: string, branchId?: string) {
    if (categoryId) {
      const category = await this.prisma.productCategory.findUnique({ where: { id: categoryId } });
      if (!category || category.companyId !== companyId) {
        throw new NotFoundAppException('Product category not found for this company.');
      }
    }
    if (branchId) {
      const branch = await this.prisma.branch.findUnique({ where: { id: branchId } });
      if (!branch || branch.companyId !== companyId) {
        throw new NotFoundAppException('Branch not found for this company.');
      }
    }
  }

  private async findOrThrow(id: string) {
    const product = await this.prisma.product.findUnique({ where: { id }, include: PRODUCT_INCLUDE });
    if (!product) throw new NotFoundAppException('Product not found.');
    return product;
  }
}
