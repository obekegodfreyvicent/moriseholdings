import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConflictAppException, NotFoundAppException } from '../common/app-exception';
import { AuthenticatedUser } from '../common/strategies/jwt.strategy';
import { hasGroupVisibility, isCompanyInScope } from '../common/scope.util';
import { AuditService } from '../common/audit/audit.service';
import { AdjustStockDto, SetReorderPointDto } from './dto/inventory.dto';

// Same "group-wide visibility" permission the Product service uses — a user
// who can see every product group-wide can see its stock too.
const GROUP_PERM = 'product.viewAll';

type StockStatus = 'ok' | 'low' | 'out';

function stockStatus(onHand: number, reorderPoint: number | null): StockStatus {
  if (onHand <= 0) return 'out';
  if (reorderPoint !== null && reorderPoint !== undefined && onHand <= reorderPoint) return 'low';
  return 'ok';
}

function stockRow(p: any) {
  const onHand = p.stockQuantity ?? 0;
  const unitPrice = p.unitPrice !== null && p.unitPrice !== undefined ? Number(p.unitPrice) : null;
  return {
    productId: p.id,
    companyId: p.companyId,
    productCode: p.productCode,
    name: p.name,
    productType: p.productType,
    categoryName: p.category?.name ?? null,
    unitOfMeasure: p.unitOfMeasure,
    onHand,
    reorderPoint: p.reorderPoint ?? null,
    unitPrice: unitPrice === null ? null : unitPrice.toFixed(2),
    stockValue: unitPrice === null ? null : (onHand * unitPrice).toFixed(2),
    status: stockStatus(onHand, p.reorderPoint ?? null),
    updatedAt: p.updatedAt,
  };
}

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  // ---- resolve the company scope filter, mirroring products.service.list ----
  private companyFilter(user: AuthenticatedUser, companyId?: string) {
    if (hasGroupVisibility(user, GROUP_PERM)) {
      return companyId ? { companyId } : {};
    }
    const scoped = user.scopes.map((s) => s.companyId);
    return {
      companyId:
        companyId && scoped.includes(companyId)
          ? companyId
          : { in: scoped.length > 0 ? scoped : ['__none__'] },
    };
  }

  // GET /inventory/stock
  async listStock(
    user: AuthenticatedUser,
    filters: { companyId?: string; lowStockOnly?: boolean; search?: string },
  ) {
    const where: any = { ...this.companyFilter(user, filters.companyId) };
    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { productCode: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const rows = await this.prisma.product.findMany({
      where,
      include: { category: true },
      orderBy: [{ productCode: 'asc' }],
      take: 1000,
    });

    let items = rows.map(stockRow);
    const summary = {
      skus: items.length,
      lowStock: items.filter((r) => r.status === 'low').length,
      outOfStock: items.filter((r) => r.status === 'out').length,
      totalStockValue: items
        .reduce((sum, r) => sum + (r.stockValue ? Number(r.stockValue) : 0), 0)
        .toFixed(2),
    };
    if (filters.lowStockOnly) items = items.filter((r) => r.status !== 'ok');

    return { items, summary };
  }

  // GET /inventory/movements
  async listMovements(
    user: AuthenticatedUser,
    filters: { companyId?: string; productId?: string; limit?: number },
  ) {
    const where: any = { ...this.companyFilter(user, filters.companyId) };
    if (filters.productId) where.productId = filters.productId;

    const take = Math.min(Math.max(filters.limit ?? 100, 1), 500);
    const rows = await this.prisma.stockMovement.findMany({
      where,
      include: { product: { select: { name: true, productCode: true, unitOfMeasure: true } } },
      orderBy: { createdAt: 'desc' },
      take,
    });

    const userIds = [...new Set(rows.map((r) => r.createdBy))];
    const users = userIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, firstName: true, lastName: true },
        })
      : [];
    const nameById = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`.trim()]));

    return rows.map((r) => ({
      id: r.id,
      companyId: r.companyId,
      productId: r.productId,
      productName: r.product?.name ?? null,
      productCode: r.product?.productCode ?? null,
      unitOfMeasure: r.product?.unitOfMeasure ?? null,
      movementType: r.movementType,
      quantity: r.quantity,
      balanceAfter: r.balanceAfter,
      reason: r.reason,
      reference: r.reference,
      createdBy: r.createdBy,
      createdByName: nameById.get(r.createdBy) ?? null,
      createdAt: r.createdAt,
    }));
  }

  // POST /inventory/adjustments
  async adjust(user: AuthenticatedUser, dto: AdjustStockDto) {
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
      include: { category: true },
    });
    if (!product || !isCompanyInScope(user, product.companyId, GROUP_PERM)) {
      throw new NotFoundAppException('Product not found.');
    }

    const current = product.stockQuantity ?? 0;
    let delta: number;
    let balanceAfter: number;

    if (dto.movementType === 'count') {
      balanceAfter = dto.quantity;
      delta = dto.quantity - current;
    } else {
      if (dto.quantity <= 0) {
        throw new ConflictAppException('Quantity must be greater than zero.');
      }
      if (dto.movementType === 'receipt') {
        delta = dto.quantity;
        balanceAfter = current + dto.quantity;
      } else {
        // issue
        if (dto.quantity > current) {
          throw new ConflictAppException(
            `Cannot issue ${dto.quantity} — only ${current} in stock.`,
          );
        }
        delta = -dto.quantity;
        balanceAfter = current - dto.quantity;
      }
    }

    if (delta === 0) {
      throw new ConflictAppException('That count matches the current stock on hand — nothing to adjust.');
    }

    const [movement, updated] = await this.prisma.$transaction([
      this.prisma.stockMovement.create({
        data: {
          companyId: product.companyId,
          productId: product.id,
          movementType: dto.movementType,
          quantity: delta,
          balanceAfter,
          reason: dto.reason ?? null,
          reference: dto.reference ?? null,
          createdBy: user.id,
        },
      }),
      this.prisma.product.update({
        where: { id: product.id },
        data: { stockQuantity: balanceAfter },
        include: { category: true },
      }),
    ]);

    await this.auditService.record({
      eventType: 'inventory.stock.adjusted',
      sourceService: 'inventory-service',
      userId: user.id,
      companyId: product.companyId,
      entityType: 'product',
      entityId: product.id,
      action: 'update',
      previousValue: { stockQuantity: current },
      newValue: {
        stockQuantity: balanceAfter,
        movementType: dto.movementType,
        quantity: delta,
        reason: dto.reason ?? null,
      },
    });

    return { movement, product: stockRow(updated) };
  }

  // PUT /inventory/products/:id/reorder-point
  async setReorderPoint(user: AuthenticatedUser, productId: string, dto: SetReorderPointDto) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: { category: true },
    });
    if (!product || !isCompanyInScope(user, product.companyId, GROUP_PERM)) {
      throw new NotFoundAppException('Product not found.');
    }

    const next = dto.reorderPoint === undefined ? null : dto.reorderPoint;
    const updated = await this.prisma.product.update({
      where: { id: productId },
      data: { reorderPoint: next },
      include: { category: true },
    });

    await this.auditService.record({
      eventType: 'inventory.reorder_point.updated',
      sourceService: 'inventory-service',
      userId: user.id,
      companyId: product.companyId,
      entityType: 'product',
      entityId: product.id,
      action: 'update',
      previousValue: { reorderPoint: product.reorderPoint ?? null },
      newValue: { reorderPoint: next },
    });

    return stockRow(updated);
  }
}
