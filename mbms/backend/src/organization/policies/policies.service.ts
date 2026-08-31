import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundAppException } from '../../common/app-exception';
import { AuthenticatedUser } from '../../common/strategies/jwt.strategy';
import { isCompanyInScope } from '../../common/scope.util';
import { CreatePolicyDto, UpdatePolicyDto } from './dto/policy.dto';
import { AuditService } from '../../common/audit/audit.service';

function toResource(p: any) {
  return {
    id: p.id,
    companyId: p.companyId,
    name: p.name,
    description: p.description,
    policyType: p.policyType,
    documentReference: p.documentReference,
    effectiveDate: p.effectiveDate,
    status: p.status,
    createdBy: p.createdBy,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

// morise.docx, Section 2: "Configure company-specific policies." Follows
// BranchesService's exact shape (GET .../companies/{id}/policies scoped,
// no static permission; POST/PATCH gated by organization.company.manage) —
// a policy is company configuration data, the same class of record as a
// branch or department, not a workflow with its own approval chain.
@Injectable()
export class PoliciesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async listForCompany(companyId: string, user: AuthenticatedUser) {
    await this.assertCompanyInScope(companyId, user);
    const rows = await this.prisma.companyPolicy.findMany({ where: { companyId }, orderBy: { name: 'asc' } });
    return rows.map(toResource);
  }

  async create(actor: AuthenticatedUser, companyId: string, dto: CreatePolicyDto) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new NotFoundAppException('Company not found.');

    const policy = await this.prisma.companyPolicy.create({
      data: {
        companyId,
        name: dto.name,
        description: dto.description,
        policyType: dto.policyType,
        documentReference: dto.documentReference,
        effectiveDate: dto.effectiveDate ? new Date(dto.effectiveDate) : undefined,
        createdBy: actor.id,
      },
    });
    await this.auditService.record({
      eventType: 'organization.policy.created',
      sourceService: 'organization-service',
      userId: actor.id,
      companyId,
      entityType: 'company_policy',
      entityId: policy.id,
      action: 'create',
      newValue: { name: policy.name, policyType: policy.policyType },
    });
    return toResource(policy);
  }

  async update(actor: AuthenticatedUser, id: string, dto: UpdatePolicyDto) {
    const existing = await this.prisma.companyPolicy.findUnique({ where: { id } });
    if (!existing) throw new NotFoundAppException('Policy not found.');
    const policy = await this.prisma.companyPolicy.update({
      where: { id },
      data: { ...dto, effectiveDate: dto.effectiveDate ? new Date(dto.effectiveDate) : undefined },
    });
    await this.auditService.record({
      eventType: 'organization.policy.updated',
      sourceService: 'organization-service',
      userId: actor.id,
      companyId: policy.companyId,
      entityType: 'company_policy',
      entityId: policy.id,
      action: 'update',
      previousValue: { status: existing.status },
      newValue: { status: policy.status },
    });
    return toResource(policy);
  }

  // DELETE /organization/policies/{id} — a policy is company configuration
  // with no downstream records, so it can be removed outright.
  async remove(actor: AuthenticatedUser, id: string) {
    const existing = await this.prisma.companyPolicy.findUnique({ where: { id } });
    if (!existing) throw new NotFoundAppException('Policy not found.');
    await this.prisma.companyPolicy.delete({ where: { id } });
    await this.auditService.record({
      eventType: 'organization.policy.deleted',
      sourceService: 'organization-service',
      userId: actor.id,
      companyId: existing.companyId,
      entityType: 'company_policy',
      entityId: id,
      action: 'delete',
      previousValue: toResource(existing),
    });
    return { deleted: true, id, name: existing.name };
  }

  private async assertCompanyInScope(companyId: string, user: AuthenticatedUser) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new NotFoundAppException('Company not found.');
    if (!isCompanyInScope(user, companyId)) throw new NotFoundAppException('Company not found.');
  }
}
