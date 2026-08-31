import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../common/strategies/jwt.strategy';

// HR Dashboard (28 August 2026) — a read-only oversight view aggregating the
// employee, attendance, leave and recruitment modules. Anyone holding one of
// the HR "viewAll" permissions sees it group-wide (those permissions are the
// group-visibility markers for their module); a scoped manager without any of
// them is limited to the companies on their UserScope rows.

const GROUP_PERMS = [
  'employee.viewAll',
  'recruitment.viewAll',
  'attendance.viewAll',
  'leave.viewAll',
  'performance.viewAll',
];

const ATTENDANCE_WINDOW_DAYS = 30;
const UPCOMING_WINDOW_DAYS = 30;
const PROBATION_DAYS = 90;

@Injectable()
export class HrDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  /** null => group-wide; otherwise the company ids the caller may see. */
  private companyScope(user: AuthenticatedUser): string[] | null {
    if ((user.permissions ?? []).some((p) => GROUP_PERMS.includes(p))) return null;
    const ids = user.scopes.map((s) => s.companyId);
    return ids.length ? ids : ['__none__'];
  }

  async overview(user: AuthenticatedUser) {
    const scope = this.companyScope(user);
    const companyFilter = scope ? { companyId: { in: scope } } : {};
    const now = new Date();
    const attendanceSince = new Date(now.getTime() - ATTENDANCE_WINDOW_DAYS * 86_400_000);
    const upcomingUntil = new Date(now.getTime() + UPCOMING_WINDOW_DAYS * 86_400_000);

    const [headcount, attendance, recruitment, upcoming] = await Promise.all([
      this.headcount(companyFilter),
      this.attendance(companyFilter, attendanceSince),
      this.recruitment(scope),
      this.upcoming(companyFilter, now, upcomingUntil),
    ]);

    return {
      generatedAt: now.toISOString(),
      scope: scope ? 'scoped' : 'group',
      attendanceWindowDays: ATTENDANCE_WINDOW_DAYS,
      upcomingWindowDays: UPCOMING_WINDOW_DAYS,
      headcount,
      attendance,
      recruitment,
      upcoming,
    };
  }

  // ------------------------------- headcount -------------------------------
  private async headcount(companyFilter: any) {
    const activeWhere = { ...companyFilter, status: 'active' as const };
    const [active, inactive, byCompany, byBranch, byDept, byContract] = await Promise.all([
      this.prisma.employee.count({ where: activeWhere }),
      this.prisma.employee.count({ where: { ...companyFilter, status: 'inactive' } }),
      this.prisma.employee.groupBy({ by: ['companyId'], where: activeWhere, _count: { _all: true } }),
      this.prisma.employee.groupBy({ by: ['branchId'], where: activeWhere, _count: { _all: true } }),
      this.prisma.employee.groupBy({ by: ['departmentId'], where: activeWhere, _count: { _all: true } }),
      this.prisma.employee.groupBy({ by: ['contractType'], where: activeWhere, _count: { _all: true } }),
    ]);

    const companyNames = await this.nameMap('company', byCompany.map((r) => r.companyId));
    const branchNames = await this.nameMap('branch', byBranch.map((r) => r.branchId).filter(Boolean) as string[]);
    const deptNames = await this.nameMap('department', byDept.map((r) => r.departmentId).filter(Boolean) as string[]);

    return {
      active,
      inactive,
      byCompany: byCompany
        .map((r) => ({ id: r.companyId, name: companyNames.get(r.companyId) ?? r.companyId, count: r._count._all }))
        .sort((a, b) => b.count - a.count),
      byBranch: byBranch
        .map((r) => ({ id: r.branchId, name: r.branchId ? branchNames.get(r.branchId) ?? r.branchId : 'Unassigned', count: r._count._all }))
        .sort((a, b) => b.count - a.count),
      byDepartment: byDept
        .map((r) => ({ id: r.departmentId, name: r.departmentId ? deptNames.get(r.departmentId) ?? r.departmentId : 'Unassigned', count: r._count._all }))
        .sort((a, b) => b.count - a.count),
      byContractType: byContract
        .map((r) => ({ contractType: r.contractType ?? 'Unspecified', count: r._count._all }))
        .sort((a, b) => b.count - a.count),
    };
  }

  // ------------------------------ attendance ------------------------------
  private async attendance(companyFilter: any, since: Date) {
    const rows = await this.prisma.attendanceRecord.groupBy({
      by: ['status'],
      where: { ...companyFilter, date: { gte: since } },
      _count: { _all: true },
    });
    const by: Record<string, number> = { present: 0, late: 0, absent: 0, half_day: 0 };
    for (const r of rows) by[r.status] = r._count._all;
    const total = by.present + by.late + by.absent + by.half_day;
    return {
      totalRecords: total,
      byStatus: by,
      absenceRatePercent: total ? Math.round((by.absent / total) * 1000) / 10 : 0,
      lateRatePercent: total ? Math.round((by.late / total) * 1000) / 10 : 0,
    };
  }

  // ------------------------------ recruitment ------------------------------
  private async recruitment(scope: string[] | null) {
    const vacWhere = scope ? { companyId: { in: scope } } : {};
    const [open, pendingApproval, onHold, positions, activeVacancies] = await Promise.all([
      this.prisma.jobVacancy.count({ where: { ...vacWhere, status: 'open' } }),
      this.prisma.jobVacancy.count({ where: { ...vacWhere, status: 'pending_approval' } }),
      this.prisma.jobVacancy.count({ where: { ...vacWhere, status: 'on_hold' } }),
      this.prisma.jobVacancy.aggregate({ where: { ...vacWhere, status: 'open' }, _sum: { numberOfPositions: true } }),
      this.prisma.jobVacancy.findMany({
        where: { ...vacWhere, status: { in: ['open', 'pending_approval', 'on_hold'] } },
        select: { id: true },
      }),
    ]);

    const vacIds = activeVacancies.map((v) => v.id);
    const pipelineRows = vacIds.length
      ? await this.prisma.jobApplication.groupBy({
          by: ['status'],
          where: { vacancyId: { in: vacIds }, status: { notIn: ['rejected', 'hired'] } },
          _count: { _all: true },
        })
      : [];
    const pipeline: Record<string, number> = {
      applied: 0,
      shortlisted: 0,
      interview_scheduled: 0,
      interviewed: 0,
      offered: 0,
    };
    for (const r of pipelineRows) if (r.status in pipeline) pipeline[r.status] = r._count._all;

    return {
      openVacancies: open,
      pendingApproval,
      onHold,
      positionsOpen: positions._sum.numberOfPositions ?? 0,
      pipeline,
      pipelineTotal: Object.values(pipeline).reduce((a, b) => a + b, 0),
    };
  }

  // ------------------------------- upcoming -------------------------------
  private async upcoming(companyFilter: any, now: Date, until: Date) {
    const probationStartFrom = new Date(now.getTime() - PROBATION_DAYS * 86_400_000);
    const probationStartTo = new Date(until.getTime() - PROBATION_DAYS * 86_400_000);

    const [contractsEnding, probationEnding, leaveStarting] = await Promise.all([
      this.prisma.employee.findMany({
        where: { ...companyFilter, status: 'active', employmentEndDate: { gte: now, lte: until } },
        select: { id: true, firstName: true, lastName: true, jobTitle: true, employmentEndDate: true },
        orderBy: { employmentEndDate: 'asc' },
        take: 25,
      }),
      this.prisma.employee.findMany({
        where: {
          ...companyFilter,
          status: 'active',
          employmentStartDate: { gte: probationStartFrom, lte: probationStartTo },
        },
        select: { id: true, firstName: true, lastName: true, jobTitle: true, employmentStartDate: true },
        orderBy: { employmentStartDate: 'asc' },
        take: 25,
      }),
      this.prisma.leaveApplication.findMany({
        where: { ...companyFilter, status: 'approved', startDate: { gte: now, lte: until } },
        orderBy: { startDate: 'asc' },
        take: 25,
      }),
    ]);

    const leaveEmpNames = await this.employeeNameMap(leaveStarting.map((l) => l.employeeId));

    return {
      contractsEnding: contractsEnding.map((e) => ({
        employeeId: e.id,
        name: `${e.firstName} ${e.lastName}`,
        jobTitle: e.jobTitle,
        date: e.employmentEndDate,
      })),
      probationEnding: probationEnding.map((e) => ({
        employeeId: e.id,
        name: `${e.firstName} ${e.lastName}`,
        jobTitle: e.jobTitle,
        date: new Date(new Date(e.employmentStartDate).getTime() + PROBATION_DAYS * 86_400_000),
      })),
      leaveStarting: leaveStarting.map((l) => ({
        leaveId: l.id,
        name: leaveEmpNames.get(l.employeeId) ?? l.employeeId,
        leaveType: l.leaveType,
        startDate: l.startDate,
        endDate: l.endDate,
        days: l.daysRequested,
      })),
    };
  }

  // ------------------------------- helpers -------------------------------
  private async nameMap(model: 'company' | 'branch' | 'department', ids: string[]) {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return new Map<string, string>();
    const rows = await (this.prisma as any)[model].findMany({
      where: { id: { in: unique } },
      select: { id: true, name: true },
    });
    return new Map<string, string>(rows.map((r: any) => [r.id, r.name]));
  }

  private async employeeNameMap(ids: string[]) {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return new Map<string, string>();
    const rows = await this.prisma.employee.findMany({
      where: { id: { in: unique } },
      select: { id: true, firstName: true, lastName: true },
    });
    return new Map<string, string>(rows.map((r) => [r.id, `${r.firstName} ${r.lastName}`]));
  }
}
