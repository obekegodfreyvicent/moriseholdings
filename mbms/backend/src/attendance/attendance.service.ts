import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConflictAppException, ForbiddenAppException, NotFoundAppException } from '../common/app-exception';
import { AuthenticatedUser } from '../common/strategies/jwt.strategy';
import { hasGroupVisibility, isCompanyInScope } from '../common/scope.util';
import { AuditService } from '../common/audit/audit.service';
import { AssignShiftDto, ClockDto, CreateShiftDto, MarkAbsentDto } from './dto/attendance.dto';

const GROUP_PERM = 'attendance.viewAll';
const MANAGE_PERM = 'attendance.manage';

function todayDateOnly(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

// "HH:MM" + a reference Date -> a Date at that time on the same calendar
// day. This proof-of-concept has no per-employee timezone modeling
// anywhere else either (JournalEntry.entryDate, Expense.expenseDate, etc.
// are all plain dates) — server-local time is used throughout, the same
// simplification.
function timeOnDate(hhmm: string, reference: Date): Date {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date(reference);
  d.setHours(h, m, 0, 0);
  return d;
}

@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  // ---------------------------------------------------------------- Shifts

  async listShifts(user: AuthenticatedUser, companyId?: string) {
    const where: any = {};
    if (hasGroupVisibility(user, GROUP_PERM)) {
      if (companyId) where.companyId = companyId;
    } else {
      const scoped = user.scopes.map((s) => s.companyId);
      where.companyId = companyId && scoped.includes(companyId) ? companyId : { in: scoped.length > 0 ? scoped : ['__none__'] };
    }
    return this.prisma.shift.findMany({ where, orderBy: { name: 'asc' } });
  }

  async createShift(user: AuthenticatedUser, dto: CreateShiftDto) {
    if (!isCompanyInScope(user, dto.companyId, GROUP_PERM)) {
      throw new NotFoundAppException('Company not found.');
    }
    const shift = await this.prisma.shift.create({ data: dto });
    await this.record(user.id, 'attendance.shift.created', dto.companyId, 'shift', shift.id, { name: shift.name });
    return shift;
  }

  async assignShift(user: AuthenticatedUser, employeeId: string, dto: AssignShiftDto) {
    const employee = await this.prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee || !isCompanyInScope(user, employee.companyId, GROUP_PERM)) {
      throw new NotFoundAppException('Employee not found.');
    }
    if (dto.shiftId) {
      const shift = await this.prisma.shift.findUnique({ where: { id: dto.shiftId } });
      if (!shift || shift.companyId !== employee.companyId) {
        throw new NotFoundAppException('Shift not found for this company.');
      }
    }
    const updated = await this.prisma.employee.update({ where: { id: employeeId }, data: { shiftId: dto.shiftId ?? null } });
    await this.record(user.id, 'attendance.shift.assigned', employee.companyId, 'employee', employeeId, { shiftId: dto.shiftId ?? null });
    return { employeeId: updated.id, shiftId: updated.shiftId };
  }

  // ---------------------------------------------------------------- Clock in/out

  async clockIn(user: AuthenticatedUser, dto: ClockDto) {
    const employee = await this.resolveEmployee(user, dto.employeeId);
    const date = todayDateOnly();
    const existing = await this.prisma.attendanceRecord.findUnique({ where: { employeeId_date: { employeeId: employee.id, date } } });
    if (existing?.clockInTime) {
      throw new ConflictAppException('Already clocked in today.');
    }

    const now = new Date();
    let status: 'present' | 'late' = 'present';
    let lateMinutes = 0;
    if (employee.shiftId) {
      const shift = await this.prisma.shift.findUnique({ where: { id: employee.shiftId } });
      if (shift) {
        const startWithGrace = new Date(timeOnDate(shift.startTime, now).getTime() + shift.graceMinutes * 60_000);
        if (now > startWithGrace) {
          status = 'late';
          lateMinutes = Math.round((now.getTime() - timeOnDate(shift.startTime, now).getTime()) / 60_000);
        }
      }
    }

    const record = await this.prisma.attendanceRecord.upsert({
      where: { employeeId_date: { employeeId: employee.id, date } },
      update: { clockInTime: now, status, lateMinutes, recordedBy: user.id },
      create: { employeeId: employee.id, companyId: employee.companyId, date, clockInTime: now, status, lateMinutes, recordedBy: user.id },
    });
    await this.record(user.id, 'attendance.clocked_in', employee.companyId, 'attendance_record', record.id, { status });
    return record;
  }

  async clockOut(user: AuthenticatedUser, dto: ClockDto) {
    const employee = await this.resolveEmployee(user, dto.employeeId);
    const date = todayDateOnly();
    const existing = await this.prisma.attendanceRecord.findUnique({ where: { employeeId_date: { employeeId: employee.id, date } } });
    if (!existing?.clockInTime) {
      throw new ConflictAppException('Not clocked in today.');
    }
    if (existing.clockOutTime) {
      throw new ConflictAppException('Already clocked out today.');
    }

    const now = new Date();
    let overtimeMinutes = 0;
    if (employee.shiftId) {
      const shift = await this.prisma.shift.findUnique({ where: { id: employee.shiftId } });
      if (shift) {
        const end = timeOnDate(shift.endTime, now);
        if (now > end) overtimeMinutes = Math.round((now.getTime() - end.getTime()) / 60_000);
      }
    }

    const record = await this.prisma.attendanceRecord.update({
      where: { id: existing.id },
      data: { clockOutTime: now, overtimeMinutes },
    });
    await this.record(user.id, 'attendance.clocked_out', employee.companyId, 'attendance_record', record.id, { overtimeMinutes });
    return record;
  }

  async markAbsent(user: AuthenticatedUser, dto: MarkAbsentDto) {
    const employee = await this.prisma.employee.findUnique({ where: { id: dto.employeeId } });
    if (!employee || !isCompanyInScope(user, employee.companyId, MANAGE_PERM)) {
      throw new NotFoundAppException('Employee not found.');
    }
    const date = new Date(dto.date);
    date.setUTCHours(0, 0, 0, 0);
    const record = await this.prisma.attendanceRecord.upsert({
      where: { employeeId_date: { employeeId: dto.employeeId, date } },
      update: { status: 'absent', clockInTime: null, clockOutTime: null, notes: dto.notes, recordedBy: user.id },
      create: { employeeId: dto.employeeId, companyId: employee.companyId, date, status: 'absent', notes: dto.notes, recordedBy: user.id },
    });
    await this.record(user.id, 'attendance.marked_absent', employee.companyId, 'attendance_record', record.id, {});
    return record;
  }

  // ---------------------------------------------------------------- Reports

  async listRecords(user: AuthenticatedUser, filters: { companyId?: string; employeeId?: string; dateFrom?: string; dateTo?: string }) {
    const where: any = {};
    if (filters.employeeId) where.employeeId = filters.employeeId;
    if (filters.dateFrom || filters.dateTo) {
      where.date = {};
      if (filters.dateFrom) where.date.gte = new Date(filters.dateFrom);
      if (filters.dateTo) where.date.lte = new Date(filters.dateTo);
    }
    if (hasGroupVisibility(user, GROUP_PERM)) {
      if (filters.companyId) where.companyId = filters.companyId;
    } else {
      const scoped = user.scopes.map((s) => s.companyId);
      where.companyId = filters.companyId && scoped.includes(filters.companyId) ? filters.companyId : { in: scoped.length > 0 ? scoped : ['__none__'] };
    }
    return this.prisma.attendanceRecord.findMany({ where, orderBy: { date: 'desc' } });
  }

  // "Attendance reports": present/late/absent counts and total overtime,
  // grouped by employee, for a date range — a summary, not an exportable
  // report with its own CSV/PDF template (that infrastructure already
  // exists in common/reports; wiring this summary through it is natural
  // follow-up work, not attempted here to keep this pass bounded).
  async summary(user: AuthenticatedUser, filters: { companyId?: string; dateFrom?: string; dateTo?: string }) {
    const records = await this.listRecords(user, filters);
    const byEmployee = new Map<string, { employeeId: string; present: number; late: number; absent: number; halfDay: number; totalOvertimeMinutes: number; totalLateMinutes: number }>();
    for (const r of records) {
      if (!byEmployee.has(r.employeeId)) {
        byEmployee.set(r.employeeId, { employeeId: r.employeeId, present: 0, late: 0, absent: 0, halfDay: 0, totalOvertimeMinutes: 0, totalLateMinutes: 0 });
      }
      const row = byEmployee.get(r.employeeId)!;
      if (r.status === 'present') row.present += 1;
      if (r.status === 'late') row.late += 1;
      if (r.status === 'absent') row.absent += 1;
      if (r.status === 'half_day') row.halfDay += 1;
      row.totalOvertimeMinutes += r.overtimeMinutes;
      row.totalLateMinutes += r.lateMinutes;
    }
    return Array.from(byEmployee.values());
  }

  // Resolves which Employee a self-service call concerns: the caller's own
  // linked Employee record if no employeeId was given, or an explicit
  // employeeId (requires attendance.manage and the employee's company to
  // be in scope) for HR/a manager recording on someone's behalf.
  private async resolveEmployee(user: AuthenticatedUser, employeeId?: string) {
    if (!employeeId) {
      const own = await this.prisma.employee.findFirst({ where: { userId: user.id } });
      if (!own) {
        throw new NotFoundAppException('Your account is not linked to an employee record. Ask HR to record your attendance, or link your account to an employee record.');
      }
      return own;
    }
    if (!user.permissions.includes(MANAGE_PERM)) {
      throw new ForbiddenAppException(`Your role does not include the "${MANAGE_PERM}" permission required for this action.`);
    }
    const employee = await this.prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee || !isCompanyInScope(user, employee.companyId, GROUP_PERM)) {
      throw new NotFoundAppException('Employee not found.');
    }
    return employee;
  }

  private async record(userId: string, eventType: string, companyId: string, entityType: string, entityId: string, newValue: Record<string, unknown>) {
    await this.auditService.record({ eventType, sourceService: 'attendance-service', userId, companyId, entityType, entityId, action: 'update', newValue });
  }
}
