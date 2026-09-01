import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConflictAppException, NotFoundAppException } from '../common/app-exception';
import { Paginated } from '../common/interceptors/response.interceptor';
import { AuthenticatedUser } from '../common/strategies/jwt.strategy';
import { hasGroupVisibility, isCompanyInScope } from '../common/scope.util';
import {
  CreateSupplierContactDto,
  CreateSupplierDto,
  CreateSupplierEvaluationDto,
  SuspendSupplierDto,
  UpdateSupplierContactDto,
  UpdateSupplierDto,
} from './dto/supplier.dto';
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
    suspensionReason: s.suspensionReason ?? null,
    suspendedUntil: s.suspendedUntil ?? null,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  };
}

function contactResource(c: any) {
  return {
    id: c.id,
    supplierId: c.supplierId,
    name: c.name,
    title: c.title,
    email: c.email,
    phone: c.phone,
    isPrimary: c.isPrimary,
    note: c.note,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

function evaluationResource(e: any) {
  return {
    id: e.id,
    supplierId: e.supplierId,
    companyId: e.companyId,
    periodLabel: e.periodLabel,
    deliveryScore: e.deliveryScore,
    qualityScore: e.qualityScore,
    priceScore: e.priceScore,
    communicationScore: e.communicationScore,
    complianceScore: e.complianceScore,
    overallScore: Number(e.overallScore),
    comments: e.comments,
    evaluatedBy: e.evaluatedBy,
    createdAt: e.createdAt,
  };
}

function ratingBand(avg: number | null): string | null {
  if (avg === null) return null;
  if (avg >= 4.5) return 'Excellent';
  if (avg >= 3.5) return 'Good';
  if (avg >= 2.5) return 'Fair';
  return 'Poor';
}

const START_OF_TODAY = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

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
    const lifted = await Promise.all(rows.map((r) => this.autoLift(r)));
    return { items: lifted.map((r) => toResource(r, revealSensitive)), page, pageSize, total };
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
    const supplier = await this.autoLift(await this.findOrThrow(id));
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

  // POST /suppliers/{id}/suspend — FR-SUPP-04. A time-bound hold, distinct
  // from an indefinite blacklist: `until` (optional) is the auto-lift date.
  async suspend(user: AuthenticatedUser, id: string, dto: SuspendSupplierDto) {
    const supplier = await this.findOrThrow(id);
    if (!isCompanyInScope(user, supplier.companyId, GROUP_PERM)) {
      throw new NotFoundAppException('Supplier not found.');
    }
    if (supplier.status === 'blacklisted') {
      throw new ConflictAppException('Unblacklist the supplier before suspending it.');
    }
    const until = dto.until ? new Date(dto.until) : null;
    if (until && until < START_OF_TODAY()) {
      throw new ConflictAppException('Suspension end date must be in the future.');
    }
    const updated = await this.prisma.supplier.update({
      where: { id },
      data: { status: 'suspended', suspensionReason: dto.reason, suspendedUntil: until },
    });
    await this.auditService.record({
      eventType: 'supplier.record.updated',
      sourceService: 'supplier-service',
      userId: user.id,
      companyId: updated.companyId,
      entityType: 'supplier',
      entityId: updated.id,
      action: 'update',
      previousValue: { status: supplier.status },
      newValue: { status: 'suspended', reason: dto.reason, suspendedUntil: until },
    });
    return toResource(updated, user.permissions.includes(SENSITIVE_PERM));
  }

  // POST /suppliers/{id}/unsuspend — FR-SUPP-04
  async unsuspend(user: AuthenticatedUser, id: string) {
    const supplier = await this.findOrThrow(id);
    if (!isCompanyInScope(user, supplier.companyId, GROUP_PERM)) {
      throw new NotFoundAppException('Supplier not found.');
    }
    const updated = await this.prisma.supplier.update({
      where: { id },
      data: { status: 'active', suspensionReason: null, suspendedUntil: null },
    });
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

  // ---- FR-SUPP-05: multi-contact list -----------------------------------

  async listContacts(user: AuthenticatedUser, supplierId: string) {
    const supplier = await this.findOrThrow(supplierId);
    if (!isCompanyInScope(user, supplier.companyId, GROUP_PERM)) {
      throw new NotFoundAppException('Supplier not found.');
    }
    const rows = await this.prisma.supplierContact.findMany({
      where: { supplierId },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    });
    return rows.map(contactResource);
  }

  async addContact(user: AuthenticatedUser, supplierId: string, dto: CreateSupplierContactDto) {
    const supplier = await this.findOrThrow(supplierId);
    if (!isCompanyInScope(user, supplier.companyId, GROUP_PERM)) {
      throw new NotFoundAppException('Supplier not found.');
    }
    const created = await this.prisma.$transaction(async (tx) => {
      if (dto.isPrimary) {
        await tx.supplierContact.updateMany({ where: { supplierId }, data: { isPrimary: false } });
      }
      return tx.supplierContact.create({ data: { ...dto, supplierId } });
    });
    await this.auditService.record({
      eventType: 'supplier.contact.created',
      sourceService: 'supplier-service',
      userId: user.id,
      companyId: supplier.companyId,
      entityType: 'supplier_contact',
      entityId: created.id,
      action: 'create',
      newValue: { supplierId, name: created.name, title: created.title, isPrimary: created.isPrimary },
    });
    return contactResource(created);
  }

  async updateContact(
    user: AuthenticatedUser,
    supplierId: string,
    contactId: string,
    dto: UpdateSupplierContactDto,
  ) {
    const supplier = await this.findOrThrow(supplierId);
    if (!isCompanyInScope(user, supplier.companyId, GROUP_PERM)) {
      throw new NotFoundAppException('Supplier not found.');
    }
    const existing = await this.prisma.supplierContact.findFirst({ where: { id: contactId, supplierId } });
    if (!existing) throw new NotFoundAppException('Contact not found.');
    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.isPrimary) {
        await tx.supplierContact.updateMany({
          where: { supplierId, id: { not: contactId } },
          data: { isPrimary: false },
        });
      }
      return tx.supplierContact.update({ where: { id: contactId }, data: { ...dto } });
    });
    await this.auditService.record({
      eventType: 'supplier.contact.updated',
      sourceService: 'supplier-service',
      userId: user.id,
      companyId: supplier.companyId,
      entityType: 'supplier_contact',
      entityId: contactId,
      action: 'update',
      newValue: { name: updated.name, title: updated.title, isPrimary: updated.isPrimary },
    });
    return contactResource(updated);
  }

  async removeContact(user: AuthenticatedUser, supplierId: string, contactId: string) {
    const supplier = await this.findOrThrow(supplierId);
    if (!isCompanyInScope(user, supplier.companyId, GROUP_PERM)) {
      throw new NotFoundAppException('Supplier not found.');
    }
    const existing = await this.prisma.supplierContact.findFirst({ where: { id: contactId, supplierId } });
    if (!existing) throw new NotFoundAppException('Contact not found.');
    await this.prisma.supplierContact.delete({ where: { id: contactId } });
    await this.auditService.record({
      eventType: 'supplier.contact.deleted',
      sourceService: 'supplier-service',
      userId: user.id,
      companyId: supplier.companyId,
      entityType: 'supplier_contact',
      entityId: contactId,
      action: 'delete',
      previousValue: { name: existing.name },
    });
    return { deleted: true };
  }

  // ---- FR-SUPP-06: evaluation scorecards -------------------------------

  async listEvaluations(user: AuthenticatedUser, supplierId: string) {
    const supplier = await this.findOrThrow(supplierId);
    if (!isCompanyInScope(user, supplier.companyId, GROUP_PERM)) {
      throw new NotFoundAppException('Supplier not found.');
    }
    const rows = await this.prisma.supplierEvaluation.findMany({
      where: { supplierId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(evaluationResource);
  }

  async addEvaluation(user: AuthenticatedUser, supplierId: string, dto: CreateSupplierEvaluationDto) {
    const supplier = await this.findOrThrow(supplierId);
    if (!isCompanyInScope(user, supplier.companyId, GROUP_PERM)) {
      throw new NotFoundAppException('Supplier not found.');
    }
    const overall =
      (dto.deliveryScore +
        dto.qualityScore +
        dto.priceScore +
        dto.communicationScore +
        dto.complianceScore) /
      5;
    const created = await this.prisma.supplierEvaluation.create({
      data: {
        supplierId,
        companyId: supplier.companyId,
        periodLabel: dto.periodLabel,
        deliveryScore: dto.deliveryScore,
        qualityScore: dto.qualityScore,
        priceScore: dto.priceScore,
        communicationScore: dto.communicationScore,
        complianceScore: dto.complianceScore,
        overallScore: overall.toFixed(2),
        comments: dto.comments,
        evaluatedBy: user.id,
      },
    });
    await this.auditService.record({
      eventType: 'supplier.evaluation.created',
      sourceService: 'supplier-service',
      userId: user.id,
      companyId: supplier.companyId,
      entityType: 'supplier_evaluation',
      entityId: created.id,
      action: 'create',
      newValue: { supplierId, periodLabel: created.periodLabel, overallScore: Number(created.overallScore) },
    });
    return evaluationResource(created);
  }

  async removeEvaluation(user: AuthenticatedUser, supplierId: string, evaluationId: string) {
    const supplier = await this.findOrThrow(supplierId);
    if (!isCompanyInScope(user, supplier.companyId, GROUP_PERM)) {
      throw new NotFoundAppException('Supplier not found.');
    }
    const existing = await this.prisma.supplierEvaluation.findFirst({
      where: { id: evaluationId, supplierId },
    });
    if (!existing) throw new NotFoundAppException('Evaluation not found.');
    await this.prisma.supplierEvaluation.delete({ where: { id: evaluationId } });
    await this.auditService.record({
      eventType: 'supplier.evaluation.deleted',
      sourceService: 'supplier-service',
      userId: user.id,
      companyId: supplier.companyId,
      entityType: 'supplier_evaluation',
      entityId: evaluationId,
      action: 'delete',
      previousValue: { periodLabel: existing.periodLabel },
    });
    return { deleted: true };
  }

  // ---- FR-SUPP-07: derived performance summary -------------------------

  async performance(user: AuthenticatedUser, supplierId: string) {
    const supplier = await this.autoLift(await this.findOrThrow(supplierId));
    if (!isCompanyInScope(user, supplier.companyId, GROUP_PERM)) {
      throw new NotFoundAppException('Supplier not found.');
    }

    const evaluations = await this.prisma.supplierEvaluation.findMany({
      where: { supplierId },
      orderBy: { createdAt: 'desc' },
    });

    const scoreOf = (e: any) => Number(e.overallScore);
    const avg = (nums: number[]) =>
      nums.length ? Number((nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2)) : null;

    const overallAvg = avg(evaluations.map(scoreOf));
    const latest = evaluations[0] ?? null;
    const previous = evaluations[1] ?? null;
    let trend: 'up' | 'down' | 'flat' | null = null;
    if (latest && previous) {
      const d = scoreOf(latest) - scoreOf(previous);
      trend = d > 0.05 ? 'up' : d < -0.05 ? 'down' : 'flat';
    }

    const invoices = await this.prisma.supplierInvoice.findMany({
      where: { supplierId, companyId: supplier.companyId },
      select: { totalAmount: true, amountPaid: true, status: true, dueDate: true },
    });
    const num = (d: any) => Number(d ?? 0);
    const today = START_OF_TODAY();
    const totalInvoiced = invoices.reduce((a, i) => a + num(i.totalAmount), 0);
    const totalPaid = invoices.reduce((a, i) => a + num(i.amountPaid), 0);
    const overdueInvoices = invoices.filter(
      (i) =>
        i.status === 'overdue' ||
        (['approved', 'partially_paid', 'pending_approval'].includes(i.status) && i.dueDate < today),
    ).length;

    return {
      supplierId: supplier.id,
      status: supplier.status,
      evaluation: {
        count: evaluations.length,
        overallAverage: overallAvg,
        ratingBand: ratingBand(overallAvg),
        trend,
        latest: latest
          ? { periodLabel: latest.periodLabel, overallScore: scoreOf(latest), createdAt: latest.createdAt }
          : null,
        criteriaAverages: {
          delivery: avg(evaluations.map((e) => e.deliveryScore)),
          quality: avg(evaluations.map((e) => e.qualityScore)),
          price: avg(evaluations.map((e) => e.priceScore)),
          communication: avg(evaluations.map((e) => e.communicationScore)),
          compliance: avg(evaluations.map((e) => e.complianceScore)),
        },
      },
      accountsPayable: {
        invoices: invoices.length,
        paidInvoices: invoices.filter((i) => i.status === 'paid').length,
        overdueInvoices,
        totalInvoiced: Number(totalInvoiced.toFixed(2)),
        totalPaid: Number(totalPaid.toFixed(2)),
        outstanding: Number((totalInvoiced - totalPaid).toFixed(2)),
      },
    };
  }

  // A suspension with a past `suspendedUntil` lifts itself the next time the
  // record is read. Only expired rows are written, so the common path is a
  // no-op.
  private async autoLift(supplier: any) {
    if (
      supplier.status === 'suspended' &&
      supplier.suspendedUntil &&
      new Date(supplier.suspendedUntil) < START_OF_TODAY()
    ) {
      return this.prisma.supplier.update({
        where: { id: supplier.id },
        data: { status: 'active', suspensionReason: null, suspendedUntil: null },
      });
    }
    return supplier;
  }

  private async findOrThrow(id: string) {
    const supplier = await this.prisma.supplier.findUnique({ where: { id } });
    if (!supplier) throw new NotFoundAppException('Supplier not found.');
    return supplier;
  }
}
