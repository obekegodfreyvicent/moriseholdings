import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ConflictAppException, NotFoundAppException } from '../../common/app-exception';
import { AuthenticatedUser } from '../../common/strategies/jwt.strategy';
import { isCompanyInScope } from '../../common/scope.util';
import { CreateBranchDto, UpdateBranchDto } from './dto/branch.dto';
import { AuditService } from '../../common/audit/audit.service';

function toResource(branch: any) {
  return {
    id: branch.id,
    companyId: branch.companyId,
    name: branch.name,
    address: branch.address,
    contactPhone: branch.contactPhone,
    status: branch.status,
    createdAt: branch.createdAt,
    updatedAt: branch.updatedAt,
  };
}

@Injectable()
export class BranchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  // GET /organization/companies/{id}/branches — scoped, FR-COMP-04
  async listForCompany(companyId: string, user: AuthenticatedUser) {
    await this.assertCompanyInScope(companyId, user);
    const branches = await this.prisma.branch.findMany({
      where: { companyId },
      orderBy: { name: 'asc' },
    });
    return branches.map(toResource);
  }

  // POST /organization/companies/{id}/branches — Super Admin, FR-COMP-04 / AC-02
  async create(actor: AuthenticatedUser, companyId: string, dto: CreateBranchDto) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new NotFoundAppException('Company not found.');

    const branch = await this.prisma.branch.create({
      data: { companyId, name: dto.name, address: dto.address, contactPhone: dto.contactPhone },
    });
    await this.auditService.record({
      eventType: 'organization.branch.created',
      sourceService: 'organization-service',
      userId: actor.id,
      companyId,
      entityType: 'branch',
      entityId: branch.id,
      action: 'create',
      newValue: { name: branch.name, companyId },
    });
    return toResource(branch);
  }

  // PATCH /organization/branches/{id} — Super Admin, FR-COMP-04
  async update(actor: AuthenticatedUser, id: string, dto: UpdateBranchDto) {
    const existing = await this.prisma.branch.findUnique({ where: { id } });
    if (!existing) throw new NotFoundAppException('Branch not found.');
    const branch = await this.prisma.branch.update({ where: { id }, data: dto });
    await this.auditService.record({
      eventType: 'organization.branch.updated',
      sourceService: 'organization-service',
      userId: actor.id,
      companyId: branch.companyId,
      entityType: 'branch',
      entityId: branch.id,
      action: 'update',
      previousValue: toResource(existing),
      newValue: toResource(branch),
    });
    return toResource(branch);
  }

  // DELETE /organization/branches/{id} — blocked while staff are still
  // assigned to the branch (deactivate the branch instead).
  async remove(actor: AuthenticatedUser, id: string) {
    const branch = await this.prisma.branch.findUnique({ where: { id } });
    if (!branch) throw new NotFoundAppException('Branch not found.');
    const staff = await this.prisma.employee.count({ where: { branchId: id } });
    if (staff) {
      throw new ConflictAppException(`"${branch.name}" still has ${staff} employee(s). Reassign them or deactivate the branch instead.`);
    }
    await this.prisma.branch.delete({ where: { id } });
    await this.auditService.record({
      eventType: 'organization.branch.deleted',
      sourceService: 'organization-service',
      userId: actor.id,
      companyId: branch.companyId,
      entityType: 'branch',
      entityId: id,
      action: 'delete',
      previousValue: toResource(branch),
    });
    return { deleted: true, id, name: branch.name };
  }

  private async assertCompanyInScope(companyId: string, user: AuthenticatedUser) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new NotFoundAppException('Company not found.');
    if (!isCompanyInScope(user, companyId)) throw new NotFoundAppException('Company not found.');
  }
}
