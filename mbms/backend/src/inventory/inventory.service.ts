import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConflictAppException, NotFoundAppException } from '../common/app-exception';
import { AuthenticatedUser } from '../common/strategies/jwt.strategy';
import { hasGroupVisibility, isCompanyInScope } from '../common/scope.util';
import { AuditService } from '../common/audit/audit.service';
import {
  AdjustStockDto,
  CreateStockLocationDto,
  CreateWarehouseDto,
  ReturnStockDto,
  SetReorderPointDto,
  SetStockLevelsDto,
  TransferStockDto,
  UpdateStockLocationDto,
  UpdateWarehouseDto,
} from './dto/inventory.dto';

// Same "group-wide visibility" permission the Product service uses — a user
// who can see every product group-wide can see its stock too.
const GROUP_PERM = 'product.viewAll';

type StockStatus = 'ok' | 'low' | 'out';

function stockStatus(onHand: number, reorderPoint: number | null): StockStatus {
  if (onHand <= 0) return 'out';
  if (reorderPoint !== null && reorderPoint !== undefined && onHand <= reorderPoint) return 'low';
  return 'ok';
}

function stockRow(p: any, onHandOverride?: number) {
  const onHand = onHandOverride ?? p.stockQuantity ?? 0;
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
    minStockLevel: p.minStockLevel ?? null,
    maxStockLevel: p.maxStockLevel ?? null,
    trackBatches: p.trackBatches ?? false,
    trackSerials: p.trackSerials ?? false,
    unitPrice: unitPrice === null ? null : unitPrice.toFixed(2),
    stockValue: unitPrice === null ? null : (onHand * unitPrice).toFixed(2),
    status: stockStatus(onHand, p.reorderPoint ?? null),
    updatedAt: p.updatedAt,
  };
}

