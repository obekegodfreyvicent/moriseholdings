import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConflictAppException, NotFoundAppException } from '../common/app-exception';
import { AuthenticatedUser } from '../common/strategies/jwt.strategy';
import { hasGroupVisibility, isCompanyInScope } from '../common/scope.util';
import { AuditService } from '../common/audit/audit.service';
import { NotificationsService } from '../common/notifications/notifications.service';
import { CreateRosterEntryDto, PublishRosterDto } from './dto/shift-scheduling.dto';

const GROUP_PERM = 'attendance.viewAll';

function dayKey(d: Date) {
  return new Date(d).toISOString().slice(0, 10);
}

@Injectable()
export class ShiftSchedulingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  private companyFilter(user: AuthenticatedUser, companyId?: string) {
    if (hasGroupVisibility(user, GROUP_PERM)) return companyId ? { companyId } : {};
    const ids = user.scopes.map((s) => s.companyId);
    return {
      companyId: companyId && ids.includes(companyId) ? companyId : { in: ids.length ? ids : ['__none__'] },
    };
  }

  // GET /shift-scheduling/entries?companyId=&from=&to=
  async listEntries(user: AuthenticatedUser, filters: { companyId?: string; from?: string; to?: string }) {
    const where: any = { ...this.companyFilter(user, filters.companyId) };
    if (filters.from || filters.to) {
      where.date = {};
      if (filters.from) where.date.gte = new Date(filters.from);
      if (filters.to) where.date.lte = new Date(filters.to);
    }
    const rows = await this.prisma.rosterEntry.findMany({
      where,
      include: { shift: { select: { name: true, startTime: true, endTime: true } } },
      orderBy: [{ date: 'asc' }],
      take: 1000,
    });
    const empNames = await this.employeeNames(rows.map((r) => r.employeeId));
    return rows.map((r) => ({
      id: r.id,
      companyId: r.companyId,
      employeeId: r.employeeId,
      employeeName: empNames.get(r.employeeId) ?? r.employeeId,
      shiftId: r.shiftId,
      shiftName: r.shift?.name ?? null,
      shiftStart: r.shift?.startTime ?? null,
      shiftEnd: r.shift?.endTime ?? null,
      date: r.date,
      status: r.status,
      note: r.note,
      publishedAt: r.publishedAt,
    }));
  }

  // POST /shift-scheduling/entries
  async createEntry(user: AuthenticatedUser, dto: CreateRosterEntryDto) {
    if (!isCompanyInScope(user, dto.companyId, GROUP_PERM)) throw new NotFoundAppException('Company not found.');
    const [employee, shift] = await Promise.all([
      this.prisma.employee.findUnique({ where: { id: dto.employeeId } }),
      this.prisma.shift.findUnique({ where: { id: dto.shiftId } }),
    ]);
    if (!employee || employee.companyId !== dto.companyId) throw new NotFoundAppException('Employee not found in this company.');
    if (!shift || shift.companyId !== dto.companyId) throw new NotFoundAppException('Shift not found in this company.');

    const date = new Date(dto.date);
    const clash = await this.prisma.rosterEntry.findFirst({
      where: { employeeId: dto.employeeId, date },
      include: { shift: { select: { name: true } } },
    });
    if (clash) {
      throw new ConflictAppException(
        `${employee.firstName} ${employee.lastName} is already rostered on the ${clash.shift?.name ?? 'a'} shift on ${dayKey(date)}.`,
      );
    }

    const entry = await this.prisma.rosterEntry.create({
      data: {
        companyId: dto.companyId,
        employeeId: dto.employeeId,
        shiftId: dto.shiftId,
        date,
        note: dto.note ?? null,
        createdBy: user.id,
      },
    });
    await this.audit(user, 'shift.roster_entry.created', dto.companyId, entry.id, null, {
      employeeId: dto.employeeId,
      shiftId: dto.shiftId,
      date: dayKey(date),
    });
    return { ...entry, employeeName: `${employee.firstName} ${employee.lastName}`, shiftName: shift.name };
  }

  // DELETE /shift-scheduling/entries/:id
  async removeEntry(user: AuthenticatedUser, id: string) {
    const entry = await this.prisma.rosterEntry.findUnique({ where: { id } });
    if (!entry || !isCompanyInScope(user, entry.companyId, GROUP_PERM)) throw new NotFoundAppException('Roster entry not found.');
    await this.prisma.rosterEntry.delete({ where: { id } });
    await this.audit(user, 'shift.roster_entry.deleted', entry.companyId, id, { date: dayKey(entry.date), status: entry.status }, null);
    return { deleted: true };
  }

  // POST /shift-scheduling/publish
  async publish(user: AuthenticatedUser, dto: PublishRosterDto) {
    if (!isCompanyInScope(user, dto.companyId, GROUP_PERM)) throw new NotFoundAppException('Company not found.');
    const from = new Date(dto.from);
    const to = new Date(dto.to);
    const planned = await this.prisma.rosterEntry.findMany({
      where: { companyId: dto.companyId, status: 'planned', date: { gte: from, lte: to } },
    });
    if (planned.length === 0) {
      throw new ConflictAppException('There are no planned roster entries in that range to publish.');
    }
    const now = new Date();
    await this.prisma.rosterEntry.updateMany({
      where: { id: { in: planned.map((p) => p.id) } },
      data: { status: 'published', publishedAt: now },
    });

    // Notify each affected employee who has a system login.
    const employees = await this.prisma.employee.findMany({
      where: { id: { in: [...new Set(planned.map((p) => p.employeeId))] }, userId: { not: null } },
      select: { id: true, userId: true },
    });
    for (const emp of employees) {
      const count = planned.filter((p) => p.employeeId === emp.id).length;
      await this.notifications.notifyUsers([emp.userId as string], {
        companyId: dto.companyId,
        type: 'shift.roster_published',
        title: `Your roster for ${dayKey(from)} – ${dayKey(to)} is published (${count} shift${count === 1 ? '' : 's'}).`,
        entityType: 'roster',
        entityId: null,
      });
    }

    await this.audit(user, 'shift.roster.published', dto.companyId, null, null, {
      from: dayKey(from),
      to: dayKey(to),
      entries: planned.length,
      employeesNotified: employees.length,
    });
    return { published: planned.length, employeesNotified: employees.length };
  }

  // GET /shift-scheduling/coverage?companyId=&from=&to=
  async coverage(user: AuthenticatedUser, filters: { companyId?: string; from: string; to: string }) {
    const companyFilter = this.companyFilter(user, filters.companyId);
    const from = new Date(filters.from);
    const to = new Date(filters.to);

    const [entries, activeEmployees, approvedLeave] = await Promise.all([
      this.prisma.rosterEntry.findMany({
        where: { ...companyFilter, date: { gte: from, lte: to } },
        include: { shift: { select: { name: true } } },
      }),
      this.prisma.employee.count({ where: { ...companyFilter, status: 'active' } }),
      this.prisma.leaveApplication.findMany({
        where: { ...companyFilter, status: 'approved', startDate: { lte: to }, endDate: { gte: from } },
        select: { employeeId: true, startDate: true, endDate: true },
      }),
    ]);

    const empNames = await this.employeeNames([
      ...new Set([...entries.map((e) => e.employeeId), ...approvedLeave.map((l) => l.employeeId)]),
    ]);

    const byDay = new Map<string, { date: string; byShift: Record<string, number>; staffed: Set<string>; clashes: string[] }>();
    for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
      const key = dayKey(d);
      byDay.set(key, { date: key, byShift: {}, staffed: new Set(), clashes: [] });
    }
    for (const e of entries) {
      const day = byDay.get(dayKey(e.date));
      if (!day) continue;
      const name = e.shift?.name ?? 'Unassigned shift';
      day.byShift[name] = (day.byShift[name] ?? 0) + 1;
      day.staffed.add(e.employeeId);
      // Clash: rostered on a day the employee is also on approved leave.
      const onLeave = approvedLeave.some(
        (l) => l.employeeId === e.employeeId && new Date(l.startDate) <= e.date && new Date(l.endDate) >= e.date,
      );
      if (onLeave) day.clashes.push(`${empNames.get(e.employeeId) ?? e.employeeId} is rostered but on approved leave`);
    }

    const days = [...byDay.values()].map((d) => ({
      date: d.date,
      byShift: d.byShift,
      staffed: d.staffed.size,
      unrostered: Math.max(0, activeEmployees - d.staffed.size),
      clashes: d.clashes,
    }));
    return {
      activeEmployees,
      days,
      totalEntries: entries.length,
      totalClashes: days.reduce((n, d) => n + d.clashes.length, 0),
    };
  }

  private async employeeNames(ids: string[]) {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return new Map<string, string>();
    const rows = await this.prisma.employee.findMany({
      where: { id: { in: unique } },
      select: { id: true, firstName: true, lastName: true },
    });
    return new Map(rows.map((r) => [r.id, `${r.firstName} ${r.lastName}`]));
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
      sourceService: 'shift-scheduling-service',
      userId: user.id,
      companyId,
      entityType: 'roster_entry',
      entityId,
      action: eventType.endsWith('deleted') ? 'delete' : eventType.endsWith('created') ? 'create' : 'update',
      previousValue,
      newValue,
    });
  }
}
