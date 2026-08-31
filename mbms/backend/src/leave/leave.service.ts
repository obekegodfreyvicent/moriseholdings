import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConflictAppException, ForbiddenAppException, NotFoundAppException } from '../common/app-exception';
import { AuthenticatedUser } from '../common/strategies/jwt.strategy';
import { hasGroupVisibility, isCompanyInScope } from '../common/scope.util';
import { AuditService } from '../common/audit/audit.service';
import { RejectLeaveDto, SetLeaveBalanceDto, SubmitLeaveDto } from './dto/leave.dto';

const GROUP_PERM = 'leave.viewAll';
const MANAGE_PERM = 'leave.manage';
const APPROVE_PERM = 'leave.approve';

function inclusiveDays(start: Date, end: Date): number {
  const ms = end.getTime() - start.getTime();
  return Math.round(ms / (24 * 60 * 60 * 1000)) + 1;
}

@Injectable()
export class LeaveService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  // ---------------------------------------------------------------- Balances

  async listBalances(user: AuthenticatedUser, employeeId?: string) {
    const employee = await this.resolveEmployee(user, employeeId, MANAGE_PERM);
    return this.prisma.leaveBalance.findMany({ where: { employeeId: employee.id }, orderBy: [{ year: 'desc' }, { leaveType: 'asc' }] });
  }

  async setBalance(user: AuthenticatedUser, dto: SetLeaveBalanceDto) {
    const employee = await this.prisma.employee.findUnique({ where: { id: dto.employeeId } });
    if (!employee || !isCompanyInScope(user, employee.companyId, MANAGE_PERM)) {
      throw new NotFoundAppException('Employee not found.');
    }
    const balance = await this.prisma.leaveBalance.upsert({
      where: { employeeId_leaveType_year: { employeeId: dto.employeeId, leaveType: dto.leaveType, year: dto.year } },
      update: { entitledDays: dto.entitledDays },
      create: { employeeId: dto.employeeId, leaveType: dto.leaveType, year: dto.year, entitledDays: dto.entitledDays },
    });
    await this.record(user.id, 'leave.balance.set', employee.companyId, 'leave_balance', balance.id, { leaveType: dto.leaveType, year: dto.year, entitledDays: dto.entitledDays });
    return balance;
  }

  // ---------------------------------------------------------------- Applications

  async submit(user: AuthenticatedUser, dto: SubmitLeaveDto) {
    const employee = await this.resolveEmployee(user, dto.employeeId, MANAGE_PERM);
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    if (endDate < startDate) {
      throw new ConflictAppException('endDate must not be before startDate.');
    }
    const daysRequested = inclusiveDays(startDate, endDate);
    const application = await this.prisma.leaveApplication.create({
      data: {
        employeeId: employee.id,
        companyId: employee.companyId,
        leaveType: dto.leaveType,
        startDate,
        endDate,
        daysRequested,
        reason: dto.reason,
        submittedBy: user.id,
      },
    });
    await this.record(user.id, 'leave.application.submitted', employee.companyId, 'leave_application', application.id, { leaveType: dto.leaveType, daysRequested });
    return application;
  }

  async list(user: AuthenticatedUser, filters: { companyId?: string; employeeId?: string; status?: string }) {
    const where: any = {};
    if (filters.status) where.status = filters.status;
    if (filters.employeeId) where.employeeId = filters.employeeId;

    if (hasGroupVisibility(user, GROUP_PERM)) {
      if (filters.companyId) where.companyId = filters.companyId;
    } else {
      const scoped = user.scopes.map((s) => s.companyId);
      where.companyId = filters.companyId && scoped.includes(filters.companyId) ? filters.companyId : { in: scoped.length > 0 ? scoped : ['__none__'] };
      // Narrower-than-scope default, matching Expense's own established
      // convention (README, Sprint 9): without group-wide visibility, a
      // caller sees only their own applications, plus ones awaiting their
      // approval if they hold leave.approve for that company — not every
      // application in their scope, since leave carries personal detail
      // (reason, dates) the way expense claims carry spending detail.
      const own = await this.prisma.employee.findFirst({ where: { userId: user.id } });
      const orConditions: any[] = [];
      if (own) orConditions.push({ employeeId: own.id });
      if (user.permissions.includes(APPROVE_PERM)) orConditions.push({ status: 'submitted' });
      where.AND = where.AND ?? [];
      if (orConditions.length > 0) where.AND.push({ OR: orConditions });
      else where.AND.push({ id: '__none__' });
    }
    return this.prisma.leaveApplication.findMany({ where, orderBy: { createdAt: 'desc' } });
  }

  async approve(user: AuthenticatedUser, id: string) {
    const application = await this.findOrThrow(user, id, APPROVE_PERM);
    if (application.status !== 'submitted') {
      throw new ConflictAppException(`Leave application is "${application.status}", not submitted.`);
    }
    const year = application.startDate.getUTCFullYear();
    const balance = await this.prisma.leaveBalance.findUnique({
      where: { employeeId_leaveType_year: { employeeId: application.employeeId, leaveType: application.leaveType, year } },
    });
    const remaining = balance ? balance.entitledDays - balance.usedDays : 0;
    if (!balance || remaining < application.daysRequested) {
      throw new ConflictAppException(
        `Insufficient ${application.leaveType} leave balance for ${year}: ${remaining} day(s) remaining, ${application.daysRequested} requested.`,
      );
    }
    const [updated] = await this.prisma.$transaction([
      this.prisma.leaveApplication.update({ where: { id }, data: { status: 'approved', approvedBy: user.id, approvedAt: new Date() } }),
      this.prisma.leaveBalance.update({ where: { id: balance.id }, data: { usedDays: { increment: application.daysRequested } } }),
    ]);
    await this.record(user.id, 'leave.application.approved', application.companyId, 'leave_application', id, {});
    return updated;
  }

  async reject(user: AuthenticatedUser, id: string, dto: RejectLeaveDto) {
    const application = await this.findOrThrow(user, id, APPROVE_PERM);
    if (application.status !== 'submitted') {
      throw new ConflictAppException(`Leave application is "${application.status}", not submitted.`);
    }
    const updated = await this.prisma.leaveApplication.update({ where: { id }, data: { status: 'rejected', rejectionReason: dto.reason } });
    await this.record(user.id, 'leave.application.rejected', application.companyId, 'leave_application', id, { reason: dto.reason });
    return updated;
  }

  async cancel(user: AuthenticatedUser, id: string) {
    const application = await this.findOrThrow(user, id, MANAGE_PERM);
    const own = await this.prisma.employee.findFirst({ where: { userId: user.id } });
    const isOwner = own?.id === application.employeeId;
    if (!isOwner && !user.permissions.includes(MANAGE_PERM)) {
      throw new ForbiddenAppException('You may only cancel your own leave application.');
    }
    if (application.status !== 'submitted') {
      throw new ConflictAppException(`Leave application is "${application.status}" — only a submitted (not yet approved) application can be cancelled.`);
    }
    const updated = await this.prisma.leaveApplication.update({ where: { id }, data: { status: 'cancelled' } });
    await this.record(user.id, 'leave.application.cancelled', application.companyId, 'leave_application', id, {});
    return updated;
  }

  // "Leave calendars": approved leave overlapping a date range, for a
  // company — a query view, not a separate stored entity.
  async calendar(user: AuthenticatedUser, companyId: string, dateFrom: string, dateTo: string) {
    if (!isCompanyInScope(user, companyId, GROUP_PERM)) {
      throw new NotFoundAppException('Company not found.');
    }
    return this.prisma.leaveApplication.findMany({
      where: {
        companyId,
        status: 'approved',
        startDate: { lte: new Date(dateTo) },
        endDate: { gte: new Date(dateFrom) },
      },
      orderBy: { startDate: 'asc' },
    });
  }

  private async findOrThrow(user: AuthenticatedUser, id: string, groupPermOverride?: string) {
    const application = await this.prisma.leaveApplication.findUnique({ where: { id } });
    if (!application || !isCompanyInScope(user, application.companyId, groupPermOverride ?? GROUP_PERM)) {
      throw new NotFoundAppException('Leave application not found.');
    }
    return application;
  }

  private async resolveEmployee(user: AuthenticatedUser, employeeId: string | undefined, managePerm: string) {
    if (!employeeId) {
      const own = await this.prisma.employee.findFirst({ where: { userId: user.id } });
      if (!own) {
        throw new NotFoundAppException('Your account is not linked to an employee record. Ask HR to submit this on your behalf.');
      }
      return own;
    }
    if (!user.permissions.includes(managePerm)) {
      throw new ForbiddenAppException(`Your role does not include the "${managePerm}" permission required for this action.`);
    }
    const employee = await this.prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee || !isCompanyInScope(user, employee.companyId, GROUP_PERM)) {
      throw new NotFoundAppException('Employee not found.');
    }
    return employee;
  }

  private async record(userId: string, eventType: string, companyId: string, entityType: string, entityId: string, newValue: Record<string, unknown>) {
    await this.auditService.record({ eventType, sourceService: 'leave-service', userId, companyId, entityType, entityId, action: 'update', newValue });
  }
}
