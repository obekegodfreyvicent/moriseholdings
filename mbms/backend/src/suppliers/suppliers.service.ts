import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundAppException } from '../common/app-exception';
import { Paginated } from '../common/interceptors/response.interceptor';
import { AuthenticatedUser } from '../common/strategies/jwt.strategy';
import { hasGroupVisibility, isCompanyInScope } from '../common/scope.util';
import { CreateSupplierDto, UpdateSupplierDto } from './dto/supplier.dto';
import { AuditService } from '../common/audit/audit.service';

const GROUP_PERM = 'supplier.viewAll';
const SENSITIVE_PERM = 'supplier.view.sensitive';

function toResource(s: any, revealSensitive: boolean) {
  return {
    id: s.id,
    companyId: s.companyId,
    name: s.name,
    category: s.category,
    contactEmail: s.contactEmail,
    contactPhone: s.contactPhone,
    address: s.address,
    taxId: s.taxId,
    contractReference: s.contractReference,
    contractExpiryDate: s.contractExpiryDate,
    bankName: revealSensitive ? s.bankName : s.bankName ? '•••• restricted ••••' : null,
    bankAccountNumber: revealSensitive
      ? s.bankAccountNumber
      : s.bankAccountNumber
        ? '•••• restricted ••••'
        : null,
    status: s.status,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  };
}

@Injectable()
export class SuppliersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  // GET /suppliers — FR-SUPP-01, scoped per BR-01
  async list(
    user: AuthenticatedUser,
    page: number,
    pageSize: number,
    filters: { companyId?: string; category?: string; status?: string },
  ): Promise<Paginated<unknown>> {
    const where: any = {};
    if (filters.category) where.category = filters.category;
    if (filters.status) where.status = filters.status;

    if (hasGroupVisibility(user, GROUP_PERM)) {
      if (filters.companyId) where.companyId = filters.companyId;
    } else {
      // BR-01 / Alpha 5.2: see the identical fix and comment in
      // employees.service.ts's list() — filters.companyId must be checked
      // against the caller's own scope before use.
      const scopedCompanyIds = user.scopes.map((s) => s.companyId);
      where.companyId =
        filters.companyId && scopedCompanyIds.includes(filters.companyId)
          ? filters.companyId
          : { in: scopedCompanyIds.length > 0 ? scopedCompanyIds : ['__none__'] };
    }

    const revealSensitive = user.permissions.includes(SENSITIVE_PERM);
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.supplier.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.supplier.count({ where }),
    ]);
    return { items: rows.map((r) => toResource(r, revealSensitive)), page, pageSize, total };
  }

  // POST /suppliers — FR-SUPP-01 / AC-06
  async create(user: AuthenticatedUser, dto: CreateSupplierDto) {
    if (!isCompanyInScope(user, dto.companyId, GROUP_PERM)) {
      throw new NotFoundAppException('Company not found.');
    }
    const supplier = await this.prisma.supplier.create({
      data: {
        ...dto,
        contractExpiryDate: dto.contractExpiryDate ? new Date(dto.contractExpiryDate) : undefined,
      },
    });
    await this.auditService.record({
      eventType: 'supplier.record.created',
      sourceService: 'supplier-service',
      userId: user.id,
      companyId: supplier.companyId,
      entityType: 'supplier',
      entityId: supplier.id,
      action: 'create',
      newValue: { name: supplier.name, category: supplier.category },
    });
    return toResource(supplier, user.permissions.includes(SENSITIVE_PERM));
  }

  // GET /suppliers/{id} — FR-SUPP-01
  async get(user: AuthenticatedUser, id: string) {
    const supplier = await this.findOrThrow(id);
    if (!isCompanyInScope(user, supplier.companyId, GROUP_PERM)) {
      throw new NotFoundAppException('Supplier not found.');
    }
    return toResource(supplier, user.permissions.includes(SENSITIVE_PERM));
  }

  // PATCH /suppliers/{id} — FR-SUPP-02
  async update(user: AuthenticatedUser, id: string, dto: UpdateSupplierDto) {
    const supplier = await this.findOrThrow(id);
    if (!isCompanyInScope(user, supplier.companyId, GROUP_PERM)) {
      throw new NotFoundAppException('Supplier not found.');
    }
    const updated = await this.prisma.supplier.update({
      where: { id },
      data: {
        ...dto,
        contractExpiryDate: dto.contractExpiryDate ? new Date(dto.contractExpiryDate) : undefined,
      },
    });
    await this.auditService.record({
      eventType: 'supplier.record.updated',
      sourceService: 'supplier-service',
      userId: user.id,
      companyId: updated.companyId,
      entityType: 'supplier',
      entityId: updated.id,
      action: 'update',
      // Bank/tax fields deliberately excluded from the audit payload, not
      // just the API response — 09_API Specification, Section 11 notes
      // sensitive field values are never carried in event payloads,
      // matching the Employee Service's identical convention.
      previousValue: { status: supplier.status, category: supplier.category, contractReference: supplier.contractReference },
      newValue: { status: updated.status, category: updated.category, contractReference: updated.contractReference },
    });
    return toResource(updated, user.permissions.includes(SENSITIVE_PERM));
  }

  // POST /suppliers/{id}/blacklist — FR-SUPP-03
  async blacklist(user: AuthenticatedUser, id: string) {
    const supplier = await this.findOrThrow(id);
    if (!isCompanyInScope(user, supplier.companyId, GROUP_PERM)) {
      throw new NotFoundAppException('Supplier not found.');
    }
    const updated = await this.prisma.supplier.update({ where: { id }, data: { status: 'blacklisted' } });
    await this.auditService.record({
      eventType: 'supplier.record.updated',
      sourceService: 'supplier-service',
      userId: user.id,
      companyId: updated.companyId,
      entityType: 'supplier',
      entityId: updated.id,
      action: 'update',
      previousValue: { status: supplier.status },
      newValue: { status: 'blacklisted' },
    });
    return toResource(updated, user.permissions.includes(SENSITIVE_PERM));
  }

  // POST /suppliers/{id}/unblacklist — FR-SUPP-03
  async unblacklist(user: AuthenticatedUser, id: string) {
    const supplier = await this.findOrThrow(id);
    if (!isCompanyInScope(user, supplier.companyId, GROUP_PERM)) {
      throw new NotFoundAppException('Supplier not found.');
    }
    const updated = await this.prisma.supplier.update({ where: { id }, data: { status: 'active' } });
    await this.auditService.record({
      eventType: 'supplier.record.updated',
      sourceService: 'supplier-service',
      userId: user.id,
      companyId: updated.companyId,
      entityType: 'supplier',
      entityId: updated.id,
      action: 'update',
      previousValue: { status: supplier.status },
      newValue: { status: 'active' },
    });
    return toResource(updated, user.permissions.includes(SENSITIVE_PERM));
  }

  private async findOrThrow(id: string) {
    const supplier = await this.prisma.supplier.findUnique({ where: { id } });
    if (!supplier) throw new NotFoundAppException('Supplier not found.');
    return supplier;
  }
}
