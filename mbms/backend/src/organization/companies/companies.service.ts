import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ConflictAppException, NotFoundAppException } from '../../common/app-exception';
import { Paginated } from '../../common/interceptors/response.interceptor';
import { AuthenticatedUser } from '../../common/strategies/jwt.strategy';
import { isCompanyInScope } from '../../common/scope.util';
import { CreateCompanyDto, UpdateCompanyDto } from './dto/company.dto';
import { AuditService } from '../../common/audit/audit.service';

function toResource(company: any) {
  return {
    id: company.id,
    parentCompanyId: company.parentCompanyId,
    relationshipType: company.relationshipType,
    ownershipPercent: company.ownershipPercent === null || company.ownershipPercent === undefined
      ? null
      : Number(company.ownershipPercent),
    name: company.name,
    registrationNumber: company.registrationNumber,
    taxId: company.taxId,
    address: company.address,
    contactEmail: company.contactEmail,
    contactPhone: company.contactPhone,
    logoUrl: company.logoUrl,
    currency: company.currency,
    financialYearStart: company.financialYearStart,
    status: company.status,
    createdAt: company.createdAt,
    updatedAt: company.updatedAt,
  };
}

@Injectable()
export class CompaniesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  // GET /organization/companies — Group-level users only, FR-COMP-09
  async list(user: AuthenticatedUser, page: number, pageSize: number): Promise<Paginated<unknown>> {
    // Guarded at the controller by requiring organization.company.viewAll;
    // this call only runs once that's already true.
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.company.findMany({
        orderBy: { createdAt: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.company.count(),
    ]);
    return { items: rows.map(toResource), page, pageSize, total };
  }

  // POST /organization/companies — Super Admin, FR-COMP-01/02/03 / AC-02
  async create(actor: AuthenticatedUser, dto: CreateCompanyDto) {
    if (!dto.parentCompanyId) {
      // BR-02: the root holding company has a null parent; there can only
      // be one root.
      const existingRoot = await this.prisma.company.findFirst({ where: { parentCompanyId: null } });
      if (existingRoot) {
        throw new ConflictAppException(
          `"${existingRoot.name}" is already registered as the root holding company. ` +
            'Every other company must specify a parentCompanyId.',
        );
      }
      if (dto.relationshipType || dto.ownershipPercent !== undefined) {
        throw new BadRequestException('The root holding company has no relationshipType or ownershipPercent.');
      }
    } else {
      const parent = await this.prisma.company.findUnique({ where: { id: dto.parentCompanyId } });
      if (!parent) throw new NotFoundAppException('Parent company not found.');
      // FR-COMP-03: every non-root company must say whether it's a
      // subsidiary or an associate/affiliate.
      if (!dto.relationshipType) {
        throw new BadRequestException('relationshipType ("subsidiary" or "associate") is required when parentCompanyId is set.');
      }
    }

    const company = await this.prisma.company.create({
      data: {
        parentCompanyId: dto.parentCompanyId ?? null,
        relationshipType: dto.relationshipType ?? null,
        ownershipPercent: dto.ownershipPercent ?? null,
        name: dto.name,
        registrationNumber: dto.registrationNumber,
        taxId: dto.taxId,
        address: dto.address,
        contactEmail: dto.contactEmail,
        contactPhone: dto.contactPhone,
        logoUrl: dto.logoUrl,
        currency: dto.currency ?? 'UGX',
        financialYearStart: new Date(dto.financialYearStart),
      },
    });
    await this.auditService.record({
      eventType: 'organization.company.created',
      sourceService: 'organization-service',
      userId: actor.id,
      companyId: company.id,
      entityType: 'company',
      entityId: company.id,
      action: 'create',
      newValue: { name: company.name, parentCompanyId: company.parentCompanyId },
    });
    return toResource(company);
  }

  // GET /organization/companies/{id} — scoped, FR-COMP-06
  async get(id: string, user: AuthenticatedUser) {
    const company = await this.findOrThrow(id);
    this.assertInScope(user, id);
    return toResource(company);
  }

  // PATCH /organization/companies/{id} — Super Admin, FR-COMP-06/07
  async update(actor: AuthenticatedUser, id: string, dto: UpdateCompanyDto) {
    const before = await this.findOrThrow(id);
    const company = await this.prisma.company.update({
      where: { id },
      data: {
        ...dto,
        financialYearStart: dto.financialYearStart ? new Date(dto.financialYearStart) : undefined,
      },
    });
    await this.auditService.record({
      eventType: 'organization.company.updated',
      sourceService: 'organization-service',
      userId: actor.id,
      companyId: company.id,
      entityType: 'company',
      entityId: company.id,
      action: 'update',
      previousValue: toResource(before),
      newValue: toResource(company),
    });
    return toResource(company);
  }

  // POST /organization/companies/{id}/activate | /deactivate — the "execute"
  // control on a subsidiary (27 August 2026): a Managing Director can bring a
  // subsidiary in or out of operation without deleting it or its history.
  async setStatus(actor: AuthenticatedUser, id: string, status: 'active' | 'inactive') {
    const before = await this.findOrThrow(id);
    if (!before.parentCompanyId && status === 'inactive') {
      throw new ConflictAppException('The root holding company cannot be deactivated.');
    }
    const company = await this.prisma.company.update({ where: { id }, data: { status } });
    await this.auditService.record({
      eventType: 'organization.company.updated',
      sourceService: 'organization-service',
      userId: actor.id,
      companyId: company.id,
      entityType: 'company',
      entityId: company.id,
      action: status === 'active' ? 'approve' : 'update',
      previousValue: { status: before.status },
      newValue: { status: company.status },
    });
    return toResource(company);
  }

  // DELETE /organization/companies/{id} — a subsidiary may only be permanently
  // removed once it is genuinely empty; otherwise the MD is told to deactivate
  // it instead so no records are lost. The root holding company can never be
  // deleted.
  async remove(actor: AuthenticatedUser, id: string) {
    const company = await this.findOrThrow(id);
    if (!company.parentCompanyId) {
      throw new ConflictAppException('The root holding company cannot be deleted.');
    }
    const [subsidiaries, branches, departments, employees, customers, suppliers, products, accounts, icFrom, icTo] =
      await this.prisma.$transaction([
        this.prisma.company.count({ where: { parentCompanyId: id } }),
        this.prisma.branch.count({ where: { companyId: id } }),
        this.prisma.department.count({ where: { companyId: id } }),
        this.prisma.employee.count({ where: { companyId: id } }),
        this.prisma.customer.count({ where: { companyId: id } }),
        this.prisma.supplier.count({ where: { companyId: id } }),
        this.prisma.product.count({ where: { companyId: id } }),
        this.prisma.account.count({ where: { companyId: id } }),
        this.prisma.interCompanyTransaction.count({ where: { fromCompanyId: id } }),
        this.prisma.interCompanyTransaction.count({ where: { toCompanyId: id } }),
      ]);
    const blockers: string[] = [];
    if (subsidiaries) blockers.push(`${subsidiaries} subsidiary(ies)`);
    if (branches) blockers.push(`${branches} branch(es)`);
    if (departments) blockers.push(`${departments} department(s)`);
    if (employees) blockers.push(`${employees} employee(s)`);
    if (customers) blockers.push(`${customers} customer(s)`);
    if (suppliers) blockers.push(`${suppliers} supplier(s)`);
    if (products) blockers.push(`${products} product(s)`);
    if (accounts) blockers.push(`${accounts} ledger account(s)`);
    if (icFrom + icTo) blockers.push(`${icFrom + icTo} inter-company transaction(s)`);
    if (blockers.length) {
      throw new ConflictAppException(
        `"${company.name}" still has ${blockers.join(', ')} and cannot be deleted. Deactivate it instead.`,
      );
    }
    // Company-scoped policies are configuration only — they go with it.
    await this.prisma.companyPolicy.deleteMany({ where: { companyId: id } });
    await this.prisma.company.delete({ where: { id } });
    await this.auditService.record({
      eventType: 'organization.company.deleted',
      sourceService: 'organization-service',
      userId: actor.id,
      companyId: null,
      entityType: 'company',
      entityId: id,
      action: 'delete',
      previousValue: toResource(company),
    });
    return { deleted: true, id, name: company.name };
  }

  // GET /organization/companies/{id}/hierarchy — scoped, FR-COMP-05
  async hierarchy(id: string, user: AuthenticatedUser) {
    await this.findOrThrow(id);
    this.assertInScope(user, id);

    const all = await this.prisma.company.findMany({ orderBy: { createdAt: 'asc' } });
    const byParent = new Map<string | null, any[]>();
    for (const c of all) {
      const key = c.parentCompanyId;
      if (!byParent.has(key)) byParent.set(key, []);
      byParent.get(key)!.push(c);
    }

    const build = (companyId: string): any => {
      const c = all.find((x) => x.id === companyId)!;
      return {
        ...toResource(c),
        subsidiaries: (byParent.get(companyId) ?? []).map((child) => build(child.id)),
      };
    };

    return build(id);
  }

  private async findOrThrow(id: string) {
    const company = await this.prisma.company.findUnique({ where: { id } });
    if (!company) throw new NotFoundAppException('Company not found.');
    return company;
  }

  private assertInScope(user: AuthenticatedUser, companyId: string) {
    if (!isCompanyInScope(user, companyId)) {
      // Per 09_API Specification, Section 2.5: a resource outside the
      // caller's scope reads as NOT_FOUND, not FORBIDDEN, so the response
      // doesn't confirm the resource even exists.
      throw new NotFoundAppException('Company not found.');
    }
  }
}