function warehouseResource(w: any) {
  return {
    id: w.id,
    companyId: w.companyId,
    branchId: w.branchId,
    code: w.code,
    name: w.name,
    address: w.address,
    isDefault: w.isDefault,
    isActive: w.isActive,
    locationCount: w._count?.locations,
    createdAt: w.createdAt,
    updatedAt: w.updatedAt,
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

  // A company always has exactly one default ("MAIN") warehouse. Created
  // lazily so an un-seeded company still works the first time stock moves.
  async ensureDefaultWarehouse(companyId: string) {
    const existing = await this.prisma.warehouse.findFirst({
      where: { companyId, isDefault: true },
    });
    if (existing) return existing;
    const anyWh = await this.prisma.warehouse.findFirst({ where: { companyId } });
    if (anyWh) {
      return this.prisma.warehouse.update({
        where: { id: anyWh.id },
        data: { isDefault: true },
      });
    }
    return this.prisma.warehouse.create({
      data: { companyId, code: 'MAIN', name: 'Main Warehouse', isDefault: true },
    });
  }

  // Lazy one-time split: a product carrying a company roll-up but no
  // per-warehouse rows gets that quantity parked in the default warehouse.
  async ensureBalanceInitialised(product: any, defaultWarehouseId: string) {
    const count = await this.prisma.stockBalance.count({ where: { productId: product.id } });
    if (count > 0) return;
    const qty = product.stockQuantity ?? 0;
    await this.prisma.stockBalance.create({
      data: {
        companyId: product.companyId,
        productId: product.id,
        warehouseId: defaultWarehouseId,
        quantity: qty,
      },
    });
  }

  async balanceQty(productId: string, warehouseId: string) {
    const row = await this.prisma.stockBalance.findUnique({
      where: { productId_warehouseId: { productId, warehouseId } },
    });
    return row?.quantity ?? 0;
  }

  // Apply one signed stock change to a product in a warehouse inside an
  // existing transaction: writes the StockBalance, the Product roll-up and a
  // StockMovement, and returns the new warehouse balance. Shared by the
  // Warehouse Management flows (goods receipt, pick, stock-count reconcile).
  // `setAbsolute`, when given, sets the warehouse balance to that figure and
  // ignores `delta` (used by count reconciliation).
  async applyDeltaTx(
    tx: any,
    opts: {
      product: { id: string; companyId: string; stockQuantity: number | null };
      warehouseId: string;
      movementType: 'receipt' | 'issue' | 'return' | 'count' | 'adjustment';
      delta?: number;
      setAbsolute?: number;
      reason?: string | null;
      reference?: string | null;
      batchNumber?: string | null;
      createdBy: string;
    },
  ): Promise<number> {
    const cur = await tx.stockBalance.findUnique({
      where: { productId_warehouseId: { productId: opts.product.id, warehouseId: opts.warehouseId } },
    });
    const before = cur?.quantity ?? 0;
    const balanceAfter =
      opts.setAbsolute !== undefined ? opts.setAbsolute : before + (opts.delta ?? 0);
    const applied = balanceAfter - before;
    if (applied === 0) return before;

    await tx.stockBalance.upsert({
      where: { productId_warehouseId: { productId: opts.product.id, warehouseId: opts.warehouseId } },
      create: {
        companyId: opts.product.companyId,
        productId: opts.product.id,
        warehouseId: opts.warehouseId,
        quantity: balanceAfter,
      },
      update: { quantity: balanceAfter },
    });
    await tx.product.update({
      where: { id: opts.product.id },
      data: { stockQuantity: (opts.product.stockQuantity ?? 0) + applied },
    });
    opts.product.stockQuantity = (opts.product.stockQuantity ?? 0) + applied;
    await tx.stockMovement.create({
      data: {
        companyId: opts.product.companyId,
        productId: opts.product.id,
        movementType: opts.movementType,
        quantity: applied,
        balanceAfter,
        warehouseId: opts.warehouseId,
        batchNumber: opts.batchNumber ?? null,
        reason: opts.reason ?? null,
        reference: opts.reference ?? null,
        createdBy: opts.createdBy,
      },
    });
    return balanceAfter;
  }

  // GET /inventory/stock
  async listStock(
    user: AuthenticatedUser,
    filters: { companyId?: string; warehouseId?: string; lowStockOnly?: boolean; search?: string },
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

    let warehouseName: string | null = null;
    let byWarehouse = new Map<string, number>();
    if (filters.warehouseId) {
      const wh = await this.prisma.warehouse.findUnique({ where: { id: filters.warehouseId } });
      if (!wh || !isCompanyInScope(user, wh.companyId, GROUP_PERM)) {
        throw new NotFoundAppException('Warehouse not found.');
      }
      warehouseName = wh.name;
      const balances = await this.prisma.stockBalance.findMany({
        where: { warehouseId: filters.warehouseId },
        select: { productId: true, quantity: true },
      });
      byWarehouse = new Map(balances.map((b) => [b.productId, b.quantity]));
    }

    let items = rows.map((p) =>
      filters.warehouseId ? stockRow(p, byWarehouse.get(p.id) ?? 0) : stockRow(p),
    );

    const warehouseCount = await this.prisma.warehouse.count({
      where: this.companyFilter(user, filters.companyId) as any,
    });
    const summary = {
      skus: items.length,
      warehouses: warehouseCount,
      lowStock: items.filter((r) => r.status === 'low').length,
      outOfStock: items.filter((r) => r.status === 'out').length,
      totalStockValue: items
        .reduce((sum, r) => sum + (r.stockValue ? Number(r.stockValue) : 0), 0)
        .toFixed(2),
    };
    if (filters.lowStockOnly) items = items.filter((r) => r.status !== 'ok');

    return { items, summary, warehouseId: filters.warehouseId ?? null, warehouseName };
  }

  // GET /inventory/balances?productId=
  async listBalances(user: AuthenticatedUser, productId: string) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product || !isCompanyInScope(user, product.companyId, GROUP_PERM)) {
      throw new NotFoundAppException('Product not found.');
    }
    const rows = await this.prisma.stockBalance.findMany({
      where: { productId },
      include: { warehouse: { select: { code: true, name: true, isActive: true } } },
      orderBy: { warehouse: { code: 'asc' } },
    });
    return {
      productId,
      productCode: product.productCode,
      name: product.name,
      rollUp: product.stockQuantity ?? 0,
      balances: rows.map((r) => ({
        warehouseId: r.warehouseId,
        warehouseCode: r.warehouse.code,
        warehouseName: r.warehouse.name,
        warehouseActive: r.warehouse.isActive,
        quantity: r.quantity,
      })),
    };
  }

  // GET /inventory/movements
  async listMovements(
    user: AuthenticatedUser,
    filters: { companyId?: string; productId?: string; from?: string; to?: string; limit?: number },
  ) {
    const where: any = { ...this.companyFilter(user, filters.companyId) };
    if (filters.productId) where.productId = filters.productId;
    if (filters.from || filters.to) {
      where.createdAt = {};
      if (filters.from) where.createdAt.gte = new Date(filters.from);
      if (filters.to) where.createdAt.lte = new Date(`${filters.to}T23:59:59.999Z`);
    }

    const take = Math.min(Math.max(filters.limit ?? 100, 1), 1000);
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

    const whIds = [
      ...new Set(
        rows.flatMap((r) => [r.warehouseId, r.counterpartyWarehouseId].filter(Boolean) as string[]),
      ),
    ];
    const whs = whIds.length
      ? await this.prisma.warehouse.findMany({
          where: { id: { in: whIds } },
          select: { id: true, code: true },
        })
      : [];
    const whCodeById = new Map(whs.map((w) => [w.id, w.code]));

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
      warehouseId: r.warehouseId,
      warehouseCode: r.warehouseId ? whCodeById.get(r.warehouseId) ?? null : null,
      counterpartyWarehouseId: r.counterpartyWarehouseId,
      counterpartyWarehouseCode: r.counterpartyWarehouseId
        ? whCodeById.get(r.counterpartyWarehouseId) ?? null
        : null,
      batchNumber: r.batchNumber,
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

    const defaultWh = await this.ensureDefaultWarehouse(product.companyId);
    let warehouse = defaultWh;
    if (dto.warehouseId) {
      const wh = await this.prisma.warehouse.findUnique({ where: { id: dto.warehouseId } });
      if (!wh || wh.companyId !== product.companyId) {
        throw new NotFoundAppException('Warehouse not found.');
      }
      if (!wh.isActive) throw new ConflictAppException('That warehouse is inactive.');
      warehouse = wh;
    }
    await this.ensureBalanceInitialised(product, defaultWh.id);

    const serials = dto.serialNumbers?.map((s) => s.trim()).filter(Boolean) ?? [];
    if (serials.length && dto.movementType === 'count') {
      throw new ConflictAppException('Serial numbers cannot be supplied on a count.');
    }
    if (serials.length && serials.length !== dto.quantity) {
      throw new ConflictAppException(
        `Supplied ${serials.length} serial number(s) but quantity is ${dto.quantity}.`,
      );
    }

    const whQty = await this.balanceQty(product.id, warehouse.id);
    let delta: number;
    let balanceAfter: number; // new warehouse balance

    if (dto.movementType === 'count') {
      balanceAfter = dto.quantity;
      delta = dto.quantity - whQty;
    } else if (dto.movementType === 'receipt') {
      if (dto.quantity <= 0) throw new ConflictAppException('Quantity must be greater than zero.');
      delta = dto.quantity;
      balanceAfter = whQty + dto.quantity;
    } else {
      // issue
      if (dto.quantity <= 0) throw new ConflictAppException('Quantity must be greater than zero.');
      if (dto.quantity > whQty) {
        throw new ConflictAppException(
          `Cannot issue ${dto.quantity} — only ${whQty} in ${warehouse.code}.`,
        );
      }
      delta = -dto.quantity;
      balanceAfter = whQty - dto.quantity;
    }

    if (delta === 0) {
      throw new ConflictAppException(
        'That count matches the current stock on hand — nothing to adjust.',
      );
    }

    const rollUpBefore = product.stockQuantity ?? 0;
    const rollUpAfter = rollUpBefore + delta;

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.stockBalance.upsert({
        where: { productId_warehouseId: { productId: product.id, warehouseId: warehouse.id } },
        create: {
          companyId: product.companyId,
          productId: product.id,
          warehouseId: warehouse.id,
          quantity: balanceAfter,
        },
        update: { quantity: balanceAfter },
      });
      const updated = await tx.product.update({
        where: { id: product.id },
        data: { stockQuantity: rollUpAfter },
        include: { category: true },
      });
      const movement = await tx.stockMovement.create({
        data: {
          companyId: product.companyId,
          productId: product.id,
          movementType: dto.movementType,
          quantity: delta,
          balanceAfter,
          warehouseId: warehouse.id,
          batchNumber: dto.batchNumber?.trim() || null,
          reason: dto.reason ?? null,
          reference: dto.reference ?? null,
          createdBy: user.id,
        },
      });

      if (dto.batchNumber?.trim() && dto.movementType === 'receipt') {
        const bn = dto.batchNumber.trim();
        await tx.stockBatch.upsert({
          where: {
            productId_warehouseId_batchNumber: {
              productId: product.id,
              warehouseId: warehouse.id,
              batchNumber: bn,
            },
          },
          create: {
            companyId: product.companyId,
            productId: product.id,
            warehouseId: warehouse.id,
            batchNumber: bn,
            expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : null,
            quantity: dto.quantity,
          },
          update: {
            quantity: { increment: dto.quantity },
            ...(dto.expiryDate ? { expiryDate: new Date(dto.expiryDate) } : {}),
          },
        });
      }

      if (serials.length && dto.movementType === 'receipt') {
        for (const sn of serials) {
          await tx.stockSerial.upsert({
            where: { productId_serialNumber: { productId: product.id, serialNumber: sn } },
            create: {
              companyId: product.companyId,
              productId: product.id,
              warehouseId: warehouse.id,
              serialNumber: sn,
              status: 'in_stock',
            },
            update: { status: 'in_stock', warehouseId: warehouse.id },
          });
        }
      } else if (serials.length && dto.movementType === 'issue') {
        for (const sn of serials) {
          const existing = await tx.stockSerial.findUnique({
            where: { productId_serialNumber: { productId: product.id, serialNumber: sn } },
          });
          if (!existing || existing.status !== 'in_stock') {
            throw new ConflictAppException(`Serial ${sn} is not in stock.`);
          }
          await tx.stockSerial.update({
            where: { id: existing.id },
            data: { status: 'issued' },
          });
        }
      }

      return { movement, product: updated };
    });

    await this.auditService.record({
      eventType: 'inventory.stock.adjusted',
      sourceService: 'inventory-service',
      userId: user.id,
      companyId: product.companyId,
      entityType: 'product',
      entityId: product.id,
      action: 'update',
      previousValue: { stockQuantity: rollUpBefore, warehouseBalance: whQty },
      newValue: {
        stockQuantity: rollUpAfter,
        warehouseId: warehouse.id,
        warehouseCode: warehouse.code,
        warehouseBalance: balanceAfter,
        movementType: dto.movementType,
        quantity: delta,
        reason: dto.reason ?? null,
      },
    });

    return { movement: result.movement, product: stockRow(result.product) };
  }

  // POST /inventory/transfers
  async transfer(user: AuthenticatedUser, dto: TransferStockDto) {
    if (dto.fromWarehouseId === dto.toWarehouseId) {
      throw new ConflictAppException('Choose two different warehouses.');
    }
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
      include: { category: true },
    });
    if (!product || !isCompanyInScope(user, product.companyId, GROUP_PERM)) {
      throw new NotFoundAppException('Product not found.');
    }
    const [from, to] = await Promise.all([
      this.prisma.warehouse.findUnique({ where: { id: dto.fromWarehouseId } }),
      this.prisma.warehouse.findUnique({ where: { id: dto.toWarehouseId } }),
    ]);
    if (!from || from.companyId !== product.companyId) {
      throw new NotFoundAppException('Source warehouse not found.');
    }
    if (!to || to.companyId !== product.companyId) {
      throw new NotFoundAppException('Destination warehouse not found.');
    }
    if (!to.isActive) throw new ConflictAppException('The destination warehouse is inactive.');

    const defaultWh = await this.ensureDefaultWarehouse(product.companyId);
    await this.ensureBalanceInitialised(product, defaultWh.id);

    const fromQty = await this.balanceQty(product.id, from.id);
    if (dto.quantity > fromQty) {
      throw new ConflictAppException(
        `Cannot transfer ${dto.quantity} — only ${fromQty} in ${from.code}.`,
      );
    }
    const toQty = await this.balanceQty(product.id, to.id);
    const fromAfter = fromQty - dto.quantity;
    const toAfter = toQty + dto.quantity;

    const movements = await this.prisma.$transaction(async (tx) => {
      await tx.stockBalance.update({
        where: { productId_warehouseId: { productId: product.id, warehouseId: from.id } },
        data: { quantity: fromAfter },
      });
      await tx.stockBalance.upsert({
        where: { productId_warehouseId: { productId: product.id, warehouseId: to.id } },
        create: {
          companyId: product.companyId,
          productId: product.id,
          warehouseId: to.id,
          quantity: toAfter,
        },
        update: { quantity: toAfter },
      });
      const out = await tx.stockMovement.create({
        data: {
          companyId: product.companyId,
          productId: product.id,
          movementType: 'transfer_out',
          quantity: -dto.quantity,
          balanceAfter: fromAfter,
          warehouseId: from.id,
          counterpartyWarehouseId: to.id,
          reason: dto.reason ?? null,
          reference: dto.reference ?? null,
          createdBy: user.id,
        },
      });
      const inn = await tx.stockMovement.create({
        data: {
          companyId: product.companyId,
          productId: product.id,
          movementType: 'transfer_in',
          quantity: dto.quantity,
          balanceAfter: toAfter,
          warehouseId: to.id,
          counterpartyWarehouseId: from.id,
          reason: dto.reason ?? null,
          reference: dto.reference ?? null,
          createdBy: user.id,
        },
      });
      return { out, inn };
    });

    await this.auditService.record({
      eventType: 'inventory.stock.transferred',
      sourceService: 'inventory-service',
      userId: user.id,
      companyId: product.companyId,
      entityType: 'product',
      entityId: product.id,
      action: 'update',
      newValue: {
        productCode: product.productCode,
        quantity: dto.quantity,
        from: from.code,
        to: to.code,
        fromBalance: fromAfter,
        toBalance: toAfter,
      },
    });

    return {
      productId: product.id,
      productCode: product.productCode,
      quantity: dto.quantity,
      from: { warehouseId: from.id, code: from.code, balance: fromAfter },
      to: { warehouseId: to.id, code: to.code, balance: toAfter },
      movements,
    };
  }

  // POST /inventory/returns
  async recordReturn(user: AuthenticatedUser, dto: ReturnStockDto) {
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
      include: { category: true },
    });
    if (!product || !isCompanyInScope(user, product.companyId, GROUP_PERM)) {
      throw new NotFoundAppException('Product not found.');
    }
    const wh = await this.prisma.warehouse.findUnique({ where: { id: dto.warehouseId } });
    if (!wh || wh.companyId !== product.companyId) {
      throw new NotFoundAppException('Warehouse not found.');
    }
    if (!wh.isActive) throw new ConflictAppException('That warehouse is inactive.');

    const defaultWh = await this.ensureDefaultWarehouse(product.companyId);
    await this.ensureBalanceInitialised(product, defaultWh.id);

    const whQty = await this.balanceQty(product.id, wh.id);
    const balanceAfter = whQty + dto.quantity;
    const rollUpBefore = product.stockQuantity ?? 0;
    const rollUpAfter = rollUpBefore + dto.quantity;

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.stockBalance.upsert({
        where: { productId_warehouseId: { productId: product.id, warehouseId: wh.id } },
        create: {
          companyId: product.companyId,
          productId: product.id,
          warehouseId: wh.id,
          quantity: balanceAfter,
        },
        update: { quantity: balanceAfter },
      });
      const updated = await tx.product.update({
        where: { id: product.id },
        data: { stockQuantity: rollUpAfter },
        include: { category: true },
      });
      const movement = await tx.stockMovement.create({
        data: {
          companyId: product.companyId,
          productId: product.id,
          movementType: 'return',
          quantity: dto.quantity,
          balanceAfter,
          warehouseId: wh.id,
          reason: dto.reason ?? null,
          reference: dto.reference ?? null,
          createdBy: user.id,
        },
      });
      return { movement, product: updated };
    });

    await this.auditService.record({
      eventType: 'inventory.stock.returned',
      sourceService: 'inventory-service',
      userId: user.id,
      companyId: product.companyId,
      entityType: 'product',
      entityId: product.id,
      action: 'update',
      previousValue: { stockQuantity: rollUpBefore },
      newValue: {
        stockQuantity: rollUpAfter,
        warehouseId: wh.id,
        warehouseCode: wh.code,
        quantity: dto.quantity,
        reason: dto.reason ?? null,
      },
    });

    return { movement: result.movement, product: stockRow(result.product) };
  }

  // PUT /inventory/products/:id/reorder-point  (kept for back-compat)
  async setReorderPoint(user: AuthenticatedUser, productId: string, dto: SetReorderPointDto) {
    return this.setStockLevels(user, productId, {
      reorderPoint: dto.reorderPoint === undefined ? null : dto.reorderPoint,
    });
  }

  // PUT /inventory/products/:id/stock-levels
  async setStockLevels(user: AuthenticatedUser, productId: string, dto: SetStockLevelsDto) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: { category: true },
    });
    if (!product || !isCompanyInScope(user, product.companyId, GROUP_PERM)) {
      throw new NotFoundAppException('Product not found.');
    }

    const data: any = {};
    if ('reorderPoint' in dto) data.reorderPoint = dto.reorderPoint ?? null;
    if ('minStockLevel' in dto) data.minStockLevel = dto.minStockLevel ?? null;
    if ('maxStockLevel' in dto) data.maxStockLevel = dto.maxStockLevel ?? null;
    if (dto.trackBatches !== undefined) data.trackBatches = dto.trackBatches;
    if (dto.trackSerials !== undefined) data.trackSerials = dto.trackSerials;

    const min = data.minStockLevel ?? product.minStockLevel;
    const max = data.maxStockLevel ?? product.maxStockLevel;
    if (min !== null && min !== undefined && max !== null && max !== undefined && min > max) {
      throw new ConflictAppException('Minimum stock level cannot exceed the maximum.');
    }

    const updated = await this.prisma.product.update({
      where: { id: productId },
      data,
      include: { category: true },
    });

    await this.auditService.record({
      eventType: 'inventory.stock_levels.updated',
      sourceService: 'inventory-service',
      userId: user.id,
      companyId: product.companyId,
      entityType: 'product',
      entityId: product.id,
      action: 'update',
      previousValue: {
        reorderPoint: product.reorderPoint ?? null,
        minStockLevel: product.minStockLevel ?? null,
        maxStockLevel: product.maxStockLevel ?? null,
        trackBatches: product.trackBatches,
        trackSerials: product.trackSerials,
      },
      newValue: {
        reorderPoint: updated.reorderPoint ?? null,
        minStockLevel: updated.minStockLevel ?? null,
        maxStockLevel: updated.maxStockLevel ?? null,
        trackBatches: updated.trackBatches,
        trackSerials: updated.trackSerials,
      },
    });

    return stockRow(updated);
  }

  // ---- Warehouses & locations ----------------------------------------

  async listWarehouses(user: AuthenticatedUser, companyId?: string) {
    const where: any = { ...this.companyFilter(user, companyId) };
    const rows = await this.prisma.warehouse.findMany({
      where,
      include: { _count: { select: { locations: true } } },
      orderBy: [{ isDefault: 'desc' }, { code: 'asc' }],
    });
    return rows.map(warehouseResource);
  }

  async createWarehouse(user: AuthenticatedUser, dto: CreateWarehouseDto) {
    if (!isCompanyInScope(user, dto.companyId, GROUP_PERM)) {
      throw new NotFoundAppException('Company not found.');
    }
    const code = dto.code.trim().toUpperCase();
    const clash = await this.prisma.warehouse.findUnique({
      where: { companyId_code: { companyId: dto.companyId, code } },
    });
    if (clash) throw new ConflictAppException(`Warehouse code ${code} is already in use.`);

    if (dto.branchId) {
      const branch = await this.prisma.branch.findUnique({ where: { id: dto.branchId } });
      if (!branch || branch.companyId !== dto.companyId) {
        throw new NotFoundAppException('Branch not found.');
      }
    }

    const isFirst = (await this.prisma.warehouse.count({ where: { companyId: dto.companyId } })) === 0;
    const created = await this.prisma.warehouse.create({
      data: {
        companyId: dto.companyId,
        branchId: dto.branchId ?? null,
        code,
        name: dto.name.trim(),
        address: dto.address?.trim() || null,
        isDefault: isFirst,
      },
      include: { _count: { select: { locations: true } } },
    });

    await this.auditService.record({
      eventType: 'inventory.warehouse.created',
      sourceService: 'inventory-service',
      userId: user.id,
      companyId: dto.companyId,
      entityType: 'warehouse',
      entityId: created.id,
      action: 'create',
      newValue: { code: created.code, name: created.name, isDefault: created.isDefault },
    });

    return warehouseResource(created);
  }

  async updateWarehouse(user: AuthenticatedUser, id: string, dto: UpdateWarehouseDto) {
    const wh = await this.prisma.warehouse.findUnique({ where: { id } });
    if (!wh || !isCompanyInScope(user, wh.companyId, GROUP_PERM)) {
      throw new NotFoundAppException('Warehouse not found.');
    }
    if (dto.isActive === false && wh.isDefault) {
      throw new ConflictAppException('The default warehouse cannot be deactivated.');
    }
    if (dto.branchId) {
      const branch = await this.prisma.branch.findUnique({ where: { id: dto.branchId } });
      if (!branch || branch.companyId !== wh.companyId) {
        throw new NotFoundAppException('Branch not found.');
      }
    }
    const updated = await this.prisma.warehouse.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.address !== undefined ? { address: dto.address?.trim() || null } : {}),
        ...('branchId' in dto ? { branchId: dto.branchId ?? null } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
      include: { _count: { select: { locations: true } } },
    });

    await this.auditService.record({
      eventType: 'inventory.warehouse.updated',
      sourceService: 'inventory-service',
      userId: user.id,
      companyId: wh.companyId,
      entityType: 'warehouse',
      entityId: id,
      action: 'update',
      newValue: { name: updated.name, isActive: updated.isActive },
    });

    return warehouseResource(updated);
  }

  private async findWarehouseInScope(user: AuthenticatedUser, warehouseId: string) {
    const wh = await this.prisma.warehouse.findUnique({ where: { id: warehouseId } });
    if (!wh || !isCompanyInScope(user, wh.companyId, GROUP_PERM)) {
      throw new NotFoundAppException('Warehouse not found.');
    }
    return wh;
  }

  async listLocations(user: AuthenticatedUser, warehouseId: string) {
    await this.findWarehouseInScope(user, warehouseId);
    const rows = await this.prisma.stockLocation.findMany({
      where: { warehouseId },
      orderBy: { code: 'asc' },
    });
    return rows;
  }

  async createLocation(user: AuthenticatedUser, warehouseId: string, dto: CreateStockLocationDto) {
    const wh = await this.findWarehouseInScope(user, warehouseId);
    const code = dto.code.trim().toUpperCase();
    const clash = await this.prisma.stockLocation.findUnique({
      where: { warehouseId_code: { warehouseId, code } },
    });
    if (clash) throw new ConflictAppException(`Location code ${code} is already in use here.`);
    const created = await this.prisma.stockLocation.create({
      data: { warehouseId, code, name: dto.name.trim(), description: dto.description?.trim() || null },
    });
    await this.auditService.record({
      eventType: 'inventory.location.created',
      sourceService: 'inventory-service',
      userId: user.id,
      companyId: wh.companyId,
      entityType: 'stock_location',
      entityId: created.id,
      action: 'create',
      newValue: { warehouseId, code: created.code, name: created.name },
    });
    return created;
  }

  async updateLocation(user: AuthenticatedUser, locationId: string, dto: UpdateStockLocationDto) {
    const loc = await this.prisma.stockLocation.findUnique({ where: { id: locationId } });
    if (!loc) throw new NotFoundAppException('Location not found.');
    const wh = await this.findWarehouseInScope(user, loc.warehouseId);
    const updated = await this.prisma.stockLocation.update({
      where: { id: locationId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description?.trim() || null } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
    await this.auditService.record({
      eventType: 'inventory.location.updated',
      sourceService: 'inventory-service',
      userId: user.id,
      companyId: wh.companyId,
      entityType: 'stock_location',
      entityId: locationId,
      action: 'update',
      newValue: { name: updated.name, isActive: updated.isActive },
    });
    return updated;
  }

  // ---- Batches & serials --------------------------------------------

  async listBatches(
    user: AuthenticatedUser,
    filters: { companyId?: string; productId?: string; warehouseId?: string },
  ) {
    const where: any = { ...this.companyFilter(user, filters.companyId) };
    if (filters.productId) where.productId = filters.productId;
    if (filters.warehouseId) where.warehouseId = filters.warehouseId;
    const rows = await this.prisma.stockBatch.findMany({
      where,
      include: {
        product: { select: { productCode: true, name: true } },
      },
      orderBy: [{ expiryDate: 'asc' }, { batchNumber: 'asc' }],
      take: 1000,
    });
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return rows.map((b) => ({
      id: b.id,
      companyId: b.companyId,
      productId: b.productId,
      productCode: b.product.productCode,
      productName: b.product.name,
      warehouseId: b.warehouseId,
      batchNumber: b.batchNumber,
      expiryDate: b.expiryDate,
      quantity: b.quantity,
      expired: b.expiryDate ? new Date(b.expiryDate) < today : false,
    }));
  }

  async listSerials(
    user: AuthenticatedUser,
    filters: { companyId?: string; productId?: string; status?: string },
  ) {
    const where: any = { ...this.companyFilter(user, filters.companyId) };
    if (filters.productId) where.productId = filters.productId;
    if (filters.status) where.status = filters.status;
    const rows = await this.prisma.stockSerial.findMany({
      where,
      include: { product: { select: { productCode: true, name: true } } },
      orderBy: [{ createdAt: 'desc' }],
      take: 1000,
    });
    return rows.map((s) => ({
      id: s.id,
      companyId: s.companyId,
      productId: s.productId,
      productCode: s.product.productCode,
      productName: s.product.name,
      warehouseId: s.warehouseId,
      serialNumber: s.serialNumber,
      status: s.status,
      note: s.note,
      updatedAt: s.updatedAt,
    }));
  }

  // ---- Reports ------------------------------------------------------

  private async productsInScope(user: AuthenticatedUser, companyId?: string) {
    return this.prisma.product.findMany({
      where: { ...this.companyFilter(user, companyId) } as any,
      include: { category: true },
      orderBy: { productCode: 'asc' },
      take: 5000,
    });
  }

  // GET /inventory/reports/stock-balance
  async reportStockBalance(user: AuthenticatedUser, companyId?: string, warehouseId?: string) {
    const products = await this.productsInScope(user, companyId);
    const ids = products.map((p) => p.id);
    const balances = ids.length
      ? await this.prisma.stockBalance.findMany({
          where: { productId: { in: ids }, ...(warehouseId ? { warehouseId } : {}) },
          include: { warehouse: { select: { code: true, name: true } } },
        })
      : [];
    const byProduct = new Map<string, { code: string; name: string; quantity: number }[]>();
    for (const b of balances) {
      const arr = byProduct.get(b.productId) ?? [];
      arr.push({ code: b.warehouse.code, name: b.warehouse.name, quantity: b.quantity });
      byProduct.set(b.productId, arr);
    }
    return products.map((p) => {
      const wh = byProduct.get(p.id) ?? [];
      const onHand = warehouseId
        ? wh.reduce((s, w) => s + w.quantity, 0)
        : p.stockQuantity ?? 0;
      return {
        productId: p.id,
        productCode: p.productCode,
        name: p.name,
        categoryName: p.category?.name ?? null,
        unitOfMeasure: p.unitOfMeasure,
        onHand,
        byWarehouse: wh.sort((a, b) => a.code.localeCompare(b.code)),
      };
    });
  }

  // GET /inventory/reports/stock-movement
  async reportStockMovement(
    user: AuthenticatedUser,
    opts: { companyId?: string; productId?: string; from?: string; to?: string },
  ) {
    return this.listMovements(user, { ...opts, limit: 1000 });
  }

  // GET /inventory/reports/movement-analysis
  async reportMovementAnalysis(user: AuthenticatedUser, companyId?: string, days = 90) {
    const window = Math.min(Math.max(days, 1), 730);
    const since = new Date();
    since.setDate(since.getDate() - window);

    const products = await this.productsInScope(user, companyId);
    const ids = products.map((p) => p.id);
    const moves = ids.length
      ? await this.prisma.stockMovement.findMany({
          where: {
            productId: { in: ids },
            movementType: { in: ['issue', 'transfer_out'] },
            createdAt: { gte: since },
          },
          select: { productId: true, quantity: true },
        })
      : [];
    const issuedByProduct = new Map<string, number>();
    for (const m of moves) {
      issuedByProduct.set(m.productId, (issuedByProduct.get(m.productId) ?? 0) + Math.abs(m.quantity));
    }

    const rows = products.map((p) => ({
      productId: p.id,
      productCode: p.productCode,
      name: p.name,
      onHand: p.stockQuantity ?? 0,
      issued: issuedByProduct.get(p.id) ?? 0,
    }));

    const moving = rows.filter((r) => r.issued > 0).sort((a, b) => b.issued - a.issued);
    const fastMoving = moving.slice(0, 10);
    const slowMoving = moving.slice(10).sort((a, b) => a.issued - b.issued).slice(0, 10);
    const deadStock = rows
      .filter((r) => r.issued === 0 && r.onHand > 0)
      .sort((a, b) => b.onHand - a.onHand);

    return { windowDays: window, since, fastMoving, slowMoving, deadStock };
  }

  // GET /inventory/reports/valuation
  async reportValuation(user: AuthenticatedUser, companyId?: string, warehouseId?: string) {
    const products = await this.productsInScope(user, companyId);
    const priced = products.filter((p) => p.unitPrice !== null && p.unitPrice !== undefined);
    const ids = priced.map((p) => p.id);
    const balances =
      warehouseId && ids.length
        ? await this.prisma.stockBalance.findMany({
            where: { productId: { in: ids }, warehouseId },
            select: { productId: true, quantity: true },
          })
        : [];
    const qtyByProduct = new Map(balances.map((b) => [b.productId, b.quantity]));

    const lines = priced.map((p) => {
      const unitPrice = Number(p.unitPrice);
      const onHand = warehouseId ? qtyByProduct.get(p.id) ?? 0 : p.stockQuantity ?? 0;
      return {
        productId: p.id,
        productCode: p.productCode,
        name: p.name,
        onHand,
        unitPrice: unitPrice.toFixed(2),
        stockValue: (onHand * unitPrice).toFixed(2),
      };
    });
    const total = lines.reduce((s, l) => s + Number(l.stockValue), 0);
    return {
      warehouseId: warehouseId ?? null,
      lines: lines.sort((a, b) => Number(b.stockValue) - Number(a.stockValue)),
      totalValue: total.toFixed(2),
      pricedSkus: lines.length,
      unpricedSkus: products.length - priced.length,
    };
  }

  // GET /inventory/reports/shortage
  async reportShortage(user: AuthenticatedUser, companyId?: string) {
    const products = await this.productsInScope(user, companyId);
    return products
      .map((p) => {
        const onHand = p.stockQuantity ?? 0;
        const threshold =
          p.minStockLevel ?? p.reorderPoint ?? null;
        if (threshold === null) return null;
        if (onHand >= threshold) return null;
        return {
          productId: p.id,
          productCode: p.productCode,
          name: p.name,
          onHand,
          threshold,
          thresholdKind: p.minStockLevel !== null && p.minStockLevel !== undefined ? 'min' : 'reorder',
          shortBy: threshold - onHand,
        };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => b.shortBy - a.shortBy);
  }

  // GET /inventory/reports/surplus
  async reportSurplus(user: AuthenticatedUser, companyId?: string) {
    const products = await this.productsInScope(user, companyId);
    return products
      .map((p) => {
        const onHand = p.stockQuantity ?? 0;
        if (p.maxStockLevel === null || p.maxStockLevel === undefined) return null;
        if (onHand <= p.maxStockLevel) return null;
        return {
          productId: p.id,
          productCode: p.productCode,
          name: p.name,
          onHand,
          maxStockLevel: p.maxStockLevel,
          overBy: onHand - p.maxStockLevel,
        };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => b.overBy - a.overBy);
  }

  // GET /inventory/reports/expiring
  async reportExpiring(user: AuthenticatedUser, companyId?: string, days = 30) {
    const window = Math.min(Math.max(days, 0), 3650);
    const cutoff = new Date();
    cutoff.setHours(23, 59, 59, 999);
    cutoff.setDate(cutoff.getDate() + window);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const where: any = {
      ...this.companyFilter(user, companyId),
      expiryDate: { not: null, lte: cutoff },
      quantity: { gt: 0 },
    };
    const rows = await this.prisma.stockBatch.findMany({
      where,
      include: {
        product: { select: { productCode: true, name: true } },
      },
      orderBy: { expiryDate: 'asc' },
      take: 1000,
    });
    const whIds = [...new Set(rows.map((r) => r.warehouseId))];
    const whs = whIds.length
      ? await this.prisma.warehouse.findMany({
          where: { id: { in: whIds } },
          select: { id: true, code: true },
        })
      : [];
    const whCode = new Map(whs.map((w) => [w.id, w.code]));

    return {
      windowDays: window,
      cutoff,
      batches: rows.map((b) => ({
        id: b.id,
        productId: b.productId,
        productCode: b.product.productCode,
        productName: b.product.name,
        warehouseId: b.warehouseId,
        warehouseCode: whCode.get(b.warehouseId) ?? null,
        batchNumber: b.batchNumber,
        expiryDate: b.expiryDate,
        quantity: b.quantity,
        expired: b.expiryDate ? new Date(b.expiryDate) < today : false,
      })),
    };
  }
}
