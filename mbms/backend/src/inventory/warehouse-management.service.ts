import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConflictAppException, NotFoundAppException } from '../common/app-exception';
import { AuthenticatedUser } from '../common/strategies/jwt.strategy';
import { hasGroupVisibility, isCompanyInScope } from '../common/scope.util';
import { AuditService } from '../common/audit/audit.service';
import { InventoryService } from './inventory.service';
import {
  AddStockCountLinesDto,
  AddWarehouseStaffDto,
  AssignPickListDto,
  CreateGoodsReceiptDto,
  CreatePickListDto,
  CreateStockCountDto,
  PickDto,
  SetCountedQuantityDto,
  UpdateWarehouseStaffDto,
} from './dto/warehouse-management.dto';

const GROUP_PERM = 'product.viewAll';

function companyFilter(user: AuthenticatedUser, companyId?: string) {
  if (hasGroupVisibility(user, GROUP_PERM)) return companyId ? { companyId } : {};
  const scoped = user.scopes.map((s) => s.companyId);
  return {
    companyId:
      companyId && scoped.includes(companyId)
        ? companyId
        : { in: scoped.length > 0 ? scoped : ['__none__'] },
  };
}

@Injectable()
export class WarehouseManagementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly inventory: InventoryService,
  ) {}

  private async warehouseInScope(user: AuthenticatedUser, warehouseId: string) {
    const wh = await this.prisma.warehouse.findUnique({ where: { id: warehouseId } });
    if (!wh || !isCompanyInScope(user, wh.companyId, GROUP_PERM)) {
      throw new NotFoundAppException('Warehouse not found.');
    }
    return wh;
  }

  private async nextNumber(prefix: string, companyId: string, count: () => Promise<number>) {
    const year = new Date().getFullYear();
    const n = (await count()) + 1;
    return `${prefix}-${year}-${String(n).padStart(4, '0')}`;
  }

  private async resolveProduct(
    companyId: string,
    ref: { productId?: string; barcode?: string },
  ) {
    if (ref.productId) {
      const p = await this.prisma.product.findUnique({ where: { id: ref.productId } });
      if (!p || p.companyId !== companyId) throw new NotFoundAppException('Product not found.');
      return p;
    }
    if (ref.barcode) {
      const matches = await this.prisma.product.findMany({
        where: { companyId, barcode: ref.barcode.trim() },
      });
      if (matches.length === 0) throw new NotFoundAppException(`No product for barcode ${ref.barcode}.`);
      if (matches.length > 1) {
        throw new ConflictAppException(`Barcode ${ref.barcode} matches ${matches.length} products.`);
      }
      return matches[0];
    }
    throw new ConflictAppException('Each line needs a productId or a barcode.');
  }

  private async employeeInCompany(employeeId: string, companyId: string) {
    const e = await this.prisma.employee.findUnique({ where: { id: employeeId } });
    if (!e || e.companyId !== companyId) throw new NotFoundAppException('Employee not found.');
    return e;
  }

  private async employeeNames(ids: string[]) {
    const clean = [...new Set(ids.filter(Boolean))];
    if (!clean.length) return new Map<string, string>();
    const rows = await this.prisma.employee.findMany({
      where: { id: { in: clean } },
      select: { id: true, firstName: true, lastName: true, employeeNumber: true },
    });
    return new Map(rows.map((r) => [r.id, `${r.firstName} ${r.lastName}`.trim()]));
  }

  // ---- Barcode lookup ----------------------------------------------

  async lookup(user: AuthenticatedUser, barcode: string, companyId?: string) {
    const where: any = { ...companyFilter(user, companyId), barcode: barcode.trim() };
    const products = await this.prisma.product.findMany({
      where,
      include: { category: true },
    });
    const out: any[] = [];
    for (const p of products) {
      const balances = await this.prisma.stockBalance.findMany({
        where: { productId: p.id },
        include: { warehouse: { select: { code: true, name: true } } },
      });
      out.push({
        productId: p.id,
        companyId: p.companyId,
        productCode: p.productCode,
        name: p.name,
        barcode: p.barcode,
        unitOfMeasure: p.unitOfMeasure,
        categoryName: p.category?.name ?? null,
        onHand: p.stockQuantity ?? 0,
        trackBatches: p.trackBatches,
        trackSerials: p.trackSerials,
        balances: balances.map((b) => ({
          warehouseId: b.warehouseId,
          warehouseCode: b.warehouse.code,
          quantity: b.quantity,
        })),
      });
    }
    return { barcode: barcode.trim(), matches: out };
  }

  // ---- Warehouse staff -------------------------------------------

  async listStaff(user: AuthenticatedUser, warehouseId: string) {
    await this.warehouseInScope(user, warehouseId);
    const rows = await this.prisma.warehouseStaff.findMany({
      where: { warehouseId },
      orderBy: [{ isActive: 'desc' }, { role: 'asc' }],
    });
    const names = await this.employeeNames(rows.map((r) => r.employeeId));
    return rows.map((r) => ({
      id: r.id,
      warehouseId: r.warehouseId,
      employeeId: r.employeeId,
      employeeName: names.get(r.employeeId) ?? null,
      role: r.role,
      isActive: r.isActive,
      createdAt: r.createdAt,
    }));
  }

  async addStaff(user: AuthenticatedUser, warehouseId: string, dto: AddWarehouseStaffDto) {
    const wh = await this.warehouseInScope(user, warehouseId);
    await this.employeeInCompany(dto.employeeId, wh.companyId);
    const clash = await this.prisma.warehouseStaff.findUnique({
      where: {
        warehouseId_employeeId_role: {
          warehouseId,
          employeeId: dto.employeeId,
          role: dto.role,
        },
      },
    });
    if (clash) throw new ConflictAppException('That person already holds that role here.');
    const created = await this.prisma.warehouseStaff.create({
      data: { warehouseId, employeeId: dto.employeeId, role: dto.role },
    });
    await this.auditService.record({
      eventType: 'inventory.warehouse_staff.added',
      sourceService: 'inventory-service',
      userId: user.id,
      companyId: wh.companyId,
      entityType: 'warehouse_staff',
      entityId: created.id,
      action: 'create',
      newValue: { warehouseId, employeeId: dto.employeeId, role: dto.role },
    });
    return created;
  }

  async updateStaff(user: AuthenticatedUser, staffId: string, dto: UpdateWarehouseStaffDto) {
    const row = await this.prisma.warehouseStaff.findUnique({ where: { id: staffId } });
    if (!row) throw new NotFoundAppException('Staff assignment not found.');
    const wh = await this.warehouseInScope(user, row.warehouseId);
    const updated = await this.prisma.warehouseStaff.update({
      where: { id: staffId },
      data: {
        ...(dto.role !== undefined ? { role: dto.role } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
    await this.auditService.record({
      eventType: 'inventory.warehouse_staff.updated',
      sourceService: 'inventory-service',
      userId: user.id,
      companyId: wh.companyId,
      entityType: 'warehouse_staff',
      entityId: staffId,
      action: 'update',
      newValue: { role: updated.role, isActive: updated.isActive },
    });
    return updated;
  }

  async removeStaff(user: AuthenticatedUser, staffId: string) {
    const row = await this.prisma.warehouseStaff.findUnique({ where: { id: staffId } });
    if (!row) throw new NotFoundAppException('Staff assignment not found.');
    const wh = await this.warehouseInScope(user, row.warehouseId);
    await this.prisma.warehouseStaff.delete({ where: { id: staffId } });
    await this.auditService.record({
      eventType: 'inventory.warehouse_staff.removed',
      sourceService: 'inventory-service',
      userId: user.id,
      companyId: wh.companyId,
      entityType: 'warehouse_staff',
      entityId: staffId,
      action: 'delete',
      previousValue: { employeeId: row.employeeId, role: row.role },
    });
    return { deleted: true };
  }

  // ---- Goods receipts (receiving) -------------------------------

  private receiptResource(r: any) {
    return {
      id: r.id,
      companyId: r.companyId,
      warehouseId: r.warehouseId,
      warehouseCode: r.warehouse?.code ?? null,
      receiptNumber: r.receiptNumber,
      supplierId: r.supplierId,
      reference: r.reference,
      note: r.note,
      status: r.status,
      receivedBy: r.receivedBy,
      receivedAt: r.receivedAt,
      createdAt: r.createdAt,
      lines: (r.lines ?? []).map((l: any) => ({
        id: l.id,
        productId: l.productId,
        productCode: l.product?.productCode ?? null,
        productName: l.product?.name ?? null,
        quantity: l.quantity,
        batchNumber: l.batchNumber,
        expiryDate: l.expiryDate,
        locationId: l.locationId,
        note: l.note,
      })),
    };
  }

  async listGoodsReceipts(
    user: AuthenticatedUser,
    filters: { companyId?: string; warehouseId?: string; status?: string },
  ) {
    const where: any = { ...companyFilter(user, filters.companyId) };
    if (filters.warehouseId) where.warehouseId = filters.warehouseId;
    if (filters.status) where.status = filters.status;
    const rows = await this.prisma.goodsReceipt.findMany({
      where,
      include: { warehouse: { select: { code: true } }, lines: { include: { product: { select: { productCode: true, name: true } } } } },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    return rows.map((r) => this.receiptResource(r));
  }

  async getGoodsReceipt(user: AuthenticatedUser, id: string) {
    const r = await this.prisma.goodsReceipt.findUnique({
      where: { id },
      include: { warehouse: { select: { code: true } }, lines: { include: { product: { select: { productCode: true, name: true } } } } },
    });
    if (!r || !isCompanyInScope(user, r.companyId, GROUP_PERM)) {
      throw new NotFoundAppException('Goods receipt not found.');
    }
    return this.receiptResource(r);
  }

  async createGoodsReceipt(user: AuthenticatedUser, dto: CreateGoodsReceiptDto) {
    if (!isCompanyInScope(user, dto.companyId, GROUP_PERM)) {
      throw new NotFoundAppException('Company not found.');
    }
    const wh = await this.prisma.warehouse.findUnique({ where: { id: dto.warehouseId } });
    if (!wh || wh.companyId !== dto.companyId) throw new NotFoundAppException('Warehouse not found.');
    if (dto.supplierId) {
      const s = await this.prisma.supplier.findUnique({ where: { id: dto.supplierId } });
      if (!s || s.companyId !== dto.companyId) throw new NotFoundAppException('Supplier not found.');
    }

    const lines: {
      productId: string;
      quantity: number;
      batchNumber: string | null;
      expiryDate: Date | null;
      locationId: string | null;
      note: string | null;
    }[] = [];
    for (const l of dto.lines) {
      const product = await this.resolveProduct(dto.companyId, l);
      lines.push({
        productId: product.id,
        quantity: l.quantity,
        batchNumber: l.batchNumber?.trim() || null,
        expiryDate: l.expiryDate ? new Date(l.expiryDate) : null,
        locationId: l.locationId ?? null,
        note: l.note ?? null,
      });
    }

    const receiptNumber = await this.nextNumber('GRN', dto.companyId, () =>
      this.prisma.goodsReceipt.count({ where: { companyId: dto.companyId } }),
    );
    const created = await this.prisma.goodsReceipt.create({
      data: {
        companyId: dto.companyId,
        warehouseId: dto.warehouseId,
        receiptNumber,
        supplierId: dto.supplierId ?? null,
        reference: dto.reference ?? null,
        note: dto.note ?? null,
        createdBy: user.id,
        lines: { create: lines },
      },
      include: { warehouse: { select: { code: true } }, lines: { include: { product: { select: { productCode: true, name: true } } } } },
    });
    await this.auditService.record({
      eventType: 'inventory.goods_receipt.created',
      sourceService: 'inventory-service',
      userId: user.id,
      companyId: dto.companyId,
      entityType: 'goods_receipt',
      entityId: created.id,
      action: 'create',
      newValue: { receiptNumber, warehouseId: dto.warehouseId, lines: lines.length },
    });
    return this.receiptResource(created);
  }

  async receiveGoodsReceipt(user: AuthenticatedUser, id: string) {
    const r = await this.prisma.goodsReceipt.findUnique({ where: { id }, include: { lines: true } });
    if (!r || !isCompanyInScope(user, r.companyId, GROUP_PERM)) {
      throw new NotFoundAppException('Goods receipt not found.');
    }
    if (r.status !== 'draft') throw new ConflictAppException(`This receipt is already ${r.status}.`);

    const defaultWh = await this.inventory.ensureDefaultWarehouse(r.companyId);
    const products = new Map<string, any>();
    for (const l of r.lines) {
      if (!products.has(l.productId)) {
        const p = await this.prisma.product.findUnique({ where: { id: l.productId } });
        await this.inventory.ensureBalanceInitialised(p, defaultWh.id);
        products.set(l.productId, await this.prisma.product.findUnique({ where: { id: l.productId } }));
      }
    }

    await this.prisma.$transaction(async (tx) => {
      for (const l of r.lines) {
        const product = products.get(l.productId);
        await this.inventory.applyDeltaTx(tx, {
          product,
          warehouseId: r.warehouseId,
          movementType: 'receipt',
          delta: l.quantity,
          reason: `Goods receipt ${r.receiptNumber}`,
          reference: r.receiptNumber,
          batchNumber: l.batchNumber,
          createdBy: user.id,
        });
        if (l.batchNumber) {
          await tx.stockBatch.upsert({
            where: {
              productId_warehouseId_batchNumber: {
                productId: l.productId,
                warehouseId: r.warehouseId,
                batchNumber: l.batchNumber,
              },
            },
            create: {
              companyId: r.companyId,
              productId: l.productId,
              warehouseId: r.warehouseId,
              batchNumber: l.batchNumber,
              expiryDate: l.expiryDate,
              quantity: l.quantity,
            },
            update: {
              quantity: { increment: l.quantity },
              ...(l.expiryDate ? { expiryDate: l.expiryDate } : {}),
            },
          });
        }
      }
      await tx.goodsReceipt.update({
        where: { id },
        data: { status: 'received', receivedBy: user.id, receivedAt: new Date() },
      });
    });

    await this.auditService.record({
      eventType: 'inventory.goods_receipt.received',
      sourceService: 'inventory-service',
      userId: user.id,
      companyId: r.companyId,
      entityType: 'goods_receipt',
      entityId: id,
      action: 'update',
      newValue: { receiptNumber: r.receiptNumber, lines: r.lines.length },
    });
    return this.getGoodsReceipt(user, id);
  }

  async cancelGoodsReceipt(user: AuthenticatedUser, id: string) {
    const r = await this.prisma.goodsReceipt.findUnique({ where: { id } });
    if (!r || !isCompanyInScope(user, r.companyId, GROUP_PERM)) {
      throw new NotFoundAppException('Goods receipt not found.');
    }
    if (r.status === 'received') throw new ConflictAppException('A received goods receipt cannot be cancelled.');
    const updated = await this.prisma.goodsReceipt.update({ where: { id }, data: { status: 'cancelled' } });
    await this.auditService.record({
      eventType: 'inventory.goods_receipt.cancelled',
      sourceService: 'inventory-service',
      userId: user.id,
      companyId: r.companyId,
      entityType: 'goods_receipt',
      entityId: id,
      action: 'update',
      previousValue: { status: r.status },
      newValue: { status: 'cancelled' },
    });
    return updated;
  }

  // ---- Pick lists (picking / packing / dispatch) --------------

  private async pickResource(r: any) {
    const names = await this.employeeNames([r.assignedToEmployeeId].filter(Boolean));
    return {
      id: r.id,
      companyId: r.companyId,
      warehouseId: r.warehouseId,
      warehouseCode: r.warehouse?.code ?? null,
      pickNumber: r.pickNumber,
      orderId: r.orderId,
      assignedToEmployeeId: r.assignedToEmployeeId,
      assignedToName: r.assignedToEmployeeId ? names.get(r.assignedToEmployeeId) ?? null : null,
      reference: r.reference,
      note: r.note,
      status: r.status,
      pickedAt: r.pickedAt,
      packedAt: r.packedAt,
      dispatchedAt: r.dispatchedAt,
      createdAt: r.createdAt,
      lines: (r.lines ?? []).map((l: any) => ({
        id: l.id,
        productId: l.productId,
        productCode: l.product?.productCode ?? null,
        productName: l.product?.name ?? null,
        quantityRequested: l.quantityRequested,
        quantityPicked: l.quantityPicked,
        locationId: l.locationId,
        note: l.note,
      })),
    };
  }

  async listPickLists(
    user: AuthenticatedUser,
    filters: { companyId?: string; warehouseId?: string; status?: string },
  ) {
    const where: any = { ...companyFilter(user, filters.companyId) };
    if (filters.warehouseId) where.warehouseId = filters.warehouseId;
    if (filters.status) where.status = filters.status;
    const rows = await this.prisma.pickList.findMany({
      where,
      include: { warehouse: { select: { code: true } }, lines: { include: { product: { select: { productCode: true, name: true } } } } },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    return Promise.all(rows.map((r) => this.pickResource(r)));
  }

  async getPickList(user: AuthenticatedUser, id: string) {
    const r = await this.prisma.pickList.findUnique({
      where: { id },
      include: { warehouse: { select: { code: true } }, lines: { include: { product: { select: { productCode: true, name: true } } } } },
    });
    if (!r || !isCompanyInScope(user, r.companyId, GROUP_PERM)) {
      throw new NotFoundAppException('Pick list not found.');
    }
    return this.pickResource(r);
  }

  async createPickList(user: AuthenticatedUser, dto: CreatePickListDto) {
    if (!isCompanyInScope(user, dto.companyId, GROUP_PERM)) {
      throw new NotFoundAppException('Company not found.');
    }
    const wh = await this.prisma.warehouse.findUnique({ where: { id: dto.warehouseId } });
    if (!wh || wh.companyId !== dto.companyId) throw new NotFoundAppException('Warehouse not found.');
    if (dto.assignedToEmployeeId) await this.employeeInCompany(dto.assignedToEmployeeId, dto.companyId);

    let lines: { productId: string; quantityRequested: number; locationId: string | null; note: string | null }[] = [];
    if (dto.orderId) {
      const order = await this.prisma.order.findUnique({ where: { id: dto.orderId }, include: { items: true } });
      if (!order || order.companyId !== dto.companyId) throw new NotFoundAppException('Order not found.');
      lines = order.items.map((it) => ({
        productId: it.productId,
        quantityRequested: it.quantity,
        locationId: null,
        note: null,
      }));
    } else if (dto.lines?.length) {
      for (const l of dto.lines) {
        const product = await this.resolveProduct(dto.companyId, l);
        lines.push({
          productId: product.id,
          quantityRequested: l.quantityRequested,
          locationId: l.locationId ?? null,
          note: l.note ?? null,
        });
      }
    } else {
      throw new ConflictAppException('Supply an orderId or at least one line.');
    }

    const pickNumber = await this.nextNumber('PICK', dto.companyId, () =>
      this.prisma.pickList.count({ where: { companyId: dto.companyId } }),
    );
    const created = await this.prisma.pickList.create({
      data: {
        companyId: dto.companyId,
        warehouseId: dto.warehouseId,
        pickNumber,
        orderId: dto.orderId ?? null,
        assignedToEmployeeId: dto.assignedToEmployeeId ?? null,
        reference: dto.reference ?? null,
        note: dto.note ?? null,
        createdBy: user.id,
        lines: { create: lines },
      },
      include: { warehouse: { select: { code: true } }, lines: { include: { product: { select: { productCode: true, name: true } } } } },
    });
    await this.auditService.record({
      eventType: 'inventory.pick_list.created',
      sourceService: 'inventory-service',
      userId: user.id,
      companyId: dto.companyId,
      entityType: 'pick_list',
      entityId: created.id,
      action: 'create',
      newValue: { pickNumber, warehouseId: dto.warehouseId, orderId: dto.orderId ?? null, lines: lines.length },
    });
    return this.pickResource(created);
  }

  async assignPickList(user: AuthenticatedUser, id: string, dto: AssignPickListDto) {
    const r = await this.prisma.pickList.findUnique({ where: { id } });
    if (!r || !isCompanyInScope(user, r.companyId, GROUP_PERM)) {
      throw new NotFoundAppException('Pick list not found.');
    }
    if (['dispatched', 'cancelled'].includes(r.status)) {
      throw new ConflictAppException(`This pick list is ${r.status}.`);
    }
    await this.employeeInCompany(dto.assignedToEmployeeId, r.companyId);
    await this.prisma.pickList.update({
      where: { id },
      data: {
        assignedToEmployeeId: dto.assignedToEmployeeId,
        status: r.status === 'pending' ? 'picking' : r.status,
      },
    });
    await this.auditService.record({
      eventType: 'inventory.pick_list.assigned',
      sourceService: 'inventory-service',
      userId: user.id,
      companyId: r.companyId,
      entityType: 'pick_list',
      entityId: id,
      action: 'update',
      newValue: { assignedToEmployeeId: dto.assignedToEmployeeId },
    });
    return this.getPickList(user, id);
  }

  async pick(user: AuthenticatedUser, id: string, dto: PickDto) {
    const r = await this.prisma.pickList.findUnique({ where: { id }, include: { lines: true } });
    if (!r || !isCompanyInScope(user, r.companyId, GROUP_PERM)) {
      throw new NotFoundAppException('Pick list not found.');
    }
    if (!['pending', 'picking'].includes(r.status)) {
      throw new ConflictAppException(`Cannot pick a ${r.status} pick list.`);
    }

    const pickedByLine = new Map<string, number>();
    for (const l of r.lines) pickedByLine.set(l.id, l.quantityRequested);
    for (const entry of dto.lines ?? []) {
      const line = r.lines.find((l) => l.id === entry.lineId);
      if (!line) throw new NotFoundAppException(`Line ${entry.lineId} not on this pick list.`);
      if (entry.quantityPicked > line.quantityRequested) {
        throw new ConflictAppException(
          `Cannot pick ${entry.quantityPicked} of ${line.quantityRequested} requested.`,
        );
      }
      pickedByLine.set(line.id, entry.quantityPicked);
    }

    const defaultWh = await this.inventory.ensureDefaultWarehouse(r.companyId);
    const products = new Map<string, any>();
    for (const l of r.lines) {
      if (!products.has(l.productId)) {
        const p = await this.prisma.product.findUnique({ where: { id: l.productId } });
        await this.inventory.ensureBalanceInitialised(p, defaultWh.id);
        products.set(l.productId, await this.prisma.product.findUnique({ where: { id: l.productId } }));
      }
    }
    // availability check
    for (const l of r.lines) {
      const want = pickedByLine.get(l.id) ?? 0;
      if (want <= 0) continue;
      const have = await this.inventory.balanceQty(l.productId, r.warehouseId);
      if (want > have) {
        const p = products.get(l.productId);
        throw new ConflictAppException(
          `Cannot pick ${want} of ${p.productCode} — only ${have} in this warehouse.`,
        );
      }
    }

    await this.prisma.$transaction(async (tx) => {
      for (const l of r.lines) {
        const want = pickedByLine.get(l.id) ?? 0;
        await tx.pickListLine.update({ where: { id: l.id }, data: { quantityPicked: want } });
        if (want > 0) {
          await this.inventory.applyDeltaTx(tx, {
            product: products.get(l.productId),
            warehouseId: r.warehouseId,
            movementType: 'issue',
            delta: -want,
            reason: `Pick list ${r.pickNumber}`,
            reference: r.pickNumber,
            createdBy: user.id,
          });
        }
      }
      await tx.pickList.update({ where: { id }, data: { status: 'picked', pickedAt: new Date() } });
    });

    await this.auditService.record({
      eventType: 'inventory.pick_list.picked',
      sourceService: 'inventory-service',
      userId: user.id,
      companyId: r.companyId,
      entityType: 'pick_list',
      entityId: id,
      action: 'update',
      newValue: { pickNumber: r.pickNumber, lines: r.lines.length },
    });
    return this.getPickList(user, id);
  }

  async packPickList(user: AuthenticatedUser, id: string) {
    const r = await this.prisma.pickList.findUnique({ where: { id } });
    if (!r || !isCompanyInScope(user, r.companyId, GROUP_PERM)) {
      throw new NotFoundAppException('Pick list not found.');
    }
    if (r.status !== 'picked') throw new ConflictAppException('Only a picked pick list can be packed.');
    await this.prisma.pickList.update({ where: { id }, data: { status: 'packed', packedAt: new Date() } });
    // Nudge a linked order forward to 'packed' if it is behind.
    if (r.orderId) {
      const order = await this.prisma.order.findUnique({ where: { id: r.orderId } });
      if (order && ['placed', 'confirmed'].includes(order.status)) {
        await this.prisma.order.update({ where: { id: order.id }, data: { status: 'packed' } });
      }
    }
    await this.auditService.record({
      eventType: 'inventory.pick_list.packed',
      sourceService: 'inventory-service',
      userId: user.id,
      companyId: r.companyId,
      entityType: 'pick_list',
      entityId: id,
      action: 'update',
      newValue: { pickNumber: r.pickNumber },
    });
    return this.getPickList(user, id);
  }

  async dispatchPickList(user: AuthenticatedUser, id: string) {
    const r = await this.prisma.pickList.findUnique({ where: { id } });
    if (!r || !isCompanyInScope(user, r.companyId, GROUP_PERM)) {
      throw new NotFoundAppException('Pick list not found.');
    }
    if (r.status !== 'packed') throw new ConflictAppException('Only a packed pick list can be dispatched.');
    await this.prisma.pickList.update({
      where: { id },
      data: { status: 'dispatched', dispatchedAt: new Date() },
    });
    if (r.orderId) {
      const order = await this.prisma.order.findUnique({ where: { id: r.orderId } });
      if (order && ['placed', 'confirmed', 'packed'].includes(order.status)) {
        await this.prisma.order.update({ where: { id: order.id }, data: { status: 'out_for_delivery' } });
      }
    }
    await this.auditService.record({
      eventType: 'inventory.pick_list.dispatched',
      sourceService: 'inventory-service',
      userId: user.id,
      companyId: r.companyId,
      entityType: 'pick_list',
      entityId: id,
      action: 'update',
      newValue: { pickNumber: r.pickNumber, orderId: r.orderId ?? null },
    });
    return this.getPickList(user, id);
  }

  async cancelPickList(user: AuthenticatedUser, id: string) {
    const r = await this.prisma.pickList.findUnique({ where: { id }, include: { lines: true } });
    if (!r || !isCompanyInScope(user, r.companyId, GROUP_PERM)) {
      throw new NotFoundAppException('Pick list not found.');
    }
    if (['dispatched', 'cancelled'].includes(r.status)) {
      throw new ConflictAppException(`This pick list is ${r.status}.`);
    }
    const mustReturn = ['picked', 'packed'].includes(r.status);
    if (mustReturn) {
      const defaultWh = await this.inventory.ensureDefaultWarehouse(r.companyId);
      const products = new Map<string, any>();
      for (const l of r.lines) {
        if (!products.has(l.productId)) {
          const p = await this.prisma.product.findUnique({ where: { id: l.productId } });
          await this.inventory.ensureBalanceInitialised(p, defaultWh.id);
          products.set(l.productId, await this.prisma.product.findUnique({ where: { id: l.productId } }));
        }
      }
      await this.prisma.$transaction(async (tx) => {
        for (const l of r.lines) {
          if (l.quantityPicked > 0) {
            await this.inventory.applyDeltaTx(tx, {
              product: products.get(l.productId),
              warehouseId: r.warehouseId,
              movementType: 'return',
              delta: l.quantityPicked,
              reason: `Pick list ${r.pickNumber} cancelled`,
              reference: r.pickNumber,
              createdBy: user.id,
            });
          }
        }
        await tx.pickList.update({ where: { id }, data: { status: 'cancelled' } });
      });
    } else {
      await this.prisma.pickList.update({ where: { id }, data: { status: 'cancelled' } });
    }
    await this.auditService.record({
      eventType: 'inventory.pick_list.cancelled',
      sourceService: 'inventory-service',
      userId: user.id,
      companyId: r.companyId,
      entityType: 'pick_list',
      entityId: id,
      action: 'update',
      previousValue: { status: r.status },
      newValue: { status: 'cancelled', stockReturned: mustReturn },
    });
    return this.getPickList(user, id);
  }

  // ---- Stock counts (count + reconciliation) ----------------

  private countResource(r: any) {
    return {
      id: r.id,
      companyId: r.companyId,
      warehouseId: r.warehouseId,
      warehouseCode: r.warehouse?.code ?? null,
      countNumber: r.countNumber,
      reference: r.reference,
      note: r.note,
      status: r.status,
      reconciledAt: r.reconciledAt,
      createdAt: r.createdAt,
      lines: (r.lines ?? []).map((l: any) => ({
        id: l.id,
        productId: l.productId,
        productCode: l.product?.productCode ?? null,
        productName: l.product?.name ?? null,
        systemQuantity: l.systemQuantity,
        countedQuantity: l.countedQuantity,
        variance: l.variance,
        locationId: l.locationId,
      })),
    };
  }

  async listStockCounts(
    user: AuthenticatedUser,
    filters: { companyId?: string; warehouseId?: string; status?: string },
  ) {
    const where: any = { ...companyFilter(user, filters.companyId) };
    if (filters.warehouseId) where.warehouseId = filters.warehouseId;
    if (filters.status) where.status = filters.status;
    const rows = await this.prisma.stockCount.findMany({
      where,
      include: { warehouse: { select: { code: true } }, lines: { include: { product: { select: { productCode: true, name: true } } } } },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    return rows.map((r) => this.countResource(r));
  }

  async getStockCount(user: AuthenticatedUser, id: string) {
    const r = await this.prisma.stockCount.findUnique({
      where: { id },
      include: { warehouse: { select: { code: true } }, lines: { include: { product: { select: { productCode: true, name: true } } } } },
    });
    if (!r || !isCompanyInScope(user, r.companyId, GROUP_PERM)) {
      throw new NotFoundAppException('Stock count not found.');
    }
    return this.countResource(r);
  }

  private async snapshotLine(companyId: string, warehouseId: string, productId: string, locationId: string | null) {
    const qty = await this.inventory.balanceQty(productId, warehouseId);
    return { productId, systemQuantity: qty, locationId };
  }

  async createStockCount(user: AuthenticatedUser, dto: CreateStockCountDto) {
    if (!isCompanyInScope(user, dto.companyId, GROUP_PERM)) {
      throw new NotFoundAppException('Company not found.');
    }
    const wh = await this.prisma.warehouse.findUnique({ where: { id: dto.warehouseId } });
    if (!wh || wh.companyId !== dto.companyId) throw new NotFoundAppException('Warehouse not found.');

    let lines: { productId: string; systemQuantity: number; locationId: string | null }[] = [];
    if (dto.scope === 'full') {
      const balances = await this.prisma.stockBalance.findMany({
        where: { warehouseId: dto.warehouseId },
        select: { productId: true, quantity: true },
      });
      lines = balances.map((b) => ({ productId: b.productId, systemQuantity: b.quantity, locationId: null }));
    } else if (dto.lines?.length) {
      for (const l of dto.lines) {
        const product = await this.resolveProduct(dto.companyId, l);
        lines.push(await this.snapshotLine(dto.companyId, dto.warehouseId, product.id, l.locationId ?? null));
      }
    }

    const countNumber = await this.nextNumber('CNT', dto.companyId, () =>
      this.prisma.stockCount.count({ where: { companyId: dto.companyId } }),
    );
    const created = await this.prisma.stockCount.create({
      data: {
        companyId: dto.companyId,
        warehouseId: dto.warehouseId,
        countNumber,
        reference: dto.reference ?? null,
        note: dto.note ?? null,
        status: 'open',
        createdBy: user.id,
        lines: { create: lines },
      },
      include: { warehouse: { select: { code: true } }, lines: { include: { product: { select: { productCode: true, name: true } } } } },
    });
    await this.auditService.record({
      eventType: 'inventory.stock_count.created',
      sourceService: 'inventory-service',
      userId: user.id,
      companyId: dto.companyId,
      entityType: 'stock_count',
      entityId: created.id,
      action: 'create',
      newValue: { countNumber, warehouseId: dto.warehouseId, lines: lines.length },
    });
    return this.countResource(created);
  }

  async addStockCountLines(user: AuthenticatedUser, id: string, dto: AddStockCountLinesDto) {
    const r = await this.prisma.stockCount.findUnique({ where: { id } });
    if (!r || !isCompanyInScope(user, r.companyId, GROUP_PERM)) {
      throw new NotFoundAppException('Stock count not found.');
    }
    if (['reconciled', 'cancelled'].includes(r.status)) {
      throw new ConflictAppException(`This count is ${r.status}.`);
    }
    for (const l of dto.lines) {
      const product = await this.resolveProduct(r.companyId, l);
      const snap = await this.snapshotLine(r.companyId, r.warehouseId, product.id, l.locationId ?? null);
      await this.prisma.stockCountLine.create({ data: { stockCountId: id, ...snap } });
    }
    if (r.status === 'open') {
      await this.prisma.stockCount.update({ where: { id }, data: { status: 'counting' } });
    }
    return this.getStockCount(user, id);
  }

  async setCountedQuantity(user: AuthenticatedUser, id: string, lineId: string, dto: SetCountedQuantityDto) {
    const r = await this.prisma.stockCount.findUnique({ where: { id } });
    if (!r || !isCompanyInScope(user, r.companyId, GROUP_PERM)) {
      throw new NotFoundAppException('Stock count not found.');
    }
    if (['reconciled', 'cancelled'].includes(r.status)) {
      throw new ConflictAppException(`This count is ${r.status}.`);
    }
    const line = await this.prisma.stockCountLine.findFirst({ where: { id: lineId, stockCountId: id } });
    if (!line) throw new NotFoundAppException('Count line not found.');
    await this.prisma.stockCountLine.update({
      where: { id: lineId },
      data: { countedQuantity: dto.countedQuantity },
    });
    if (r.status === 'open') {
      await this.prisma.stockCount.update({ where: { id }, data: { status: 'counting' } });
    }
    return this.getStockCount(user, id);
  }

  async reconcileStockCount(user: AuthenticatedUser, id: string) {
    const r = await this.prisma.stockCount.findUnique({ where: { id }, include: { lines: true } });
    if (!r || !isCompanyInScope(user, r.companyId, GROUP_PERM)) {
      throw new NotFoundAppException('Stock count not found.');
    }
    if (['reconciled', 'cancelled'].includes(r.status)) {
      throw new ConflictAppException(`This count is already ${r.status}.`);
    }
    const counted = r.lines.filter((l) => l.countedQuantity !== null && l.countedQuantity !== undefined);
    if (counted.length === 0) throw new ConflictAppException('No lines have a counted quantity yet.');

    const defaultWh = await this.inventory.ensureDefaultWarehouse(r.companyId);
    const products = new Map<string, any>();
    for (const l of counted) {
      if (!products.has(l.productId)) {
        const p = await this.prisma.product.findUnique({ where: { id: l.productId } });
        await this.inventory.ensureBalanceInitialised(p, defaultWh.id);
        products.set(l.productId, await this.prisma.product.findUnique({ where: { id: l.productId } }));
      }
    }

    let adjustments = 0;
    await this.prisma.$transaction(async (tx) => {
      for (const l of counted) {
        const current = await this.inventory.balanceQty(l.productId, r.warehouseId);
        const variance = (l.countedQuantity as number) - current;
        await tx.stockCountLine.update({ where: { id: l.id }, data: { variance } });
        if (variance !== 0) {
          adjustments += 1;
          await this.inventory.applyDeltaTx(tx, {
            product: products.get(l.productId),
            warehouseId: r.warehouseId,
            movementType: 'count',
            setAbsolute: l.countedQuantity as number,
            reason: `Stock count reconciliation ${r.countNumber}`,
            reference: r.countNumber,
            createdBy: user.id,
          });
        }
      }
      await tx.stockCount.update({
        where: { id },
        data: { status: 'reconciled', reconciledAt: new Date() },
      });
    });

    await this.auditService.record({
      eventType: 'inventory.stock_count.reconciled',
      sourceService: 'inventory-service',
      userId: user.id,
      companyId: r.companyId,
      entityType: 'stock_count',
      entityId: id,
      action: 'update',
      newValue: { countNumber: r.countNumber, linesCounted: counted.length, adjustmentsPosted: adjustments },
    });
    return this.getStockCount(user, id);
  }

  async cancelStockCount(user: AuthenticatedUser, id: string) {
    const r = await this.prisma.stockCount.findUnique({ where: { id } });
    if (!r || !isCompanyInScope(user, r.companyId, GROUP_PERM)) {
      throw new NotFoundAppException('Stock count not found.');
    }
    if (r.status === 'reconciled') throw new ConflictAppException('A reconciled count cannot be cancelled.');
    const updated = await this.prisma.stockCount.update({ where: { id }, data: { status: 'cancelled' } });
    await this.auditService.record({
      eventType: 'inventory.stock_count.cancelled',
      sourceService: 'inventory-service',
      userId: user.id,
      companyId: r.companyId,
      entityType: 'stock_count',
      entityId: id,
      action: 'update',
      previousValue: { status: r.status },
      newValue: { status: 'cancelled' },
    });
    return updated;
  }
}
