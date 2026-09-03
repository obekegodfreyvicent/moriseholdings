import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConflictAppException, NotFoundAppException } from '../common/app-exception';
import { Paginated } from '../common/interceptors/response.interceptor';
import { AuthenticatedUser } from '../common/strategies/jwt.strategy';
import { hasGroupVisibility, isCompanyInScope } from '../common/scope.util';
import { CreateEmployeeDto, UpdateEmployeeDto } from './dto/employee.dto';
import { AuditService } from '../common/audit/audit.service';
import { StaffIdCardsService } from '../staff-id-cards/staff-id-cards.service';

const GROUP_PERM = 'employee.viewAll';
const SENSITIVE_PERM = 'employee.view.sensitive';

// FR-USER-08: bank/tax fields are masked unless the caller holds the
// elevated permission — matching 09_API Specification's note on
// GET /employees/{id}.
function toResource(e: any, revealSensitive: boolean) {
  return {
    id: e.id,
    companyId: e.companyId,
    branchId: e.branchId,
    departmentId: e.departmentId,
    employeeNumber: e.employeeNumber,
    firstName: e.firstName,
    lastName: e.lastName,
    nationalId: e.nationalId,
    jobTitle: e.jobTitle,
    jobDescription: e.jobDescription,
    employmentStartDate: e.employmentStartDate,
    employmentEndDate: e.employmentEndDate,
    contractType: e.contractType,
    qualifications: e.qualifications,
    nextOfKinName: e.nextOfKinName,
    nextOfKinPhone: e.nextOfKinPhone,
    emergencyContactName: e.emergencyContactName,
    emergencyContactPhone: e.emergencyContactPhone,
    bankName: revealSensitive ? e.bankName : e.bankName ? '•••• restricted ••••' : null,
    bankAccountNumber: revealSensitive ? e.bankAccountNumber : e.bankAccountNumber ? '•••• restricted ••••' : null,
    taxIdentificationNumber: revealSensitive
      ? e.taxIdentificationNumber
      : e.taxIdentificationNumber
        ? '•••• restricted ••••'
        : null,
    status: e.status,
    userId: e.userId,
    documentReference: e.documentReference,
    shiftId: e.shiftId,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
  };
}

