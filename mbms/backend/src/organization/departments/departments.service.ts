import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ConflictAppException, NotFoundAppException } from '../../common/app-exception';
import { AuthenticatedUser } from '../../common/strategies/jwt.strategy';
import { hasGroupVisibility, isCompanyInScope } from '../../common/scope.util';
import { CreateDepartmentDto, UpdateDepartmentDto } from './dto/department.dto';
import { AuditService } from '../../common/audit/audit.service';

function toResource(department: any) {
  return {
    id: department.id,
    companyId: department.companyId,
    name: department.name,
    description: department.description,
    createdAt: department.createdAt,
    updatedAt: department.updatedAt,
  };
}

@Injectable()
export class DepartmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  // GET /organization/departments — the dedicated Departments admin screen
  // (28 August 2026): every department across the companies in the caller's
  // scope, each with its company name and current headcount.
  async listAll(user: AuthenticatedUser, companyId?: string) {
    const where: any = {};
    if (hasGroupVisibility(user, 'organization.company.viewAll')) {
      if (companyId) where.companyId = companyId;
    } else {
      const ids = user.scopes.map((s) => s.companyId);
      where.companyId =
        companyId && ids.includes(companyId) ? companyId : { in: ids.length ? ids : ['__none__'] };
    }

    const rows = await this.prisma.department.findMany({
      where,
      include: { company: { select: { name: true } } },
      orderBy: [{ companyId: 'asc' }, { name: 'asc' }],
    });
    if (rows.length === 0) return [];

    const counts = await this.prisma.employee.groupBy({
      by: ['departmentId'],
      where: { departmentId: { in: rows.map((r) => r.id) }, status: 'active' },
      _count: { _all: true },
    });
    const countBy = new Map(counts.map((c) => [c.departmentId, c._count._all]));

    return rows.map((d) => ({
      ...toResource(d),
      companyName: (d as any).company?.name ?? null,
      employeeCount: countBy.get(d.id) ?? 0,
    }));
  }

  // GET /organization/companies/{id}/departments — scoped, FR-COMP-08
  async listForCompany(companyId: string, user: AuthenticatedUser) {
    await this.assertCompanyInScope(companyId, user);
    const departments = await this.prisma.department.findMany({
      where: { companyId },
      orderBy: { name: 'asc' },
    });
    return departments.map(toResource);
  }

  // POST /organization/companies/{id}/departments — Super Admin, FR-COMP-08
  async create(actor: AuthenticatedUser, companyId: string, dto: CreateDepartmentDto) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new NotFoundAppException('Company not found.');

    const department = await this.prisma.department.create({
      data: { companyId, name: dto.name, description: dto.description },
    });
    await this.auditService.record({
      eventType: 'organization.department.created',
      sourceService: 'organization-service',
      userId: actor.id,
      companyId,
      entityType: 'department',
      entityId: department.id,
      action: 'create',
      newValue: { name: department.name, companyId },
    });
    return toResource(department);
  }

  // PATCH /organization/departments/{id} — Super Admin, FR-COMP-08
  async update(actor: AuthenticatedUser, id: string, dto: UpdateDepartmentDto) {
    const existing = await this.prisma.department.findUnique({ where: { id } });
    if (!existing) throw new NotFoundAppException('Department not found.');
    const department = await this.prisma.department.update({ where: { id }, data: dto });
    await this.auditService.record({
      eventType: 'organization.department.updated',
      sourceService: 'organization-service',
      userId: actor.id,
      companyId: department.companyId,
      entityType: 'department',
      entityId: department.id,
      action: 'update',
      previousValue: toResource(existing),
      newValue: toResource(department),
    });
    return toResource(department);
  }

  // DELETE /organization/departments/{id} — blocked while staff are still in it.
  async remove(actor: AuthenticatedUser, id: string) {
    const department = await this.prisma.department.findUnique({ where: { id } });
    if (!department) throw new NotFoundAppException('Department not found.');
    const staff = await this.prisma.employee.count({ where: { departmentId: id } });
    if (staff) {
      throw new ConflictAppException(`"${department.name}" still has ${staff} employee(s). Reassign them before deleting it.`);
    }
    await this.prisma.department.delete({ where: { id } });
    await this.auditService.record({
      eventType: 'organization.department.deleted',
      sourceService: 'organization-service',
      userId: actor.id,
      companyId: department.companyId,
      entityType: 'department',
      entityId: id,
      action: 'delete',
      previousValue: toResource(department),
    });
    return { deleted: true, id, name: department.name };
  }

  private async assertCompanyInScope(companyId: string, user: AuthenticatedUser) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new NotFoundAppException('Company not found.');
    if (!isCompanyInScope(user, companyId)) throw new NotFoundAppException('Company not found.');
  }
}
