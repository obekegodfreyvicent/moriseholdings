import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConflictAppException, NotFoundAppException } from '../common/app-exception';
import { Paginated } from '../common/interceptors/response.interceptor';
import { AuthenticatedUser } from '../common/strategies/jwt.strategy';
import { hasGroupVisibility, isCompanyInScope } from '../common/scope.util';
import { CreateProductCategoryDto, CreateProductDto, UpdateProductDto } from './dto/product.dto';
import { AuditService } from '../common/audit/audit.service';

const GROUP_PERM = 'product.viewAll';

function toResource(p: any) {
  return {
    id: p.id,
    companyId: p.companyId,
    categoryId: p.categoryId,
    categoryName: p.category?.name ?? null,
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
        include: { category: true },
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
    const product = await this.prisma.product.create({ data: dto, include: { category: true } });
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
    const updated = await this.prisma.product.update({ where: { id }, data: dto, include: { category: true } });
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

  private async findOrThrow(id: string) {
    const product = await this.prisma.product.findUnique({ where: { id }, include: { category: true } });
    if (!product) throw new NotFoundAppException('Product not found.');
    return product;
  }
}
