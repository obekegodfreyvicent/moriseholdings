import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConflictAppException, NotFoundAppException } from '../common/app-exception';
import { AuthenticatedUser } from '../common/strategies/jwt.strategy';
import { AuthenticatedCustomer } from '../customer-portal/common/customer-auth.types';
import { hasGroupVisibility, isCompanyInScope } from '../common/scope.util';
import { AuditService } from '../common/audit/audit.service';
import {
  AdvanceDeliveryStatusDto,
  AssignDriverDto,
  CancelDeliveryDto,
  CreateDeliveryDriverDto,
  CreateDeliveryDto,
  FailDeliveryDto,
  ProofOfDeliveryDto,
  UpdateDeliveryDriverDto,
} from './dto/delivery.dto';

const GROUP_PERM = 'delivery.viewAll';

// The physical fulfilment states a customer order passes through — reused
// here so that completing a delivery can move its order to `delivered`
// (the last step) without importing OrdersService.
const ORDER_FULFILMENT_STATES = ['packed', 'out_for_delivery'];

type DeliveryStatus = 'pending' | 'assigned' | 'picked_up' | 'in_transit' | 'delivered' | 'failed' | 'cancelled';

@Injectable()
export class DeliveryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  // ---- scope helpers -------------------------------------------------------

  private companyFilter(user: AuthenticatedUser, companyId?: string) {
    if (hasGroupVisibility(user, GROUP_PERM)) return companyId ? { companyId } : {};
    const ids = user.scopes.map((s) => s.companyId);
    return {
      companyId: companyId && ids.includes(companyId) ? companyId : { in: ids.length ? ids : ['__none__'] },
    };
  }

  private assertInScope(user: AuthenticatedUser, companyId: string) {
    if (!isCompanyInScope(user, companyId, GROUP_PERM)) {
      throw new NotFoundAppException('Delivery not found.');
    }
  }

  // ---- read --------------------------------------------------------------

  async list(
    user: AuthenticatedUser,
    filters: { companyId?: string; status?: string; customerId?: string; q?: string },
  ) {
    const where: any = { ...this.companyFilter(user, filters.companyId) };
    if (filters.status) where.status = filters.status;
    if (filters.customerId) where.customerId = filters.customerId;
    if (filters.q) {
      where.OR = [
        { deliveryNumber: { contains: filters.q, mode: 'insensitive' } },
        { dropAddress: { contains: filters.q, mode: 'insensitive' } },
        { recipientName: { contains: filters.q, mode: 'insensitive' } },
      ];
    }
    const rows = await this.prisma.delivery.findMany({
      where,
      include: { driver: true, _count: { select: { events: true } } },
      orderBy: [{ createdAt: 'desc' }],
      take: 500,
    });
    const [customers, companies, orders] = await this.decorators(rows);
    return rows.map((d) => this.toResource(d, customers, companies, orders));
  }

  async get(user: AuthenticatedUser, id: string) {
    const d = await this.prisma.delivery.findUnique({
      where: { id },
      include: { driver: true, events: { orderBy: { createdAt: 'asc' } } },
    });
    if (!d) throw new NotFoundAppException('Delivery not found.');
    this.assertInScope(user, d.companyId);
    const [customers, companies, orders] = await this.decorators([d]);
    const eventActors = await this.userNames([
      ...d.events.map((e) => e.recordedBy),
      d.createdBy,
    ]);
    let invoice = null as any;
    if (d.invoiceId) {
      invoice = await this.prisma.invoice.findUnique({
        where: { id: d.invoiceId },
        select: { id: true, invoiceNumber: true, amount: true, dueDate: true, paidAt: true },
      });
    }
    return {
      ...this.toResource(d, customers, companies, orders),
      createdByName: eventActors.get(d.createdBy) ?? d.createdBy,
      invoice: invoice
        ? {
            id: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            amount: invoice.amount.toString(),
            dueDate: invoice.dueDate,
            paidAt: invoice.paidAt,
          }
        : null,
      events: d.events.map((e) => ({
        id: e.id,
        status: e.status,
        note: e.note,
        locationText: e.locationText,
        recordedBy: e.recordedBy,
        recordedByName: eventActors.get(e.recordedBy) ?? e.recordedBy,
        createdAt: e.createdAt,
      })),
    };
  }

  // Orders that could still be handed to Logistics for delivery: in a
  // physical-fulfilment state, not cancelled, and without a delivery yet.
  async eligibleOrders(user: AuthenticatedUser, companyId?: string) {
    // `companyId` here filters by the *selling* subsidiary (origin), not the
    // Logistics company — dispatchers pick which subsidiary's orders to move.
    const existing = await this.prisma.delivery.findMany({
      where: { orderId: { not: null } },
      select: { orderId: true },
    });
    const takenOrderIds = new Set(existing.map((e) => e.orderId as string));
    const orders = await this.prisma.order.findMany({
      where: {
        status: { in: ['confirmed', 'packed', 'out_for_delivery'] },
        ...(companyId ? { companyId } : {}),
      },
      include: { company: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    const customerIds = [...new Set(orders.map((o) => o.customerId))];
    const customers = await this.customerMap(customerIds);
    return orders
      .filter((o) => !takenOrderIds.has(o.id))
      .map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        companyId: o.companyId,
        companyName: o.company?.name ?? null,
        customerId: o.customerId,
        customerName: customers.get(o.customerId)?.name ?? o.customerId,
        status: o.status,
        totalAmount: o.totalAmount.toString(),
        deliveryFee: o.deliveryFee.toString(),
        requestedDeliveryDate: o.requestedDeliveryDate,
        createdAt: o.createdAt,
      }));
  }

  // ---- write: deliveries ----------------------------------------------------

  async create(user: AuthenticatedUser, dto: CreateDeliveryDto) {
    this.assertInScope(user, dto.companyId);
    if (!dto.orderId && !dto.invoiceId && !dto.customerId) {
      throw new ConflictAppException('A delivery needs an orderId, an invoiceId, or a customerId.');
    }

    let kind: 'goods' | 'invoice' = dto.kind ?? (dto.invoiceId && !dto.orderId ? 'invoice' : 'goods');
    let customerId = dto.customerId ?? null;
    let originCompanyId: string | null = null;
    let originBranchId = dto.originBranchId ?? null;
    let orderId = dto.orderId ?? null;
    let invoiceId = dto.invoiceId ?? null;
    let dropAddress = dto.dropAddress ?? null;
    let dropContactName = dto.dropContactName ?? null;
    let dropContactPhone = dto.dropContactPhone ?? null;
    let deliveryFee = 0;

    if (orderId) {
      const order = await this.prisma.order.findUnique({ where: { id: orderId } });
      if (!order) throw new NotFoundAppException('Order not found.');
      if (order.status === 'cancelled') {
        throw new ConflictAppException('Cannot create a delivery for a cancelled order.');
      }
      const already = await this.prisma.delivery.findUnique({ where: { orderId } });
      if (already) throw new ConflictAppException(`Order ${order.orderNumber} already has a delivery.`);
      customerId = order.customerId;
      originCompanyId = order.companyId;
      deliveryFee = Number(order.deliveryFee ?? 0);
      if (order.deliveryAddressId) {
        const addr = await this.prisma.deliveryAddress.findUnique({ where: { id: order.deliveryAddressId } });
        if (addr && !dropAddress) dropAddress = addr.addressLine;
      }
    }

    if (invoiceId) {
      const invoice = await this.prisma.invoice.findUnique({ where: { id: invoiceId } });
      if (!invoice) throw new NotFoundAppException('Invoice not found.');
      customerId = customerId ?? invoice.customerId;
      originCompanyId = originCompanyId ?? invoice.companyId;
      if (!orderId) kind = 'invoice';
    }

    if (!customerId) throw new ConflictAppException('Could not determine the customer for this delivery.');
    const customer = await this.prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) throw new NotFoundAppException('Customer not found.');
    originCompanyId = originCompanyId ?? customer.companyId;
    if (!dropAddress) dropAddress = customer.address ?? null;
    if (!dropContactName) dropContactName = customer.name;
    if (!dropContactPhone) dropContactPhone = customer.contactPhone ?? null;
    if (!dropAddress) {
      throw new ConflictAppException('No delivery address found — pass dropAddress.');
    }

    const count = await this.prisma.delivery.count({ where: { companyId: dto.companyId } });
    const deliveryNumber = `DEL-2026-${String(count + 1).padStart(4, '0')}`;

    const created = await this.prisma.delivery.create({
      data: {
        deliveryNumber,
        companyId: dto.companyId,
        originCompanyId,
        originBranchId,
        customerId,
        orderId,
        invoiceId,
        kind,
        status: dto.driverId ? 'assigned' : 'pending',
        driverId: dto.driverId ?? null,
        dropAddress,
        dropContactName,
        dropContactPhone,
        instructions: dto.instructions ?? null,
        scheduledDate: dto.scheduledDate ? new Date(dto.scheduledDate) : null,
        deliveryFee,
        assignedAt: dto.driverId ? new Date() : null,
        createdBy: user.id,
        events: {
          create: [
            { status: 'pending', note: 'Delivery created', recordedBy: user.id },
            ...(dto.driverId ? [{ status: 'assigned' as const, note: 'Driver assigned', recordedBy: user.id }] : []),
          ],
        },
      },
      include: { driver: true },
    });

    await this.audit(user, 'delivery.created', created.companyId, created.id, null, {
      deliveryNumber,
      kind,
      orderId,
      invoiceId,
      status: created.status,
    });
    return this.get(user, created.id);
  }

  async assignDriver(user: AuthenticatedUser, id: string, dto: AssignDriverDto) {
    const d = await this.loadForWrite(user, id);
    if (['delivered', 'cancelled'].includes(d.status)) {
      throw new ConflictAppException(`Cannot assign a driver to a ${d.status} delivery.`);
    }
    const driver = await this.prisma.deliveryDriver.findUnique({ where: { id: dto.driverId } });
    if (!driver || driver.companyId !== d.companyId) throw new NotFoundAppException('Driver not found.');
    if (!driver.active) throw new ConflictAppException('That driver is not active.');

    const updated = await this.prisma.delivery.update({
      where: { id },
      data: {
        driverId: dto.driverId,
        status: d.status === 'pending' ? 'assigned' : d.status,
        assignedAt: d.assignedAt ?? new Date(),
        scheduledDate: dto.scheduledDate ? new Date(dto.scheduledDate) : d.scheduledDate,
        events: {
          create: {
            status: (d.status === 'pending' ? 'assigned' : d.status) as DeliveryStatus,
            note: dto.note ?? `Assigned to ${driver.name}${driver.vehicleReg ? ` (${driver.vehicleReg})` : ''}`,
            recordedBy: user.id,
          },
        },
      },
    });
    await this.audit(user, 'delivery.driver_assigned', d.companyId, id, { driverId: d.driverId }, { driverId: dto.driverId });
    return this.get(user, updated.id);
  }

  async advanceStatus(user: AuthenticatedUser, id: string, dto: AdvanceDeliveryStatusDto) {
    const d = await this.loadForWrite(user, id);
    const order: Record<string, DeliveryStatus[]> = {
      pending: ['assigned'],
      assigned: ['picked_up'],
      picked_up: ['in_transit'],
      in_transit: [],
    };
    const allowed = order[d.status] ?? [];
    if (!allowed.includes(dto.status)) {
      throw new ConflictAppException(`Cannot move a "${d.status}" delivery to "${dto.status}".`);
    }
    if (dto.status !== 'assigned' && !d.driverId) {
      throw new ConflictAppException('Assign a driver before marking the delivery picked up.');
    }
    const stamp: Record<string, string> = {
      assigned: 'assignedAt',
      picked_up: 'pickedUpAt',
      in_transit: 'inTransitAt',
    };
    const updated = await this.prisma.delivery.update({
      where: { id },
      data: {
        status: dto.status,
        [stamp[dto.status]]: new Date(),
        events: {
          create: { status: dto.status, note: dto.note ?? null, locationText: dto.locationText ?? null, recordedBy: user.id },
        },
      },
    });
    await this.audit(user, 'delivery.status_advanced', d.companyId, id, { status: d.status }, { status: dto.status });
    return this.get(user, updated.id);
  }

  async captureProof(user: AuthenticatedUser, id: string, dto: ProofOfDeliveryDto) {
    const d = await this.loadForWrite(user, id);
    if (!['picked_up', 'in_transit', 'assigned'].includes(d.status)) {
      throw new ConflictAppException(`Cannot complete a "${d.status}" delivery.`);
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const del = await tx.delivery.update({
        where: { id },
        data: {
          status: 'delivered',
          deliveredAt: new Date(),
          proofType: dto.proofType,
          proofReference: dto.proofReference ?? null,
          recipientName: dto.recipientName,
          events: {
            create: {
              status: 'delivered',
              note: dto.note ?? `Received by ${dto.recipientName} — ${dto.proofType} proof`,
              locationText: dto.locationText ?? null,
              recordedBy: user.id,
            },
          },
        },
      });
      // Completing a goods delivery also completes its order (last step of
      // the order fulfilment sequence), if the order is still mid-flight.
      if (del.orderId) {
        const ord = await tx.order.findUnique({ where: { id: del.orderId } });
        if (ord && ORDER_FULFILMENT_STATES.includes(ord.status)) {
          await tx.order.update({ where: { id: ord.id }, data: { status: 'delivered' } });
        }
      }
      return del;
    });
    await this.audit(user, 'delivery.delivered', d.companyId, id, { status: d.status }, {
      status: 'delivered',
      proofType: dto.proofType,
      recipientName: dto.recipientName,
    });
    return this.get(user, updated.id);
  }

  async failDelivery(user: AuthenticatedUser, id: string, dto: FailDeliveryDto) {
    const d = await this.loadForWrite(user, id);
    if (['delivered', 'cancelled'].includes(d.status)) {
      throw new ConflictAppException(`Cannot fail a "${d.status}" delivery.`);
    }
    const updated = await this.prisma.delivery.update({
      where: { id },
      data: {
        status: 'failed',
        failedAt: new Date(),
        failureReason: dto.reason,
        events: {
          create: { status: 'failed', note: dto.reason, locationText: dto.locationText ?? null, recordedBy: user.id },
        },
      },
    });
    await this.audit(user, 'delivery.failed', d.companyId, id, { status: d.status }, { status: 'failed', reason: dto.reason });
    return this.get(user, updated.id);
  }

  async cancelDelivery(user: AuthenticatedUser, id: string, dto: CancelDeliveryDto) {
    const d = await this.loadForWrite(user, id);
    if (['delivered', 'cancelled'].includes(d.status)) {
      throw new ConflictAppException(`Cannot cancel a "${d.status}" delivery.`);
    }
    const updated = await this.prisma.delivery.update({
      where: { id },
      data: {
        status: 'cancelled',
        cancelledAt: new Date(),
        events: {
          create: { status: 'cancelled', note: dto.reason ?? 'Delivery cancelled', recordedBy: user.id },
        },
      },
    });
    await this.audit(user, 'delivery.cancelled', d.companyId, id, { status: d.status }, { status: 'cancelled' });
    return this.get(user, updated.id);
  }

  // ---- metrics -----------------------------------------------------------

  async metrics(user: AuthenticatedUser, companyId?: string) {
    const where: any = { ...this.companyFilter(user, companyId) };
    const rows = await this.prisma.delivery.findMany({
      where,
      select: {
        status: true,
        scheduledDate: true,
        deliveredAt: true,
        pickedUpAt: true,
      },
    });
    const byStatus: Record<string, number> = {
      pending: 0,
      assigned: 0,
      picked_up: 0,
      in_transit: 0,
      delivered: 0,
      failed: 0,
      cancelled: 0,
    };
    let onTime = 0;
    let scheduledDelivered = 0;
    let transitMs = 0;
    let transitSamples = 0;
    for (const r of rows) {
      byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
      if (r.status === 'delivered' && r.deliveredAt) {
        if (r.scheduledDate) {
          scheduledDelivered += 1;
          // on time = delivered on or before the scheduled calendar day
          if (new Date(r.deliveredAt) <= endOfDay(r.scheduledDate)) onTime += 1;
        }
        if (r.pickedUpAt) {
          transitMs += new Date(r.deliveredAt).getTime() - new Date(r.pickedUpAt).getTime();
          transitSamples += 1;
        }
      }
    }
    const active = byStatus.pending + byStatus.assigned + byStatus.picked_up + byStatus.in_transit;
    return {
      total: rows.length,
      active,
      byStatus,
      onTimeRatePct: scheduledDelivered ? Math.round((onTime / scheduledDelivered) * 100) : null,
      exceptions: byStatus.failed,
      avgTransitHours: transitSamples ? Math.round((transitMs / transitSamples / 3_600_000) * 10) / 10 : null,
    };
  }

  // ---- drivers ---------------------------------------------------------------

  async listDrivers(user: AuthenticatedUser, companyId?: string, includeInactive = false) {
    const where: any = { ...this.companyFilter(user, companyId) };
    if (!includeInactive) where.active = true;
    const rows = await this.prisma.deliveryDriver.findMany({
      where,
      orderBy: [{ active: 'desc' }, { name: 'asc' }],
    });
    const counts = await this.prisma.delivery.groupBy({
      by: ['driverId'],
      where: { driverId: { in: rows.map((r) => r.id) }, status: { in: ['assigned', 'picked_up', 'in_transit'] } },
      _count: { _all: true },
    });
    const openByDriver = new Map(counts.map((c) => [c.driverId as string, c._count._all]));
    return rows.map((r) => ({
      id: r.id,
      companyId: r.companyId,
      employeeId: r.employeeId,
      name: r.name,
      phone: r.phone,
      licenseNumber: r.licenseNumber,
      vehicleReg: r.vehicleReg,
      vehicleType: r.vehicleType,
      active: r.active,
      openDeliveries: openByDriver.get(r.id) ?? 0,
      createdAt: r.createdAt,
    }));
  }

  async createDriver(user: AuthenticatedUser, dto: CreateDeliveryDriverDto) {
    this.assertInScope(user, dto.companyId);
    const driver = await this.prisma.deliveryDriver.create({
      data: {
        companyId: dto.companyId,
        employeeId: dto.employeeId ?? null,
        name: dto.name,
        phone: dto.phone ?? null,
        licenseNumber: dto.licenseNumber ?? null,
        vehicleReg: dto.vehicleReg ?? null,
        vehicleType: dto.vehicleType ?? null,
      },
    });
    await this.audit(user, 'delivery.driver.created', dto.companyId, driver.id, null, { name: driver.name });
    return driver;
  }

  async updateDriver(user: AuthenticatedUser, id: string, dto: UpdateDeliveryDriverDto) {
    const existing = await this.prisma.deliveryDriver.findUnique({ where: { id } });
    if (!existing) throw new NotFoundAppException('Driver not found.');
    this.assertInScope(user, existing.companyId);
    const driver = await this.prisma.deliveryDriver.update({
      where: { id },
      data: {
        name: dto.name ?? existing.name,
        phone: dto.phone ?? existing.phone,
        licenseNumber: dto.licenseNumber ?? existing.licenseNumber,
        vehicleReg: dto.vehicleReg ?? existing.vehicleReg,
        vehicleType: dto.vehicleType ?? existing.vehicleType,
        active: dto.active ?? existing.active,
      },
    });
    await this.audit(user, 'delivery.driver.updated', existing.companyId, id, { active: existing.active }, { active: driver.active });
    return driver;
  }

  // ---- customer-portal read ----------------------------------------------

  // GET /customer-portal/orders/:id/delivery — the customer's tracking view
  // of their own order's delivery. Returns null when no delivery exists yet.
  async getForCustomerOrder(customer: AuthenticatedCustomer, orderId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order || order.customerId !== customer.id) {
      throw new NotFoundAppException('Order not found.');
    }
    const d = await this.prisma.delivery.findUnique({
      where: { orderId },
      include: { driver: true, events: { orderBy: { createdAt: 'asc' } } },
    });
    if (!d) return null;
    return {
      id: d.id,
      deliveryNumber: d.deliveryNumber,
      status: d.status,
      kind: d.kind,
      scheduledDate: d.scheduledDate,
      dropAddress: d.dropAddress,
      instructions: d.instructions,
      assignedAt: d.assignedAt,
      pickedUpAt: d.pickedUpAt,
      inTransitAt: d.inTransitAt,
      deliveredAt: d.deliveredAt,
      failedAt: d.failedAt,
      failureReason: d.failureReason,
      proofType: d.proofType,
      recipientName: d.recipientName,
      driver: d.driver
        ? { name: d.driver.name, phone: d.driver.phone, vehicleReg: d.driver.vehicleReg, vehicleType: d.driver.vehicleType }
        : null,
      // No user attribution or internal notes for the customer view.
      events: d.events.map((e) => ({
        status: e.status,
        note: e.note,
        locationText: e.locationText,
        createdAt: e.createdAt,
      })),
    };
  }

  // ---- internals -------------------------------------------------------------

  private async loadForWrite(user: AuthenticatedUser, id: string) {
    const d = await this.prisma.delivery.findUnique({ where: { id } });
    if (!d) throw new NotFoundAppException('Delivery not found.');
    this.assertInScope(user, d.companyId);
    return d;
  }

  private async decorators(rows: { customerId: string; companyId: string; originCompanyId: string; orderId: string | null }[]) {
    const customerIds = [...new Set(rows.map((r) => r.customerId))];
    const companyIds = [...new Set(rows.flatMap((r) => [r.companyId, r.originCompanyId]))];
    const orderIds = rows.map((r) => r.orderId).filter((x): x is string => !!x);
    const [customers, companies, orders] = await Promise.all([
      this.customerMap(customerIds),
      this.prisma.company.findMany({ where: { id: { in: companyIds } }, select: { id: true, name: true } }),
      this.prisma.order.findMany({
        where: { id: { in: orderIds } },
        select: { id: true, orderNumber: true, status: true, totalAmount: true },
      }),
    ]);
    return [
      customers,
      new Map(companies.map((c) => [c.id, c.name])),
      new Map(orders.map((o) => [o.id, o])),
    ] as const;
  }

  private async customerMap(ids: string[]) {
    const rows = await this.prisma.customer.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, contactPhone: true, accountNumber: true },
    });
    return new Map(rows.map((r) => [r.id, r]));
  }

  private async userNames(ids: string[]) {
    const uniq = [...new Set(ids.filter(Boolean))];
    const rows = await this.prisma.user.findMany({
      where: { id: { in: uniq } },
      select: { id: true, firstName: true, lastName: true },
    });
    return new Map(rows.map((r) => [r.id, `${r.firstName} ${r.lastName}`.trim()]));
  }

  private toResource(
    d: any,
    customers: Map<string, any>,
    companies: Map<string, string>,
    orders: Map<string, any>,
  ) {
    const order = d.orderId ? orders.get(d.orderId) : null;
    return {
      id: d.id,
      deliveryNumber: d.deliveryNumber,
      companyId: d.companyId,
      companyName: companies.get(d.companyId) ?? null,
      originCompanyId: d.originCompanyId,
      originCompanyName: companies.get(d.originCompanyId) ?? null,
      originBranchId: d.originBranchId,
      customerId: d.customerId,
      customerName: customers.get(d.customerId)?.name ?? d.customerId,
      customerPhone: customers.get(d.customerId)?.contactPhone ?? null,
      orderId: d.orderId,
      orderNumber: order?.orderNumber ?? null,
      orderStatus: order?.status ?? null,
      invoiceId: d.invoiceId,
      kind: d.kind,
      status: d.status,
      driverId: d.driverId,
      driverName: d.driver?.name ?? null,
      driverPhone: d.driver?.phone ?? null,
      vehicleReg: d.driver?.vehicleReg ?? null,
      dropAddress: d.dropAddress,
      dropContactName: d.dropContactName,
      dropContactPhone: d.dropContactPhone,
      instructions: d.instructions,
      scheduledDate: d.scheduledDate,
      deliveryFee: (d.deliveryFee ?? 0).toString(),
      assignedAt: d.assignedAt,
      pickedUpAt: d.pickedUpAt,
      inTransitAt: d.inTransitAt,
      deliveredAt: d.deliveredAt,
      failedAt: d.failedAt,
      cancelledAt: d.cancelledAt,
      failureReason: d.failureReason,
      proofType: d.proofType,
      proofReference: d.proofReference,
      recipientName: d.recipientName,
      eventCount: d._count?.events,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    };
  }

  private audit(
    user: AuthenticatedUser,
    eventType: string,
    companyId: string,
    entityId: string | null,
    previousValue: unknown,
    newValue: unknown,
  ) {
    return this.auditService.record({
      eventType,
      sourceService: 'delivery-service',
      userId: user.id,
      companyId,
      entityType: eventType.includes('driver') ? 'delivery_driver' : 'delivery',
      entityId,
      action: eventType.endsWith('created')
        ? 'create'
        : eventType.endsWith('cancelled') || eventType.endsWith('failed')
          ? 'update'
          : 'update',
      previousValue,
      newValue,
    });
  }
}

function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}
