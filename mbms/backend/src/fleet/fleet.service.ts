import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConflictAppException, NotFoundAppException } from '../common/app-exception';
import { AuthenticatedUser } from '../common/strategies/jwt.strategy';
import { hasGroupVisibility, isCompanyInScope } from '../common/scope.util';
import { AuditService } from '../common/audit/audit.service';
import {
  AssignDriverDto,
  CreateAccidentDto,
  CreateRenewalDto,
  CreateServiceRecordDto,
  CreateServiceScheduleDto,
  CreateVehicleDto,
  CreateVehicleExpenseDto,
  EndAssignmentDto,
  LogFuelDto,
  LogLocationDto,
  LogOdometerDto,
  UpdateAccidentDto,
  UpdateServiceScheduleDto,
  UpdateVehicleDto,
} from './dto/fleet.dto';

const GROUP_PERM = 'fleet.viewAll';

function num(d: any) {
  return d == null ? null : Number(d);
}
function money(d: any) {
  return d == null ? null : Number(d).toFixed(2);
}

@Injectable()
export class FleetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  private companyFilter(user: AuthenticatedUser, companyId?: string) {
    if (hasGroupVisibility(user, GROUP_PERM)) return companyId ? { companyId } : {};
    const scoped = user.scopes.map((s) => s.companyId);
    return {
      companyId:
        companyId && scoped.includes(companyId)
          ? companyId
          : { in: scoped.length > 0 ? scoped : ['__none__'] },
    };
  }

  private async vehicleInScope(user: AuthenticatedUser, id: string) {
    const v = await this.prisma.vehicle.findUnique({ where: { id } });
    if (!v || !isCompanyInScope(user, v.companyId, GROUP_PERM)) {
      throw new NotFoundAppException('Vehicle not found.');
    }
    return v;
  }

  private async employeeInCompany(employeeId: string, companyId: string) {
    const e = await this.prisma.employee.findUnique({ where: { id: employeeId } });
    if (!e || e.companyId !== companyId) throw new NotFoundAppException('Employee not found for this company.');
    return e;
  }

  private async bumpOdometer(vehicleId: string, odometer?: number | null) {
    if (odometer == null) return;
    await this.prisma.vehicle.updateMany({
      where: { id: vehicleId, currentOdometer: { lt: odometer } },
      data: { currentOdometer: odometer },
    });
  }

  private async autoExpense(
    vehicleId: string,
    e: {
      expenseDate: Date;
      category: string;
      amount: number;
      odometer?: number | null;
      reference?: string | null;
      sourceType: string;
      sourceId: string;
    },
    userId: string,
  ) {
    if (!e.amount || e.amount <= 0) return;
    await this.prisma.vehicleExpense.create({
      data: {
        vehicleId,
        expenseDate: e.expenseDate,
        category: e.category as any,
        amount: e.amount,
        odometer: e.odometer ?? null,
        reference: e.reference ?? null,
        sourceType: e.sourceType,
        sourceId: e.sourceId,
        createdBy: userId,
      },
    });
  }

  private vehicleResource(v: any) {
    return {
      id: v.id,
      companyId: v.companyId,
      branchId: v.branchId,
      assetId: v.assetId,
      assetNumber: v.asset?.assetNumber ?? null,
      registrationNumber: v.registrationNumber,
      make: v.make,
      model: v.model,
      year: v.year,
      vin: v.vin,
      colour: v.colour,
      fuelType: v.fuelType,
      ownershipType: v.ownershipType,
      ownerName: v.ownerName,
      acquisitionDate: v.acquisitionDate,
      currentOdometer: v.currentOdometer,
      odometerUnit: v.odometerUnit,
      lastLocationText: v.lastLocationText,
      lastLocationAt: v.lastLocationAt,
      status: v.status,
      notes: v.notes,
      createdAt: v.createdAt,
      updatedAt: v.updatedAt,
    };
  }

  // ---- Vehicles -------------------------------------------------

  async listVehicles(
    user: AuthenticatedUser,
    filters: { companyId?: string; status?: string; search?: string },
  ) {
    const where: any = { ...this.companyFilter(user, filters.companyId) };
    if (filters.status) where.status = filters.status;
    if (filters.search) {
      where.OR = [
        { registrationNumber: { contains: filters.search, mode: 'insensitive' } },
        { make: { contains: filters.search, mode: 'insensitive' } },
        { model: { contains: filters.search, mode: 'insensitive' } },
      ];
    }
    const rows = await this.prisma.vehicle.findMany({
      where,
      include: { asset: { select: { assetNumber: true } } },
      orderBy: { registrationNumber: 'asc' },
      take: 1000,
    });

    // attach the active driver name for the list view
    const activeAssignments = await this.prisma.vehicleDriverAssignment.findMany({
      where: { vehicleId: { in: rows.map((r) => r.id) }, status: 'active' },
    });
    const empIds = [...new Set(activeAssignments.map((a) => a.driverEmployeeId))];
    const emps = empIds.length
      ? await this.prisma.employee.findMany({
          where: { id: { in: empIds } },
          select: { id: true, firstName: true, lastName: true },
        })
      : [];
    const empName = new Map(emps.map((e) => [e.id, `${e.firstName} ${e.lastName}`.trim()]));
    const driverByVehicle = new Map(
      activeAssignments.map((a) => [a.vehicleId, empName.get(a.driverEmployeeId) ?? a.driverEmployeeId]),
    );

    return rows.map((v) => ({ ...this.vehicleResource(v), activeDriverName: driverByVehicle.get(v.id) ?? null }));
  }

  async createVehicle(user: AuthenticatedUser, dto: CreateVehicleDto) {
    if (!isCompanyInScope(user, dto.companyId, GROUP_PERM)) {
      throw new NotFoundAppException('Company not found.');
    }
    const reg = dto.registrationNumber.trim().toUpperCase();
    const clash = await this.prisma.vehicle.findUnique({
      where: { companyId_registrationNumber: { companyId: dto.companyId, registrationNumber: reg } },
    });
    if (clash) throw new ConflictAppException(`Vehicle ${reg} is already registered.`);
    if (dto.assetId) {
      const asset = await this.prisma.asset.findUnique({ where: { id: dto.assetId } });
      if (!asset || asset.companyId !== dto.companyId) throw new NotFoundAppException('Asset not found.');
      const taken = await this.prisma.vehicle.findUnique({ where: { assetId: dto.assetId } });
      if (taken) throw new ConflictAppException('That asset already has a vehicle record.');
    }
    const created = await this.prisma.vehicle.create({
      data: {
        companyId: dto.companyId,
        branchId: dto.branchId ?? null,
        assetId: dto.assetId ?? null,
        registrationNumber: reg,
        make: dto.make.trim(),
        model: dto.model.trim(),
        year: dto.year ?? null,
        vin: dto.vin?.trim() || null,
        colour: dto.colour?.trim() || null,
        fuelType: (dto.fuelType as any) ?? 'diesel',
        ownershipType: (dto.ownershipType as any) ?? 'owned',
        ownerName: dto.ownerName?.trim() || null,
        acquisitionDate: dto.acquisitionDate ? new Date(dto.acquisitionDate) : null,
        currentOdometer: dto.currentOdometer ?? 0,
        notes: dto.notes ?? null,
        createdBy: user.id,
      },
      include: { asset: { select: { assetNumber: true } } },
    });
    await this.auditService.record({
      eventType: 'fleet.vehicle.registered',
      sourceService: 'fleet-service',
      userId: user.id,
      companyId: dto.companyId,
      entityType: 'vehicle',
      entityId: created.id,
      action: 'create',
      newValue: { registrationNumber: reg, make: created.make, model: created.model },
    });
    return this.vehicleResource(created);
  }

  async getVehicle(user: AuthenticatedUser, id: string) {
    const v = await this.prisma.vehicle.findUnique({
      where: { id },
      include: { asset: { select: { assetNumber: true } } },
    });
    if (!v || !isCompanyInScope(user, v.companyId, GROUP_PERM)) throw new NotFoundAppException('Vehicle not found.');
    return this.vehicleResource(v);
  }

  async updateVehicle(user: AuthenticatedUser, id: string, dto: UpdateVehicleDto) {
    const v = await this.vehicleInScope(user, id);
    const data: any = {};
    for (const k of ['make', 'model', 'vin', 'colour', 'fuelType', 'ownershipType', 'ownerName', 'status', 'notes'] as const) {
      if (dto[k] !== undefined) data[k] = dto[k];
    }
    if (dto.year !== undefined) data.year = dto.year;
    if (dto.acquisitionDate) data.acquisitionDate = new Date(dto.acquisitionDate);
    if ('branchId' in dto) data.branchId = dto.branchId ?? null;
    if ('assetId' in dto) {
      if (dto.assetId) {
        const asset = await this.prisma.asset.findUnique({ where: { id: dto.assetId } });
        if (!asset || asset.companyId !== v.companyId) throw new NotFoundAppException('Asset not found.');
        const taken = await this.prisma.vehicle.findUnique({ where: { assetId: dto.assetId } });
        if (taken && taken.id !== id) throw new ConflictAppException('That asset already has a vehicle record.');
      }
      data.assetId = dto.assetId ?? null;
    }
    const updated = await this.prisma.vehicle.update({
      where: { id },
      data,
      include: { asset: { select: { assetNumber: true } } },
    });
    await this.auditService.record({
      eventType: 'fleet.vehicle.updated',
      sourceService: 'fleet-service',
      userId: user.id,
      companyId: v.companyId,
      entityType: 'vehicle',
      entityId: id,
      action: 'update',
      newValue: { fields: Object.keys(data) },
    });
    return this.vehicleResource(updated);
  }

  async logLocation(user: AuthenticatedUser, id: string, dto: LogLocationDto) {
    const v = await this.vehicleInScope(user, id);
    const updated = await this.prisma.vehicle.update({
      where: { id },
      data: { lastLocationText: dto.location.trim(), lastLocationAt: new Date() },
      include: { asset: { select: { assetNumber: true } } },
    });
    return this.vehicleResource(updated);
  }

  // ---- Driver assignments -------------------------------------

  async listAssignments(user: AuthenticatedUser, vehicleId: string) {
    await this.vehicleInScope(user, vehicleId);
    const rows = await this.prisma.vehicleDriverAssignment.findMany({
      where: { vehicleId },
      orderBy: { startDate: 'desc' },
    });
    const empIds = [...new Set(rows.map((r) => r.driverEmployeeId))];
    const emps = empIds.length
      ? await this.prisma.employee.findMany({ where: { id: { in: empIds } }, select: { id: true, firstName: true, lastName: true } })
      : [];
    const name = new Map(emps.map((e) => [e.id, `${e.firstName} ${e.lastName}`.trim()]));
    return rows.map((a) => ({ ...a, driverName: name.get(a.driverEmployeeId) ?? null }));
  }

  async assignDriver(user: AuthenticatedUser, vehicleId: string, dto: AssignDriverDto) {
    const v = await this.vehicleInScope(user, vehicleId);
    await this.employeeInCompany(dto.driverEmployeeId, v.companyId);
    return this.prisma.$transaction(async (tx) => {
      await tx.vehicleDriverAssignment.updateMany({
        where: { vehicleId, status: 'active' },
        data: { status: 'ended', endDate: new Date(dto.startDate) },
      });
      const created = await tx.vehicleDriverAssignment.create({
        data: {
          vehicleId,
          driverEmployeeId: dto.driverEmployeeId,
          startDate: new Date(dto.startDate),
          note: dto.note ?? null,
          createdBy: user.id,
        },
      });
      await this.auditService.record({
        eventType: 'fleet.driver.assigned',
        sourceService: 'fleet-service',
        userId: user.id,
        companyId: v.companyId,
        entityType: 'vehicle',
        entityId: vehicleId,
        action: 'update',
        newValue: { driverEmployeeId: dto.driverEmployeeId, startDate: dto.startDate },
      });
      return created;
    });
  }

  async endAssignment(user: AuthenticatedUser, assignmentId: string, dto: EndAssignmentDto) {
    const a = await this.prisma.vehicleDriverAssignment.findUnique({ where: { id: assignmentId } });
    if (!a) throw new NotFoundAppException('Assignment not found.');
    await this.vehicleInScope(user, a.vehicleId);
    if (a.status === 'ended') throw new ConflictAppException('That assignment has already ended.');
    const updated = await this.prisma.vehicleDriverAssignment.update({
      where: { id: assignmentId },
      data: { status: 'ended', endDate: dto.endDate ? new Date(dto.endDate) : new Date() },
    });
    return updated;
  }

  // ---- Odometer & fuel --------------------------------------

  async listOdometer(user: AuthenticatedUser, vehicleId: string) {
    await this.vehicleInScope(user, vehicleId);
    return this.prisma.vehicleOdometerReading.findMany({
      where: { vehicleId },
      orderBy: { readingDate: 'desc' },
      take: 500,
    });
  }

  async logOdometer(user: AuthenticatedUser, vehicleId: string, dto: LogOdometerDto) {
    const v = await this.vehicleInScope(user, vehicleId);
    const row = await this.prisma.vehicleOdometerReading.create({
      data: {
        vehicleId,
        readingDate: new Date(dto.readingDate),
        odometer: dto.odometer,
        source: 'manual',
        note: dto.note ?? null,
        createdBy: user.id,
      },
    });
    await this.bumpOdometer(vehicleId, dto.odometer);
    await this.auditService.record({
      eventType: 'fleet.odometer.logged',
      sourceService: 'fleet-service',
      userId: user.id,
      companyId: v.companyId,
      entityType: 'vehicle',
      entityId: vehicleId,
      action: 'update',
      newValue: { odometer: dto.odometer },
    });
    return row;
  }

  async listFuel(user: AuthenticatedUser, vehicleId: string) {
    await this.vehicleInScope(user, vehicleId);
    const rows = await this.prisma.fuelLog.findMany({
      where: { vehicleId },
      orderBy: { logDate: 'desc' },
      take: 500,
    });
    return rows.map((r) => ({ ...r, litres: num(r.litres), cost: money(r.cost) }));
  }

  async logFuel(user: AuthenticatedUser, vehicleId: string, dto: LogFuelDto) {
    const v = await this.vehicleInScope(user, vehicleId);
    const row = await this.prisma.fuelLog.create({
      data: {
        vehicleId,
        logDate: new Date(dto.logDate),
        litres: dto.litres,
        cost: dto.cost,
        odometer: dto.odometer ?? null,
        fuelStation: dto.fuelStation?.trim() || null,
        filledToFull: dto.filledToFull ?? true,
        createdBy: user.id,
      },
    });
    if (dto.odometer != null) {
      await this.prisma.vehicleOdometerReading.create({
        data: { vehicleId, readingDate: new Date(dto.logDate), odometer: dto.odometer, source: 'fuel', createdBy: user.id },
      });
      await this.bumpOdometer(vehicleId, dto.odometer);
    }
    await this.autoExpense(
      vehicleId,
      {
        expenseDate: new Date(dto.logDate),
        category: 'fuel',
        amount: dto.cost,
        odometer: dto.odometer ?? null,
        reference: dto.fuelStation ?? null,
        sourceType: 'fuel_log',
        sourceId: row.id,
      },
      user.id,
    );
    await this.auditService.record({
      eventType: 'fleet.fuel.logged',
      sourceService: 'fleet-service',
      userId: user.id,
      companyId: v.companyId,
      entityType: 'vehicle',
      entityId: vehicleId,
      action: 'create',
      newValue: { litres: dto.litres, cost: dto.cost },
    });
    return { ...row, litres: num(row.litres), cost: money(row.cost) };
  }

  // ---- Service schedules & records ------------------------

  private computeNextDue(s: {
    intervalKm: number | null;
    intervalDays: number | null;
    lastServiceOdometer: number | null;
    lastServiceDate: Date | null;
  }) {
    const nextDueOdometer =
      s.intervalKm != null && s.lastServiceOdometer != null ? s.lastServiceOdometer + s.intervalKm : null;
    let nextDueDate: Date | null = null;
    if (s.intervalDays != null && s.lastServiceDate) {
      nextDueDate = new Date(s.lastServiceDate);
      nextDueDate.setDate(nextDueDate.getDate() + s.intervalDays);
    }
    return { nextDueOdometer, nextDueDate };
  }

  async listSchedules(user: AuthenticatedUser, vehicleId: string) {
    const v = await this.vehicleInScope(user, vehicleId);
    const rows = await this.prisma.serviceSchedule.findMany({
      where: { vehicleId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((s) => this.scheduleResource(s, v.currentOdometer));
  }

  private scheduleResource(s: any, currentOdometer: number) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const byKm = s.nextDueOdometer != null ? currentOdometer >= s.nextDueOdometer : false;
    const byDate = s.nextDueDate != null ? new Date(s.nextDueDate) <= today : false;
    const dueState = !s.isActive ? 'inactive' : byKm || byDate ? 'due' : 'ok';
    return {
      id: s.id,
      vehicleId: s.vehicleId,
      name: s.name,
      intervalKm: s.intervalKm,
      intervalDays: s.intervalDays,
      lastServiceOdometer: s.lastServiceOdometer,
      lastServiceDate: s.lastServiceDate,
      nextDueOdometer: s.nextDueOdometer,
      nextDueDate: s.nextDueDate,
      isActive: s.isActive,
      note: s.note,
      dueState,
    };
  }

  async createSchedule(user: AuthenticatedUser, vehicleId: string, dto: CreateServiceScheduleDto) {
    const v = await this.vehicleInScope(user, vehicleId);
    if (!dto.intervalKm && !dto.intervalDays) {
      throw new ConflictAppException('A schedule needs an interval in km or days (or both).');
    }
    const lastOdo = dto.lastServiceOdometer ?? v.currentOdometer;
    const lastDate = dto.lastServiceDate ? new Date(dto.lastServiceDate) : new Date();
    const { nextDueOdometer, nextDueDate } = this.computeNextDue({
      intervalKm: dto.intervalKm ?? null,
      intervalDays: dto.intervalDays ?? null,
      lastServiceOdometer: lastOdo,
      lastServiceDate: lastDate,
    });
    const created = await this.prisma.serviceSchedule.create({
      data: {
        vehicleId,
        name: dto.name.trim(),
        intervalKm: dto.intervalKm ?? null,
        intervalDays: dto.intervalDays ?? null,
        lastServiceOdometer: lastOdo,
        lastServiceDate: lastDate,
        nextDueOdometer,
        nextDueDate,
        note: dto.note ?? null,
        createdBy: user.id,
      },
    });
    return this.scheduleResource(created, v.currentOdometer);
  }

  async updateSchedule(user: AuthenticatedUser, scheduleId: string, dto: UpdateServiceScheduleDto) {
    const s = await this.prisma.serviceSchedule.findUnique({ where: { id: scheduleId } });
    if (!s) throw new NotFoundAppException('Schedule not found.');
    const v = await this.vehicleInScope(user, s.vehicleId);
    const merged = {
      intervalKm: 'intervalKm' in dto ? dto.intervalKm ?? null : s.intervalKm,
      intervalDays: 'intervalDays' in dto ? dto.intervalDays ?? null : s.intervalDays,
      lastServiceOdometer: s.lastServiceOdometer,
      lastServiceDate: s.lastServiceDate,
    };
    const { nextDueOdometer, nextDueDate } = this.computeNextDue(merged);
    const updated = await this.prisma.serviceSchedule.update({
      where: { id: scheduleId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...('intervalKm' in dto ? { intervalKm: dto.intervalKm ?? null } : {}),
        ...('intervalDays' in dto ? { intervalDays: dto.intervalDays ?? null } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.note !== undefined ? { note: dto.note } : {}),
        nextDueOdometer,
        nextDueDate,
      },
    });
    return this.scheduleResource(updated, v.currentOdometer);
  }

  async listServiceRecords(user: AuthenticatedUser, vehicleId: string) {
    await this.vehicleInScope(user, vehicleId);
    const rows = await this.prisma.serviceRecord.findMany({
      where: { vehicleId },
      orderBy: { serviceDate: 'desc' },
      take: 500,
    });
    return rows.map((r) => ({ ...r, cost: money(r.cost) }));
  }

  async addServiceRecord(user: AuthenticatedUser, vehicleId: string, dto: CreateServiceRecordDto) {
    const v = await this.vehicleInScope(user, vehicleId);
    if (dto.scheduleId) {
      const s = await this.prisma.serviceSchedule.findFirst({ where: { id: dto.scheduleId, vehicleId } });
      if (!s) throw new NotFoundAppException('Service schedule not found for this vehicle.');
    }
    const kind = (dto.kind as any) ?? 'service';
    const record = await this.prisma.serviceRecord.create({
      data: {
        vehicleId,
        scheduleId: dto.scheduleId ?? null,
        serviceDate: new Date(dto.serviceDate),
        odometer: dto.odometer ?? null,
        kind,
        description: dto.description.trim(),
        cost: dto.cost ?? null,
        provider: dto.provider?.trim() || null,
        createdBy: user.id,
      },
    });
    if (dto.odometer != null) {
      await this.prisma.vehicleOdometerReading.create({
        data: { vehicleId, readingDate: new Date(dto.serviceDate), odometer: dto.odometer, source: 'service', createdBy: user.id },
      });
      await this.bumpOdometer(vehicleId, dto.odometer);
    }
    // A completed scheduled service advances the schedule's next-due.
    if (dto.scheduleId && kind === 'service') {
      const s = await this.prisma.serviceSchedule.findUnique({ where: { id: dto.scheduleId } });
      if (s) {
        const lastOdo = dto.odometer ?? s.lastServiceOdometer ?? v.currentOdometer;
        const lastDate = new Date(dto.serviceDate);
        const { nextDueOdometer, nextDueDate } = this.computeNextDue({
          intervalKm: s.intervalKm,
          intervalDays: s.intervalDays,
          lastServiceOdometer: lastOdo,
          lastServiceDate: lastDate,
        });
        await this.prisma.serviceSchedule.update({
          where: { id: s.id },
          data: { lastServiceOdometer: lastOdo, lastServiceDate: lastDate, nextDueOdometer, nextDueDate },
        });
      }
    }
    await this.autoExpense(
      vehicleId,
      {
        expenseDate: new Date(dto.serviceDate),
        category: kind === 'repair' ? 'repair' : 'service',
        amount: dto.cost ?? 0,
        odometer: dto.odometer ?? null,
        reference: dto.provider ?? null,
        sourceType: 'service_record',
        sourceId: record.id,
      },
      user.id,
    );
    await this.auditService.record({
      eventType: kind === 'repair' ? 'fleet.repair.recorded' : 'fleet.service.recorded',
      sourceService: 'fleet-service',
      userId: user.id,
      companyId: v.companyId,
      entityType: 'vehicle',
      entityId: vehicleId,
      action: 'create',
      newValue: { kind, cost: dto.cost ?? null },
    });
    return { ...record, cost: money(record.cost) };
  }

  // ---- Renewals -------------------------------------------

  async listRenewals(user: AuthenticatedUser, vehicleId: string) {
    await this.vehicleInScope(user, vehicleId);
    const rows = await this.prisma.vehicleRenewal.findMany({
      where: { vehicleId },
      orderBy: { expiryDate: 'desc' },
      take: 500,
    });
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return rows.map((r) => ({ ...r, cost: money(r.cost), expired: new Date(r.expiryDate) < today }));
  }

  async addRenewal(user: AuthenticatedUser, vehicleId: string, dto: CreateRenewalDto) {
    const v = await this.vehicleInScope(user, vehicleId);
    const row = await this.prisma.vehicleRenewal.create({
      data: {
        vehicleId,
        renewalType: dto.renewalType as any,
        reference: dto.reference?.trim() || null,
        issueDate: dto.issueDate ? new Date(dto.issueDate) : null,
        expiryDate: new Date(dto.expiryDate),
        cost: dto.cost ?? null,
        provider: dto.provider?.trim() || null,
        note: dto.note ?? null,
        createdBy: user.id,
      },
    });
    await this.autoExpense(
      vehicleId,
      {
        expenseDate: dto.issueDate ? new Date(dto.issueDate) : new Date(),
        category: dto.renewalType === 'insurance' ? 'insurance' : 'licence',
        amount: dto.cost ?? 0,
        reference: dto.reference ?? null,
        sourceType: 'renewal',
        sourceId: row.id,
      },
      user.id,
    );
    await this.auditService.record({
      eventType: 'fleet.renewal.recorded',
      sourceService: 'fleet-service',
      userId: user.id,
      companyId: v.companyId,
      entityType: 'vehicle',
      entityId: vehicleId,
      action: 'create',
      newValue: { renewalType: dto.renewalType, expiryDate: dto.expiryDate },
    });
    return { ...row, cost: money(row.cost) };
  }

  // ---- Accidents ----------------------------------------

  async listAccidents(user: AuthenticatedUser, vehicleId: string) {
    await this.vehicleInScope(user, vehicleId);
    const rows = await this.prisma.accidentRecord.findMany({
      where: { vehicleId },
      orderBy: { accidentDate: 'desc' },
      take: 500,
    });
    return rows.map((r) => ({ ...r, estimatedCost: money(r.estimatedCost) }));
  }

  async addAccident(user: AuthenticatedUser, vehicleId: string, dto: CreateAccidentDto) {
    const v = await this.vehicleInScope(user, vehicleId);
    if (dto.driverEmployeeId) await this.employeeInCompany(dto.driverEmployeeId, v.companyId);
    const row = await this.prisma.accidentRecord.create({
      data: {
        vehicleId,
        accidentDate: new Date(dto.accidentDate),
        location: dto.location ?? null,
        severity: dto.severity as any,
        description: dto.description.trim(),
        driverEmployeeId: dto.driverEmployeeId ?? null,
        thirdPartyInvolved: dto.thirdPartyInvolved ?? false,
        estimatedCost: dto.estimatedCost ?? null,
        insuranceClaimReference: dto.insuranceClaimReference?.trim() || null,
        policeReportReference: dto.policeReportReference?.trim() || null,
        createdBy: user.id,
      },
    });
    await this.auditService.record({
      eventType: 'fleet.accident.recorded',
      sourceService: 'fleet-service',
      userId: user.id,
      companyId: v.companyId,
      entityType: 'vehicle',
      entityId: vehicleId,
      action: 'create',
      newValue: { severity: dto.severity, accidentDate: dto.accidentDate },
    });
    return { ...row, estimatedCost: money(row.estimatedCost) };
  }

  async updateAccident(user: AuthenticatedUser, accidentId: string, dto: UpdateAccidentDto) {
    const a = await this.prisma.accidentRecord.findUnique({ where: { id: accidentId } });
    if (!a) throw new NotFoundAppException('Accident record not found.');
    const v = await this.vehicleInScope(user, a.vehicleId);
    const data: any = {};
    if (dto.resolved !== undefined) data.resolved = dto.resolved;
    if (dto.estimatedCost !== undefined) data.estimatedCost = dto.estimatedCost;
    if (dto.insuranceClaimReference !== undefined) data.insuranceClaimReference = dto.insuranceClaimReference;
    if (dto.policeReportReference !== undefined) data.policeReportReference = dto.policeReportReference;
    const updated = await this.prisma.accidentRecord.update({ where: { id: accidentId }, data });
    await this.auditService.record({
      eventType: 'fleet.accident.updated',
      sourceService: 'fleet-service',
      userId: user.id,
      companyId: v.companyId,
      entityType: 'vehicle',
      entityId: a.vehicleId,
      action: 'update',
      newValue: { resolved: updated.resolved },
    });
    return { ...updated, estimatedCost: money(updated.estimatedCost) };
  }

  // ---- Vehicle expenses --------------------------------

  async listExpenses(user: AuthenticatedUser, vehicleId: string) {
    await this.vehicleInScope(user, vehicleId);
    const rows = await this.prisma.vehicleExpense.findMany({
      where: { vehicleId },
      orderBy: { expenseDate: 'desc' },
      take: 1000,
    });
    return rows.map((r) => ({ ...r, amount: money(r.amount) }));
  }

  async addExpense(user: AuthenticatedUser, vehicleId: string, dto: CreateVehicleExpenseDto) {
    const v = await this.vehicleInScope(user, vehicleId);
    const row = await this.prisma.vehicleExpense.create({
      data: {
        vehicleId,
        expenseDate: new Date(dto.expenseDate),
        category: dto.category as any,
        amount: dto.amount,
        odometer: dto.odometer ?? null,
        reference: dto.reference?.trim() || null,
        note: dto.note ?? null,
        sourceType: 'manual',
        createdBy: user.id,
      },
    });
    await this.auditService.record({
      eventType: 'fleet.expense.recorded',
      sourceService: 'fleet-service',
      userId: user.id,
      companyId: v.companyId,
      entityType: 'vehicle',
      entityId: vehicleId,
      action: 'create',
      newValue: { category: dto.category, amount: dto.amount },
    });
    return { ...row, amount: money(row.amount) };
  }

  // ---- Per-vehicle summary ----------------------------

  async summary(user: AuthenticatedUser, vehicleId: string) {
    const v = await this.vehicleInScope(user, vehicleId);
    const [assignment, schedules, renewals, expenses, fuel] = await Promise.all([
      this.prisma.vehicleDriverAssignment.findFirst({ where: { vehicleId, status: 'active' } }),
      this.prisma.serviceSchedule.findMany({ where: { vehicleId, isActive: true } }),
      this.prisma.vehicleRenewal.findMany({ where: { vehicleId }, orderBy: { expiryDate: 'asc' } }),
      this.prisma.vehicleExpense.findMany({ where: { vehicleId } }),
      this.prisma.fuelLog.findMany({ where: { vehicleId }, orderBy: { logDate: 'asc' } }),
    ]);

    let driverName: string | null = null;
    if (assignment) {
      const e = await this.prisma.employee.findUnique({ where: { id: assignment.driverEmployeeId } });
      driverName = e ? `${e.firstName} ${e.lastName}`.trim() : assignment.driverEmployeeId;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueSchedules = schedules
      .map((s) => this.scheduleResource(s, v.currentOdometer))
      .filter((s) => s.dueState === 'due');
    const nextRenewal = renewals.find((r) => new Date(r.expiryDate) >= today) ?? renewals[renewals.length - 1] ?? null;

    const yearStart = new Date(today.getFullYear(), 0, 1);
    const byCategory: Record<string, number> = {};
    let ytdTotal = 0;
    for (const e of expenses) {
      if (new Date(e.expenseDate) >= yearStart) {
        const amt = Number(e.amount);
        byCategory[e.category] = (byCategory[e.category] ?? 0) + amt;
        ytdTotal += amt;
      }
    }

    return {
      vehicleId: v.id,
      registrationNumber: v.registrationNumber,
      status: v.status,
      currentOdometer: v.currentOdometer,
      odometerUnit: v.odometerUnit,
      lastLocationText: v.lastLocationText,
      lastLocationAt: v.lastLocationAt,
      activeDriver: assignment ? { assignmentId: assignment.id, driverEmployeeId: assignment.driverEmployeeId, driverName, since: assignment.startDate } : null,
      servicesDue: dueSchedules.map((s) => ({ id: s.id, name: s.name, nextDueOdometer: s.nextDueOdometer, nextDueDate: s.nextDueDate })),
      nextRenewal: nextRenewal
        ? { renewalType: nextRenewal.renewalType, expiryDate: nextRenewal.expiryDate, expired: new Date(nextRenewal.expiryDate) < today }
        : null,
      ytdExpense: { total: ytdTotal.toFixed(2), byCategory: Object.fromEntries(Object.entries(byCategory).map(([k, v2]) => [k, v2.toFixed(2)])) },
      fuelEconomy: this.fuelEconomy(fuel),
    };
  }

  // Distance between consecutive full-to-full fills, over the litres of the
  // later fill. km/L, L/100km and cost/km across the vehicle's history.
  private fuelEconomy(fuelAsc: any[]) {
    const withOdo = fuelAsc
      .filter((f) => f.odometer != null && f.filledToFull)
      .sort((a, b) => a.odometer - b.odometer);
    let distance = 0;
    let litres = 0;
    let cost = 0;
    for (let i = 1; i < withOdo.length; i++) {
      const d = withOdo[i].odometer - withOdo[i - 1].odometer;
      if (d <= 0) continue;
      distance += d;
      litres += Number(withOdo[i].litres);
      cost += Number(withOdo[i].cost);
    }
    if (distance <= 0 || litres <= 0) {
      return { segments: Math.max(0, withOdo.length - 1), kmPerLitre: null, litresPer100Km: null, costPerKm: null, distance: 0 };
    }
    return {
      segments: withOdo.length - 1,
      distance,
      kmPerLitre: Number((distance / litres).toFixed(2)),
      litresPer100Km: Number(((litres / distance) * 100).toFixed(2)),
      costPerKm: Number((cost / distance).toFixed(2)),
    };
  }

  // ---- Reports ---------------------------------------

  private async vehiclesInScope(user: AuthenticatedUser, companyId?: string) {
    return this.prisma.vehicle.findMany({
      where: { ...this.companyFilter(user, companyId) } as any,
      orderBy: { registrationNumber: 'asc' },
      take: 2000,
    });
  }

  async reportFleetRegister(user: AuthenticatedUser, companyId?: string) {
    const vehicles = await this.vehiclesInScope(user, companyId);
    return vehicles.map((v) => ({
      vehicleId: v.id,
      registrationNumber: v.registrationNumber,
      make: v.make,
      model: v.model,
      year: v.year,
      fuelType: v.fuelType,
      ownershipType: v.ownershipType,
      currentOdometer: v.currentOdometer,
      status: v.status,
      branchId: v.branchId,
      assetId: v.assetId,
    }));
  }

  async reportFuelConsumption(
    user: AuthenticatedUser,
    opts: { companyId?: string; from?: string; to?: string },
  ) {
    const vehicles = await this.vehiclesInScope(user, opts.companyId);
    const ids = vehicles.map((v) => v.id);
    const where: any = { vehicleId: { in: ids } };
    if (opts.from || opts.to) {
      where.logDate = {};
      if (opts.from) where.logDate.gte = new Date(opts.from);
      if (opts.to) where.logDate.lte = new Date(`${opts.to}T23:59:59.999Z`);
    }
    const fuel = ids.length ? await this.prisma.fuelLog.findMany({ where, orderBy: { logDate: 'asc' } }) : [];
    const byVehicle = new Map<string, any[]>();
    for (const f of fuel) {
      const arr = byVehicle.get(f.vehicleId) ?? [];
      arr.push(f);
      byVehicle.set(f.vehicleId, arr);
    }
    const lines = vehicles.map((v) => {
      const rows = byVehicle.get(v.id) ?? [];
      const litres = rows.reduce((s, r) => s + Number(r.litres), 0);
      const cost = rows.reduce((s, r) => s + Number(r.cost), 0);
      const econ = this.fuelEconomy(rows);
      return {
        vehicleId: v.id,
        registrationNumber: v.registrationNumber,
        fills: rows.length,
        litres: litres.toFixed(2),
        cost: cost.toFixed(2),
        distance: econ.distance,
        litresPer100Km: econ.litresPer100Km,
        kmPerLitre: econ.kmPerLitre,
        costPerKm: econ.costPerKm,
      };
    });
    return {
      from: opts.from ?? null,
      to: opts.to ?? null,
      lines: lines.filter((l) => l.fills > 0),
      totals: {
        litres: lines.reduce((s, l) => s + Number(l.litres), 0).toFixed(2),
        cost: lines.reduce((s, l) => s + Number(l.cost), 0).toFixed(2),
      },
    };
  }

  async reportExpenses(
    user: AuthenticatedUser,
    opts: { companyId?: string; from?: string; to?: string },
  ) {
    const vehicles = await this.vehiclesInScope(user, opts.companyId);
    const ids = vehicles.map((v) => v.id);
    const where: any = { vehicleId: { in: ids } };
    if (opts.from || opts.to) {
      where.expenseDate = {};
      if (opts.from) where.expenseDate.gte = new Date(opts.from);
      if (opts.to) where.expenseDate.lte = new Date(`${opts.to}T23:59:59.999Z`);
    }
    const expenses = ids.length ? await this.prisma.vehicleExpense.findMany({ where }) : [];
    const perVehicle = new Map<string, { total: number; byCategory: Record<string, number> }>();
    const overallByCategory: Record<string, number> = {};
    let overall = 0;
    for (const e of expenses) {
      const amt = Number(e.amount);
      const p = perVehicle.get(e.vehicleId) ?? { total: 0, byCategory: {} };
      p.total += amt;
      p.byCategory[e.category] = (p.byCategory[e.category] ?? 0) + amt;
      perVehicle.set(e.vehicleId, p);
      overallByCategory[e.category] = (overallByCategory[e.category] ?? 0) + amt;
      overall += amt;
    }
    return {
      from: opts.from ?? null,
      to: opts.to ?? null,
      lines: vehicles
        .map((v) => {
          const p = perVehicle.get(v.id);
          return {
            vehicleId: v.id,
            registrationNumber: v.registrationNumber,
            total: (p?.total ?? 0).toFixed(2),
            byCategory: Object.fromEntries(Object.entries(p?.byCategory ?? {}).map(([k, val]) => [k, val.toFixed(2)])),
            costPerKm: v.currentOdometer > 0 ? Number(((p?.total ?? 0) / v.currentOdometer).toFixed(2)) : null,
          };
        })
        .filter((l) => Number(l.total) > 0),
      totals: {
        total: overall.toFixed(2),
        byCategory: Object.fromEntries(Object.entries(overallByCategory).map(([k, val]) => [k, val.toFixed(2)])),
      },
    };
  }

  async reportRenewalsDue(user: AuthenticatedUser, companyId?: string, days = 30) {
    const window = Math.min(Math.max(days, 0), 3650);
    const cutoff = new Date();
    cutoff.setHours(23, 59, 59, 999);
    cutoff.setDate(cutoff.getDate() + window);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const vehicles = await this.vehiclesInScope(user, companyId);
    const byId = new Map(vehicles.map((v) => [v.id, v]));
    const renewals = vehicles.length
      ? await this.prisma.vehicleRenewal.findMany({
          where: { vehicleId: { in: vehicles.map((v) => v.id) }, expiryDate: { lte: cutoff } },
          orderBy: { expiryDate: 'asc' },
        })
      : [];
    return {
      windowDays: window,
      cutoff,
      renewals: renewals.map((r) => ({
        id: r.id,
        vehicleId: r.vehicleId,
        registrationNumber: byId.get(r.vehicleId)?.registrationNumber ?? null,
        renewalType: r.renewalType,
        reference: r.reference,
        expiryDate: r.expiryDate,
        expired: new Date(r.expiryDate) < today,
      })),
    };
  }

  async reportServiceDue(user: AuthenticatedUser, companyId?: string) {
    const vehicles = await this.vehiclesInScope(user, companyId);
    const byId = new Map(vehicles.map((v) => [v.id, v]));
    const schedules = vehicles.length
      ? await this.prisma.serviceSchedule.findMany({
          where: { vehicleId: { in: vehicles.map((v) => v.id) }, isActive: true },
        })
      : [];
    const due = schedules
      .map((s) => {
        const v = byId.get(s.vehicleId)!;
        const r = this.scheduleResource(s, v.currentOdometer);
        return { ...r, registrationNumber: v.registrationNumber, currentOdometer: v.currentOdometer };
      })
      .filter((r) => r.dueState === 'due');
    return { due };
  }
}