@Injectable()
export class EmployeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly staffIdCards: StaffIdCardsService,
  ) {}

  // GET /employees — FR-EMP-01, scoped per BR-01
  async list(
    user: AuthenticatedUser,
    page: number,
    pageSize: number,
    filters: { companyId?: string; branchId?: string; departmentId?: string; status?: string },
  ): Promise<Paginated<unknown>> {
    const where: any = {};
    if (filters.status) where.status = filters.status;
    if (filters.branchId) where.branchId = filters.branchId;
    if (filters.departmentId) where.departmentId = filters.departmentId;

    if (hasGroupVisibility(user, GROUP_PERM)) {
      if (filters.companyId) where.companyId = filters.companyId;
    } else {
      // BR-01 / Alpha 5.2: filters.companyId is caller-supplied and must be
      // checked against the caller's own scope before use — otherwise a
      // scoped user can pass an arbitrary filter[companyId] and read another
      // company's records outright. An out-of-scope request falls back to
      // the caller's real scope rather than erroring, since this is a list
      // filter, not a single-resource fetch.
      const scopedCompanyIds = user.scopes.map((s) => s.companyId);
      where.companyId =
        filters.companyId && scopedCompanyIds.includes(filters.companyId)
          ? filters.companyId
          : { in: scopedCompanyIds.length > 0 ? scopedCompanyIds : ['__none__'] };
    }

    const revealSensitive = user.permissions.includes(SENSITIVE_PERM);
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.employee.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.employee.count({ where }),
    ]);
    return { items: rows.map((r) => toResource(r, revealSensitive)), page, pageSize, total };
  }

  // POST /employees — FR-EMP-01 / AC-05
  async create(user: AuthenticatedUser, dto: CreateEmployeeDto) {
    if (!isCompanyInScope(user, dto.companyId, GROUP_PERM)) {
      throw new NotFoundAppException('Company not found.');
    }
    const existing = await this.prisma.employee.findFirst({
      where: { companyId: dto.companyId, employeeNumber: dto.employeeNumber },
    });
    if (existing) {
      throw new ConflictAppException(
        `Employee number "${dto.employeeNumber}" already exists for this company.`,
      );
    }
    const employee = await this.prisma.employee.create({
      data: {
        ...dto,
        employmentStartDate: new Date(dto.employmentStartDate),
      },
    });
    await this.auditService.record({
      eventType: 'employee.record.created',
      sourceService: 'employee-service',
      userId: user.id,
      companyId: employee.companyId,
      entityType: 'employee',
      entityId: employee.id,
      action: 'create',
      newValue: { employeeNumber: employee.employeeNumber, firstName: employee.firstName, lastName: employee.lastName },
    });
    // Automatic Staff Identification Card (3 September 2026): every actively
    // registered staff member carries a card — issue it the moment the
    // record is created. Best-effort; never blocks the create.
    await this.staffIdCards.issueForEmployeeAuto(
      { id: employee.id, companyId: employee.companyId, employeeNumber: employee.employeeNumber, status: employee.status },
      user.id,
    );
    return toResource(employee, user.permissions.includes(SENSITIVE_PERM));
  }

  // GET /employees/{id} — FR-EMP-01, 05, FR-USER-08
  async get(user: AuthenticatedUser, id: string) {
    const employee = await this.findOrThrow(id);
    if (!isCompanyInScope(user, employee.companyId, GROUP_PERM)) {
      throw new NotFoundAppException('Employee not found.');
    }
    return toResource(employee, user.permissions.includes(SENSITIVE_PERM));
  }

  // PATCH /employees/{id} — FR-EMP-02, 04, 05
  async update(user: AuthenticatedUser, id: string, dto: UpdateEmployeeDto) {
    const employee = await this.findOrThrow(id);
    if (!isCompanyInScope(user, employee.companyId, GROUP_PERM)) {
      throw new NotFoundAppException('Employee not found.');
    }
    // HR Module deepening: "Employment history" (FR-EMP-02) was, until
    // this pass, one current position with a start/end date only — a
    // documented Sprint 3 simplification. This closes the row that
    // position's PREVIOUS state as an EmployeeEmploymentHistory row
    // whenever jobTitle/departmentId/branchId actually changes, rather
    // than backfilling history this codebase never captured. endDate is
    // set to today; a fresh, currently-open row (endDate null) is not
    // created here — the Employee record's own current fields already
    // serve that purpose, avoiding a duplicate "current position" concept
    // in two places at once.
    const positionChanged =
      (dto.jobTitle !== undefined && dto.jobTitle !== employee.jobTitle) ||
      (dto.departmentId !== undefined && dto.departmentId !== employee.departmentId) ||
      (dto.branchId !== undefined && dto.branchId !== employee.branchId);
    if (positionChanged) {
      // The closing row's startDate is the most recent history row's
      // endDate, if one exists (this employee has changed position
      // before) — using employee.employmentStartDate unconditionally
      // would be correct only for the very first change and silently
      // wrong (overlapping date ranges) for every change after that.
      const lastHistoryRow = await this.prisma.employeeEmploymentHistory.findFirst({
        where: { employeeId: id },
        orderBy: { endDate: 'desc' },
      });
      await this.prisma.employeeEmploymentHistory.create({
        data: {
          employeeId: id,
          jobTitle: employee.jobTitle,
          departmentId: employee.departmentId,
          branchId: employee.branchId,
          startDate: lastHistoryRow?.endDate ?? employee.employmentStartDate,
          endDate: new Date(),
        },
      });
    }
    const updated = await this.prisma.employee.update({ where: { id }, data: dto });
    await this.auditService.record({
      eventType: 'employee.record.updated',
      sourceService: 'employee-service',
      userId: user.id,
      companyId: updated.companyId,
      entityType: 'employee',
      entityId: updated.id,
      action: 'update',
      // Bank/tax fields deliberately excluded from the audit payload, not
      // just the API response — 09_API Specification, Section 11 notes
      // sensitive field values are never carried in event payloads.
      previousValue: { status: employee.status, jobTitle: employee.jobTitle },
      newValue: { status: updated.status, jobTitle: updated.jobTitle },
    });
    // Keep the staff identification card in step with the employee's
    // status — a deactivated employee's card is revoked, a returning one's
    // is re-activated. Best-effort.
    if (dto.status !== undefined && dto.status !== employee.status) {
      await this.staffIdCards.syncEmployeeStatus(
        { id: updated.id, companyId: updated.companyId, status: updated.status },
        user.id,
      );
    }
    return toResource(updated, user.permissions.includes(SENSITIVE_PERM));
  }

  async employmentHistory(user: AuthenticatedUser, id: string) {
    const employee = await this.findOrThrow(id);
    if (!isCompanyInScope(user, employee.companyId, GROUP_PERM)) {
      throw new NotFoundAppException('Employee not found.');
    }
    return this.prisma.employeeEmploymentHistory.findMany({ where: { employeeId: id }, orderBy: { startDate: 'desc' } });
  }

  private async findOrThrow(id: string) {
    const employee = await this.prisma.employee.findUnique({ where: { id } });
    if (!employee) throw new NotFoundAppException('Employee not found.');
    return employee;
  }
}
