import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConflictAppException, NotFoundAppException } from '../common/app-exception';
import { Paginated } from '../common/interceptors/response.interceptor';
import { AuthenticatedUser } from '../common/strategies/jwt.strategy';
import { hasGroupVisibility, isCompanyInScope } from '../common/scope.util';
import {
  ApproveDisposalDto,
  CreateAssetCategoryDto,
  CreateAssetDto,
  CreateAssetInspectionDto,
  CreateAssetInsuranceDto,
  CreateMaintenanceRecordDto,
  DisposeAssetDto,
  RecordDepreciationDto,
  RequestDisposalDto,
  TransferAssetDto,
  UpdateAssetCategoryDto,
  UpdateAssetDto,
  UpdateAssetInsuranceDto,
} from './dto/asset.dto';
import { AuditService } from '../common/audit/audit.service';
import { NotificationsService } from '../common/notifications/notifications.service';

const GROUP_PERM = 'asset.viewAll';
const DISPOSAL_APPROVE_PERM = 'asset.approve.disposal';

function toResource(a: any) {
  const purchaseCost = Number(a.purchaseCost);
  const accumulatedDepreciation = Number(a.accumulatedDepreciation);
  return {
    id: a.id,
    companyId: a.companyId,
    branchId: a.branchId,
    departmentId: a.departmentId,
    assetNumber: a.assetNumber,
    name: a.name,
    category: a.category,
    description: a.description,
    custodianEmployeeId: a.custodianEmployeeId,
    categoryId: a.categoryId,
    categoryName: a.assetCategory?.name ?? a.category ?? null,
    supplierId: a.supplierId,
    supplierName: a.supplier?.name ?? null,
    purchaseReference: a.purchaseReference,
    warrantyExpiryDate: a.warrantyExpiryDate,
    purchaseDate: a.purchaseDate,
    purchaseCost: purchaseCost.toFixed(2),
    accumulatedDepreciation: accumulatedDepreciation.toFixed(2),
    netBookValue: (purchaseCost - accumulatedDepreciation).toFixed(2),
    depreciationMethod: a.depreciationMethod,
    usefulLifeYears: a.usefulLifeYears,
    salvageValue: a.salvageValue != null ? Number(a.salvageValue).toFixed(2) : null,
    assetAccountId: a.assetAccountId,
    depreciationExpenseAccountId: a.depreciationExpenseAccountId,
    accumulatedDepreciationAccountId: a.accumulatedDepreciationAccountId,
    insurer: a.insurer,
    insurancePolicyNumber: a.insurancePolicyNumber,
    insuranceExpiryDate: a.insuranceExpiryDate,
    documentReference: a.documentReference,
    status: a.status,
    disposalRequestedBy: a.disposalRequestedBy,
    disposalRequestedAt: a.disposalRequestedAt,
    disposalRequestReason: a.disposalRequestReason,
    disposalApprovedBy: a.disposalApprovedBy,
    disposalApprovedAt: a.disposalApprovedAt,
    inspectionNotes: a.inspectionNotes,
    disposalMethod: a.disposalMethod,
    disposalProceeds: a.disposalProceeds != null ? Number(a.disposalProceeds).toFixed(2) : null,
    disposedAt: a.disposedAt,
    disposalJournalEntryId: a.disposalJournalEntryId,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  };
}

function toMaintenanceResource(m: any) {
  return {
    id: m.id,
    assetId: m.assetId,
    maintenanceDate: m.maintenanceDate,
    description: m.description,
    cost: m.cost != null ? Number(m.cost).toFixed(2) : null,
    performedBy: m.performedBy,
    journalEntryId: m.journalEntryId,
    createdAt: m.createdAt,
  };
}

@Injectable()
export class AssetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
  ) {}

  // GET /assets — FR-ASSET-01, scoped per BR-01. Unlike Expenses, asset
  // records are company-wide operational data (who owns what), not personal
  // claims — so, unlike Expenses' narrower "own + pending my approval"
  // default, any authenticated scoped user sees the full in-scope list,
  // matching the Suppliers/Customers/Products convention instead.
  async list(
    user: AuthenticatedUser,
    page: number,
    pageSize: number,
    filters: { companyId?: string; status?: string; category?: string },
  ): Promise<Paginated<unknown>> {
    const where: any = {};
    if (filters.status) where.status = filters.status;
    if (filters.category) where.category = filters.category;

    if (hasGroupVisibility(user, GROUP_PERM)) {
      if (filters.companyId) where.companyId = filters.companyId;
    } else {
      const scopedCompanyIds = user.scopes.map((s) => s.companyId);
      where.companyId =
        filters.companyId && scopedCompanyIds.includes(filters.companyId)
          ? filters.companyId
          : { in: scopedCompanyIds.length > 0 ? scopedCompanyIds : ['__none__'] };
    }

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.asset.findMany({
        where,
        include: { assetCategory: true, supplier: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.asset.count({ where }),
    ]);
    return { items: rows.map(toResource), page, pageSize, total };
  }

  // POST /assets — FR-ASSET-01
  async create(user: AuthenticatedUser, dto: CreateAssetDto) {
    if (!isCompanyInScope(user, dto.companyId)) {
      throw new NotFoundAppException('Company not found.');
    }
    for (const [field, accountId, expectedType] of [
      ['assetAccountId', dto.assetAccountId, 'asset'],
      ['depreciationExpenseAccountId', dto.depreciationExpenseAccountId, 'expense'],
      ['accumulatedDepreciationAccountId', dto.accumulatedDepreciationAccountId, 'asset'],
    ] as const) {
      if (accountId) await this.assertAccount(dto.companyId, accountId, expectedType, field);
    }
    if (dto.custodianEmployeeId) {
      const employee = await this.prisma.employee.findUnique({ where: { id: dto.custodianEmployeeId } });
      if (!employee || employee.companyId !== dto.companyId) {
        throw new NotFoundAppException('Custodian employee not found for this company.');
      }
    }
    if (dto.supplierId) {
      const supplier = await this.prisma.supplier.findUnique({ where: { id: dto.supplierId } });
      if (!supplier || supplier.companyId !== dto.companyId) {
        throw new NotFoundAppException('Supplier not found for this company.');
      }
    }

    // Asset Management (2 September 2026): inherit depreciation defaults from
    // the category when the registration doesn't override them.
    let category: any = null;
    if (dto.categoryId) {
      category = await this.prisma.assetCategory.findUnique({ where: { id: dto.categoryId } });
      if (!category || category.companyId !== dto.companyId) {
        throw new NotFoundAppException('Asset category not found for this company.');
      }
    }
    const depreciationMethod =
      dto.depreciationMethod ?? category?.defaultDepreciationMethod ?? 'none';
    const usefulLifeYears = dto.usefulLifeYears ?? category?.defaultUsefulLifeYears ?? undefined;
    const salvageValue =
      dto.salvageValue ??
      (category?.defaultSalvagePercent != null
        ? Math.round(dto.purchaseCost * (Number(category.defaultSalvagePercent) / 100) * 100) / 100
        : 0);

    // Auto-number: AST-YYYY-NNNN, from a per-company count, retrying on a
    // unique clash (matches the JE-numbering convention elsewhere).
    let assetNumber = dto.assetNumber?.trim();
    if (!assetNumber) {
      const year = new Date().getFullYear();
      let n = (await this.prisma.asset.count({ where: { companyId: dto.companyId } })) + 1;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const candidate = `AST-${year}-${String(n).padStart(4, '0')}`;
        const exists = await this.prisma.asset.findFirst({
          where: { companyId: dto.companyId, assetNumber: candidate },
        });
        if (!exists) {
          assetNumber = candidate;
          break;
        }
        n += 1;
      }
    }

    const asset = await this.prisma.asset.create({
      data: {
        companyId: dto.companyId,
        branchId: dto.branchId,
        departmentId: dto.departmentId,
        assetNumber,
        name: dto.name,
        category: dto.category ?? category?.name ?? null,
        categoryId: dto.categoryId ?? null,
        description: dto.description,
        custodianEmployeeId: dto.custodianEmployeeId,
        supplierId: dto.supplierId ?? null,
        purchaseReference: dto.purchaseReference ?? null,
        warrantyExpiryDate: dto.warrantyExpiryDate ? new Date(dto.warrantyExpiryDate) : undefined,
        purchaseDate: new Date(dto.purchaseDate),
        purchaseCost: dto.purchaseCost,
        depreciationMethod: depreciationMethod as any,
        usefulLifeYears,
        salvageValue,
        assetAccountId: dto.assetAccountId,
        depreciationExpenseAccountId: dto.depreciationExpenseAccountId,
        accumulatedDepreciationAccountId: dto.accumulatedDepreciationAccountId,
        insurer: dto.insurer,
        insurancePolicyNumber: dto.insurancePolicyNumber,
        insuranceExpiryDate: dto.insuranceExpiryDate ? new Date(dto.insuranceExpiryDate) : undefined,
        documentReference: dto.documentReference,
      },
      include: { assetCategory: true, supplier: true },
    });
    await this.auditService.record({
      eventType: 'asset.record.created',
      sourceService: 'asset-service',
      userId: user.id,
      companyId: asset.companyId,
      entityType: 'asset',
      entityId: asset.id,
      action: 'create',
      newValue: { assetNumber: asset.assetNumber, name: asset.name, purchaseCost: asset.purchaseCost.toString() },
    });
    await this.logEvent(
      asset.id,
      asset.companyId,
      'registered',
      `Registered ${asset.assetNumber} — ${asset.name}`,
      { purchaseCost: asset.purchaseCost.toString(), category: asset.category, supplierId: asset.supplierId },
      user.id,
    );
    return toResource(asset);
  }

  // GET /assets/{id}
  async get(user: AuthenticatedUser, id: string) {
    const asset = await this.findOrThrow(id);
    if (!isCompanyInScope(user, asset.companyId, GROUP_PERM)) {
      throw new NotFoundAppException('Asset not found.');
    }
    return toResource(asset);
  }

  // PATCH /assets/{id}
  async update(user: AuthenticatedUser, id: string, dto: UpdateAssetDto) {
    const asset = await this.findOrThrow(id);
    if (!isCompanyInScope(user, asset.companyId, GROUP_PERM)) {
      throw new NotFoundAppException('Asset not found.');
    }
    if (dto.categoryId) {
      const c = await this.prisma.assetCategory.findUnique({ where: { id: dto.categoryId } });
      if (!c || c.companyId !== asset.companyId) throw new NotFoundAppException('Asset category not found.');
    }
    if (dto.supplierId) {
      const s = await this.prisma.supplier.findUnique({ where: { id: dto.supplierId } });
      if (!s || s.companyId !== asset.companyId) throw new NotFoundAppException('Supplier not found.');
    }
    if (dto.custodianEmployeeId) {
      const e = await this.prisma.employee.findUnique({ where: { id: dto.custodianEmployeeId } });
      if (!e || e.companyId !== asset.companyId) throw new NotFoundAppException('Custodian employee not found.');
    }

    const data: any = {};
    for (const k of ['name', 'category', 'description', 'insurer', 'insurancePolicyNumber', 'documentReference', 'purchaseReference'] as const) {
      if (dto[k] !== undefined) data[k] = dto[k];
    }
    if ('categoryId' in dto) data.categoryId = dto.categoryId ?? null;
    if ('supplierId' in dto) data.supplierId = dto.supplierId ?? null;
    if ('branchId' in dto) data.branchId = dto.branchId ?? null;
    if ('departmentId' in dto) data.departmentId = dto.departmentId ?? null;
    if ('custodianEmployeeId' in dto) data.custodianEmployeeId = dto.custodianEmployeeId ?? null;
    if (dto.insuranceExpiryDate) data.insuranceExpiryDate = new Date(dto.insuranceExpiryDate);
    if (dto.warrantyExpiryDate) data.warrantyExpiryDate = new Date(dto.warrantyExpiryDate);

    const updated = await this.prisma.asset.update({
      where: { id },
      data,
      include: { assetCategory: true, supplier: true },
    });
    await this.auditService.record({
      eventType: 'asset.record.updated',
      sourceService: 'asset-service',
      userId: user.id,
      companyId: updated.companyId,
      entityType: 'asset',
      entityId: updated.id,
      action: 'update',
      previousValue: { category: asset.category, categoryId: asset.categoryId, custodianEmployeeId: asset.custodianEmployeeId },
      newValue: { category: updated.category, categoryId: updated.categoryId, custodianEmployeeId: updated.custodianEmployeeId },
    });
    await this.logEvent(updated.id, updated.companyId, 'updated', `Asset record updated`, { fields: Object.keys(data) }, user.id);
    return toResource(updated);
  }

  // POST /assets/{id}/transfer — FR-ASSET-02: relocate an asset and/or
  // reassign its custodian. A physical relocation, not a financial event —
  // no GL posting.
  async transfer(user: AuthenticatedUser, id: string, dto: TransferAssetDto) {
    const asset = await this.findOrThrow(id);
    if (!isCompanyInScope(user, asset.companyId, GROUP_PERM)) {
      throw new NotFoundAppException('Asset not found.');
    }
    // morise.docx, Section 2: "Transfer or share resources between
    // companies." A cross-company transfer requires asset.manage in the
    // DESTINATION company too, not just the source — isCompanyInScope
    // against the same GROUP_PERM the source check already used, so a
    // Procurement Manager scoped only to Morise Agro Ltd can't move an
    // asset into a company they have no visibility into at all.
    if (dto.toCompanyId && dto.toCompanyId !== asset.companyId) {
      const destinationCompany = await this.prisma.company.findUnique({ where: { id: dto.toCompanyId } });
      if (!destinationCompany || !isCompanyInScope(user, dto.toCompanyId, GROUP_PERM)) {
        throw new NotFoundAppException('Destination company not found.');
      }
    }
    const targetCompanyId = dto.toCompanyId ?? asset.companyId;
    if (dto.custodianEmployeeId) {
      const employee = await this.prisma.employee.findUnique({ where: { id: dto.custodianEmployeeId } });
      if (!employee || employee.companyId !== targetCompanyId) {
        throw new NotFoundAppException('Custodian employee not found for the destination company.');
      }
    }
    // Company-level GL account links are only meaningful within one
    // company's own chart of accounts — a cross-company transfer clears
    // them rather than leaving a stale reference from the old company, the
    // same "don't silently carry over data that no longer applies"
    // discipline as clearing branchId when it isn't supplied.
    const clearAccountLinks = dto.toCompanyId && dto.toCompanyId !== asset.companyId;
    const updated = await this.prisma.asset.update({
      where: { id },
      data: {
        companyId: targetCompanyId,
        branchId: dto.branchId,
        custodianEmployeeId: dto.custodianEmployeeId,
        ...(clearAccountLinks
          ? { assetAccountId: null, depreciationExpenseAccountId: null, accumulatedDepreciationAccountId: null }
          : {}),
      },
    });
    await this.auditService.record({
      eventType: 'asset.transferred',
      sourceService: 'asset-service',
      userId: user.id,
      companyId: updated.companyId,
      entityType: 'asset',
      entityId: updated.id,
      action: 'update',
      previousValue: { companyId: asset.companyId, branchId: asset.branchId, custodianEmployeeId: asset.custodianEmployeeId },
      newValue: { companyId: updated.companyId, branchId: updated.branchId, custodianEmployeeId: updated.custodianEmployeeId },
    });
    await this.logEvent(
      updated.id,
      updated.companyId,
      'transferred',
      dto.toCompanyId && dto.toCompanyId !== asset.companyId
        ? `Transferred to another company`
        : `Relocated / custodian reassigned`,
      { fromCompanyId: asset.companyId, toCompanyId: updated.companyId, fromBranchId: asset.branchId, toBranchId: updated.branchId },
      user.id,
    );
    return toResource(updated);
  }

  // POST /assets/{id}/record-depreciation — FR-ASSET-03: posts a balanced
  // journal entry (debit depreciation expense, credit accumulated
  // depreciation) and increases the asset's own running total. Rejects
  // amounts that would push accumulated depreciation past depreciable cost
  // (purchase cost minus salvage value) — an asset can't depreciate below
  // its salvage value.
  async recordDepreciation(user: AuthenticatedUser, id: string, dto: RecordDepreciationDto) {
    const asset = await this.findOrThrow(id);
    if (!isCompanyInScope(user, asset.companyId, GROUP_PERM)) {
      throw new NotFoundAppException('Asset not found.');
    }
    if (asset.status !== 'active') {
      throw new ConflictAppException(`Cannot record depreciation for an asset with status "${asset.status}".`);
    }
    if (!asset.depreciationExpenseAccountId || !asset.accumulatedDepreciationAccountId) {
      throw new ConflictAppException('This asset has no depreciation expense/accumulated depreciation account configured.');
    }
    const depreciableCost = Number(asset.purchaseCost) - Number(asset.salvageValue ?? 0);
    const newAccumulated = Number(asset.accumulatedDepreciation) + dto.amount;
    if (newAccumulated > depreciableCost + 0.001) {
      throw new ConflictAppException(
        `This would take accumulated depreciation (${newAccumulated.toFixed(2)}) past the depreciable cost (${depreciableCost.toFixed(2)}).`,
      );
    }

    const period = await this.prisma.financialPeriod.findUnique({ where: { id: dto.financialPeriodId } });
    if (!period || period.companyId !== asset.companyId) {
      throw new NotFoundAppException('Financial period not found for this company.');
    }
    if (period.status === 'closed') {
      throw new ConflictAppException(`Cannot post into "${period.periodName}" — this financial period is closed.`);
    }

    const entryCount = await this.prisma.journalEntry.count({ where: { companyId: asset.companyId } });
    const entryNumber = `JE-${new Date().getFullYear()}-${String(entryCount + 1).padStart(4, '0')}`;

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.journalEntry.create({
        data: {
          companyId: asset.companyId,
          entryNumber,
          entryDate: new Date(dto.entryDate),
          description: `Depreciation — ${asset.assetNumber} ${asset.name}`,
          financialPeriodId: dto.financialPeriodId,
          status: 'posted',
          createdBy: user.id,
          postedAt: new Date(),
          items: {
            create: [
              { accountId: asset.depreciationExpenseAccountId!, debitAmount: dto.amount, creditAmount: 0, description: 'Depreciation expense' },
              { accountId: asset.accumulatedDepreciationAccountId!, debitAmount: 0, creditAmount: dto.amount, description: 'Accumulated depreciation' },
            ],
          },
        },
      });
      return tx.asset.update({ where: { id }, data: { accumulatedDepreciation: newAccumulated } });
    });

    await this.auditService.record({
      eventType: 'asset.depreciation.recorded',
      sourceService: 'asset-service',
      userId: user.id,
      companyId: updated.companyId,
      entityType: 'asset',
      entityId: updated.id,
      action: 'update',
      previousValue: { accumulatedDepreciation: asset.accumulatedDepreciation.toString() },
      newValue: { accumulatedDepreciation: updated.accumulatedDepreciation.toString(), amount: dto.amount },
    });
    await this.logEvent(
      updated.id,
      updated.companyId,
      'depreciation',
      `Depreciation ${dto.amount.toFixed(2)} recorded`,
      { amount: dto.amount, accumulatedDepreciation: updated.accumulatedDepreciation.toString(), entryDate: dto.entryDate },
      user.id,
    );
    return toResource(updated);
  }

  // POST /assets/{id}/request-disposal — FR-ASSET-04, step 1 of
  // 05_Business Process Document, Section 6.5's disposal workflow.
  async requestDisposal(user: AuthenticatedUser, id: string, dto: RequestDisposalDto) {
    const asset = await this.findOrThrow(id);
    if (!isCompanyInScope(user, asset.companyId, GROUP_PERM)) {
      throw new NotFoundAppException('Asset not found.');
    }
    if (asset.status !== 'active') {
      throw new ConflictAppException(`Cannot request disposal for an asset with status "${asset.status}".`);
    }
    const updated = await this.prisma.asset.update({
      where: { id },
      data: {
        status: 'disposal_requested',
        disposalRequestedBy: user.id,
        disposalRequestedAt: new Date(),
        disposalRequestReason: dto.reason,
      },
    });
    await this.auditService.record({
      eventType: 'asset.disposal.requested',
      sourceService: 'asset-service',
      userId: user.id,
      companyId: updated.companyId,
      entityType: 'asset',
      entityId: updated.id,
      action: 'update',
      previousValue: { status: 'active' },
      newValue: { status: 'disposal_requested', reason: dto.reason },
    });
    const approverIds = await this.notificationsService.findUsersWithPermissionInCompany(updated.companyId, DISPOSAL_APPROVE_PERM, GROUP_PERM);
    await this.notificationsService.notifyUsers(approverIds, {
      companyId: updated.companyId,
      type: 'asset.disposal_approval_needed',
      title: `Disposal requested — ${updated.assetNumber} ${updated.name}`,
      message: dto.reason ?? undefined,
      entityType: 'asset',
      entityId: updated.id,
    });
    await this.logEvent(updated.id, updated.companyId, 'disposal_requested', `Disposal requested`, { reason: dto.reason ?? null }, user.id);
    return toResource(updated);
  }

  // POST /assets/{id}/approve-disposal — "Management Approval" + "Asset
  // Inspection" folded into one step (inspectionNotes), the same kind of
  // step-combining simplification Expense's pay() already made.
  async approveDisposal(user: AuthenticatedUser, id: string, dto: ApproveDisposalDto) {
    const asset = await this.findOrThrow(id);
    if (!isCompanyInScope(user, asset.companyId, GROUP_PERM)) {
      throw new NotFoundAppException('Asset not found.');
    }
    if (asset.status !== 'disposal_requested') {
      throw new ConflictAppException(`Cannot approve disposal for an asset with status "${asset.status}".`);
    }
    const updated = await this.prisma.asset.update({
      where: { id },
      data: {
        status: 'disposal_approved',
        disposalApprovedBy: user.id,
        disposalApprovedAt: new Date(),
        inspectionNotes: dto.inspectionNotes,
      },
    });
    await this.auditService.record({
      eventType: 'asset.disposal.approved',
      sourceService: 'asset-service',
      userId: user.id,
      companyId: updated.companyId,
      entityType: 'asset',
      entityId: updated.id,
      action: 'approve',
      previousValue: { status: 'disposal_requested' },
      newValue: { status: 'disposal_approved' },
    });
    await this.logEvent(updated.id, updated.companyId, 'disposal_approved', `Disposal approved`, { inspectionNotes: dto.inspectionNotes ?? null }, user.id);
    return toResource(updated);
  }

  // POST /assets/{id}/dispose — "Disposal Executed" + "Asset Record Closed".
  // Posts a full derecognition entry: credit the Fixed Assets account for
  // the original cost, debit Accumulated Depreciation for what's been taken
  // so far, debit the proceeds account for anything received, and plug the
  // difference to a gain/loss account (credit if a gain, debit if a loss) —
  // balanced by construction, the same way Expense's pay() is.
  async dispose(user: AuthenticatedUser, id: string, dto: DisposeAssetDto) {
    const asset = await this.findOrThrow(id);
    if (!isCompanyInScope(user, asset.companyId, GROUP_PERM)) {
      throw new NotFoundAppException('Asset not found.');
    }
    if (asset.status !== 'disposal_approved') {
      throw new ConflictAppException(`Cannot dispose of an asset with status "${asset.status}" — it must be disposal-approved first.`);
    }
    if (!asset.assetAccountId) {
      throw new ConflictAppException('This asset has no Fixed Assets account configured.');
    }

    await this.assertAccount(asset.companyId, dto.proceedsAccountId, 'asset', 'proceedsAccountId');
    const gainLossAccount = await this.prisma.account.findUnique({ where: { id: dto.gainLossAccountId } });
    if (!gainLossAccount || gainLossAccount.companyId !== asset.companyId) {
      throw new NotFoundAppException('Gain/loss account not found for this company.');
    }

    const period = await this.prisma.financialPeriod.findUnique({ where: { id: dto.financialPeriodId } });
    if (!period || period.companyId !== asset.companyId) {
      throw new NotFoundAppException('Financial period not found for this company.');
    }
    if (period.status === 'closed') {
      throw new ConflictAppException(`Cannot post into "${period.periodName}" — this financial period is closed.`);
    }

    const purchaseCost = Number(asset.purchaseCost);
    const accumulatedDepreciation = Number(asset.accumulatedDepreciation);
    const netBookValue = purchaseCost - accumulatedDepreciation;
    const gainLoss = dto.disposalProceeds - netBookValue;

    const items: { accountId: string; debitAmount: number; creditAmount: number; description: string }[] = [];
    if (accumulatedDepreciation > 0) {
      items.push({ accountId: asset.accumulatedDepreciationAccountId ?? asset.assetAccountId, debitAmount: accumulatedDepreciation, creditAmount: 0, description: 'Accumulated depreciation written off' });
    }
    if (dto.disposalProceeds > 0) {
      items.push({ accountId: dto.proceedsAccountId, debitAmount: dto.disposalProceeds, creditAmount: 0, description: 'Disposal proceeds' });
    }
    if (Math.abs(gainLoss) > 0.001) {
      if (gainLoss > 0) {
        items.push({ accountId: dto.gainLossAccountId, debitAmount: 0, creditAmount: gainLoss, description: 'Gain on disposal' });
      } else {
        items.push({ accountId: dto.gainLossAccountId, debitAmount: -gainLoss, creditAmount: 0, description: 'Loss on disposal' });
      }
    }
    items.push({ accountId: asset.assetAccountId, debitAmount: 0, creditAmount: purchaseCost, description: 'Fixed asset written off' });

    const entryCount = await this.prisma.journalEntry.count({ where: { companyId: asset.companyId } });
    const entryNumber = `JE-${new Date().getFullYear()}-${String(entryCount + 1).padStart(4, '0')}`;

    const updated = await this.prisma.$transaction(async (tx) => {
      const journalEntry = await tx.journalEntry.create({
        data: {
          companyId: asset.companyId,
          entryNumber,
          entryDate: new Date(dto.entryDate),
          description: `Disposal — ${asset.assetNumber} ${asset.name} (${dto.disposalMethod})`,
          financialPeriodId: dto.financialPeriodId,
          status: 'posted',
          createdBy: user.id,
          postedAt: new Date(),
          items: { create: items },
        },
      });
      return tx.asset.update({
        where: { id },
        data: {
          status: 'disposed',
          disposalMethod: dto.disposalMethod as any,
          disposalProceeds: dto.disposalProceeds,
          disposedAt: new Date(),
          disposalJournalEntryId: journalEntry.id,
        },
      });
    });

    await this.auditService.record({
      eventType: 'asset.disposed',
      sourceService: 'asset-service',
      userId: user.id,
      companyId: updated.companyId,
      entityType: 'asset',
      entityId: updated.id,
      action: 'approve',
      previousValue: { status: 'disposal_approved' },
      newValue: { status: 'disposed', disposalMethod: dto.disposalMethod, gainLoss: gainLoss.toFixed(2), journalEntryId: updated.disposalJournalEntryId },
    });
    if (updated.disposalRequestedBy) {
      await this.notificationsService.notifyUsers([updated.disposalRequestedBy], {
        companyId: updated.companyId,
        type: 'asset.disposed',
        title: `Disposal completed — ${updated.assetNumber} ${updated.name}`,
        entityType: 'asset',
        entityId: updated.id,
      });
    }
    await this.logEvent(
      updated.id,
      updated.companyId,
      'disposed',
      `Disposed (${dto.disposalMethod}) — ${gainLoss >= 0 ? 'gain' : 'loss'} ${Math.abs(gainLoss).toFixed(2)}`,
      { disposalMethod: dto.disposalMethod, disposalProceeds: dto.disposalProceeds, gainLoss: gainLoss.toFixed(2), journalEntryId: updated.disposalJournalEntryId },
      user.id,
    );
    return toResource(updated);
  }

  // POST /assets/{id}/maintenance-records — FR-ASSET-05. Cost + both
  // accounts + a period are all optional: a maintenance record can be
  // logged with no financial impact at all (e.g. a routine inspection),
  // matching morise.docx's "Asset maintenance"/"Asset history" bullets,
  // which describe a log, not necessarily a cost.
  async addMaintenanceRecord(user: AuthenticatedUser, id: string, dto: CreateMaintenanceRecordDto) {
    const asset = await this.findOrThrow(id);
    if (!isCompanyInScope(user, asset.companyId, GROUP_PERM)) {
      throw new NotFoundAppException('Asset not found.');
    }

    let journalEntryId: string | undefined;
    if (dto.cost && dto.expenseAccountId && dto.paymentAccountId && dto.financialPeriodId && dto.entryDate) {
      await this.assertAccount(asset.companyId, dto.expenseAccountId, 'expense', 'expenseAccountId');
      await this.assertAccount(asset.companyId, dto.paymentAccountId, 'asset', 'paymentAccountId');
      const period = await this.prisma.financialPeriod.findUnique({ where: { id: dto.financialPeriodId } });
      if (!period || period.companyId !== asset.companyId) {
        throw new NotFoundAppException('Financial period not found for this company.');
      }
      if (period.status === 'closed') {
        throw new ConflictAppException(`Cannot post into "${period.periodName}" — this financial period is closed.`);
      }
      const entryCount = await this.prisma.journalEntry.count({ where: { companyId: asset.companyId } });
      const entryNumber = `JE-${new Date().getFullYear()}-${String(entryCount + 1).padStart(4, '0')}`;
      const journalEntry = await this.prisma.journalEntry.create({
        data: {
          companyId: asset.companyId,
          entryNumber,
          entryDate: new Date(dto.entryDate),
          description: `Maintenance — ${asset.assetNumber} ${asset.name}`,
          financialPeriodId: dto.financialPeriodId,
          status: 'posted',
          createdBy: user.id,
          postedAt: new Date(),
          items: {
            create: [
              { accountId: dto.expenseAccountId, debitAmount: dto.cost, creditAmount: 0, description: 'Maintenance expense' },
              { accountId: dto.paymentAccountId, debitAmount: 0, creditAmount: dto.cost, description: 'Maintenance payment' },
            ],
          },
        },
      });
      journalEntryId = journalEntry.id;
    }

    const record = await this.prisma.assetMaintenanceRecord.create({
      data: {
        assetId: id,
        maintenanceDate: new Date(dto.maintenanceDate),
        description: dto.description,
        cost: dto.cost,
        performedBy: user.id,
        journalEntryId,
      },
    });
    await this.auditService.record({
      eventType: 'asset.maintenance.recorded',
      sourceService: 'asset-service',
      userId: user.id,
      companyId: asset.companyId,
      entityType: 'asset',
      entityId: asset.id,
      action: 'create',
      newValue: { description: dto.description, cost: dto.cost, journalEntryId },
    });
    await this.logEvent(
      asset.id,
      asset.companyId,
      'maintenance',
      `Maintenance logged — ${dto.description}`.slice(0, 250),
      { cost: dto.cost ?? null, journalEntryId: journalEntryId ?? null, maintenanceDate: dto.maintenanceDate },
      user.id,
    );
    return toMaintenanceResource(record);
  }

  // GET /assets/{id}/maintenance-records
  async listMaintenanceRecords(user: AuthenticatedUser, id: string) {
    const asset = await this.findOrThrow(id);
    if (!isCompanyInScope(user, asset.companyId, GROUP_PERM)) {
      throw new NotFoundAppException('Asset not found.');
    }
    const rows = await this.prisma.assetMaintenanceRecord.findMany({
      where: { assetId: id },
      orderBy: { maintenanceDate: 'desc' },
    });
    return rows.map(toMaintenanceResource);
  }

  // ==================== Asset Management (2 September 2026) ====================

  private catResource(c: any) {
    return {
      id: c.id,
      companyId: c.companyId,
      code: c.code,
      name: c.name,
      defaultDepreciationMethod: c.defaultDepreciationMethod,
      defaultUsefulLifeYears: c.defaultUsefulLifeYears,
      defaultSalvagePercent: c.defaultSalvagePercent != null ? Number(c.defaultSalvagePercent) : null,
      note: c.note,
      isActive: c.isActive,
      assetCount: c._count?.assets,
    };
  }

  private companyFilter(user: AuthenticatedUser, companyId?: string) {
    if (hasGroupVisibility(user, GROUP_PERM)) return companyId ? { companyId } : {};
    const scoped = user.scopes.map((s) => s.companyId);
    return {
      companyId:
        companyId && scoped.includes(companyId)
          ? companyId
          : { in: scoped.length > 0 ? scoped : ['__none__'] },
    };
  }

  // GET /assets/categories
  async listCategories(user: AuthenticatedUser, companyId?: string) {
    const rows = await this.prisma.assetCategory.findMany({
      where: { ...this.companyFilter(user, companyId) } as any,
      include: { _count: { select: { assets: true } } },
      orderBy: { code: 'asc' },
    });
    return rows.map((c) => this.catResource(c));
  }

  // POST /assets/categories
  async createCategory(user: AuthenticatedUser, dto: CreateAssetCategoryDto) {
    if (!isCompanyInScope(user, dto.companyId, GROUP_PERM)) {
      throw new NotFoundAppException('Company not found.');
    }
    const code = dto.code.trim().toUpperCase();
    const clash = await this.prisma.assetCategory.findUnique({
      where: { companyId_code: { companyId: dto.companyId, code } },
    });
    if (clash) throw new ConflictAppException(`Category code ${code} is already in use.`);
    const created = await this.prisma.assetCategory.create({
      data: {
        companyId: dto.companyId,
        code,
        name: dto.name.trim(),
        defaultDepreciationMethod: (dto.defaultDepreciationMethod as any) ?? 'none',
        defaultUsefulLifeYears: dto.defaultUsefulLifeYears ?? null,
        defaultSalvagePercent: dto.defaultSalvagePercent ?? null,
        note: dto.note ?? null,
      },
      include: { _count: { select: { assets: true } } },
    });
    await this.auditService.record({
      eventType: 'asset.category.created',
      sourceService: 'asset-service',
      userId: user.id,
      companyId: dto.companyId,
      entityType: 'asset_category',
      entityId: created.id,
      action: 'create',
      newValue: { code: created.code, name: created.name },
    });
    return this.catResource(created);
  }

  // PATCH /assets/categories/:id
  async updateCategory(user: AuthenticatedUser, id: string, dto: UpdateAssetCategoryDto) {
    const cat = await this.prisma.assetCategory.findUnique({ where: { id } });
    if (!cat || !isCompanyInScope(user, cat.companyId, GROUP_PERM)) {
      throw new NotFoundAppException('Asset category not found.');
    }
    const data: any = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.defaultDepreciationMethod !== undefined) data.defaultDepreciationMethod = dto.defaultDepreciationMethod;
    if ('defaultUsefulLifeYears' in dto) data.defaultUsefulLifeYears = dto.defaultUsefulLifeYears ?? null;
    if ('defaultSalvagePercent' in dto) data.defaultSalvagePercent = dto.defaultSalvagePercent ?? null;
    if (dto.note !== undefined) data.note = dto.note;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    const updated = await this.prisma.assetCategory.update({
      where: { id },
      data,
      include: { _count: { select: { assets: true } } },
    });
    await this.auditService.record({
      eventType: 'asset.category.updated',
      sourceService: 'asset-service',
      userId: user.id,
      companyId: cat.companyId,
      entityType: 'asset_category',
      entityId: id,
      action: 'update',
      newValue: { name: updated.name, isActive: updated.isActive },
    });
    return this.catResource(updated);
  }

  // GET /assets/:id/inspections
  async listInspections(user: AuthenticatedUser, assetId: string) {
    const asset = await this.findOrThrow(assetId);
    if (!isCompanyInScope(user, asset.companyId, GROUP_PERM)) throw new NotFoundAppException('Asset not found.');
    return this.prisma.assetInspection.findMany({
      where: { assetId },
      orderBy: { inspectionDate: 'desc' },
    });
  }

  // POST /assets/:id/inspections
  async addInspection(user: AuthenticatedUser, assetId: string, dto: CreateAssetInspectionDto) {
    const asset = await this.findOrThrow(assetId);
    if (!isCompanyInScope(user, asset.companyId, GROUP_PERM)) throw new NotFoundAppException('Asset not found.');
    if (dto.inspectorEmployeeId) {
      const e = await this.prisma.employee.findUnique({ where: { id: dto.inspectorEmployeeId } });
      if (!e || e.companyId !== asset.companyId) throw new NotFoundAppException('Inspector employee not found.');
    }
    const created = await this.prisma.assetInspection.create({
      data: {
        assetId,
        inspectionDate: new Date(dto.inspectionDate),
        inspectorEmployeeId: dto.inspectorEmployeeId ?? null,
        condition: dto.condition as any,
        findings: dto.findings ?? null,
        actionRequired: dto.actionRequired ?? null,
        nextInspectionDate: dto.nextInspectionDate ? new Date(dto.nextInspectionDate) : null,
        createdBy: user.id,
      },
    });
    await this.auditService.record({
      eventType: 'asset.inspection.recorded',
      sourceService: 'asset-service',
      userId: user.id,
      companyId: asset.companyId,
      entityType: 'asset',
      entityId: asset.id,
      action: 'create',
      newValue: { condition: dto.condition, nextInspectionDate: dto.nextInspectionDate ?? null },
    });
    await this.logEvent(
      asset.id,
      asset.companyId,
      'inspection',
      `Inspection — condition ${dto.condition}`,
      { condition: dto.condition, actionRequired: dto.actionRequired ?? null, nextInspectionDate: dto.nextInspectionDate ?? null },
      user.id,
    );
    return created;
  }

  // GET /assets/:id/insurance
  async listInsurance(user: AuthenticatedUser, assetId: string) {
    const asset = await this.findOrThrow(assetId);
    if (!isCompanyInScope(user, asset.companyId, GROUP_PERM)) throw new NotFoundAppException('Asset not found.');
    const rows = await this.prisma.assetInsurancePolicy.findMany({
      where: { assetId },
      orderBy: { endDate: 'desc' },
    });
    return rows.map((p) => ({
      ...p,
      coverageAmount: Number(p.coverageAmount).toFixed(2),
      premium: p.premium != null ? Number(p.premium).toFixed(2) : null,
    }));
  }

  // POST /assets/:id/insurance
  async addInsurance(user: AuthenticatedUser, assetId: string, dto: CreateAssetInsuranceDto) {
    const asset = await this.findOrThrow(assetId);
    if (!isCompanyInScope(user, asset.companyId, GROUP_PERM)) throw new NotFoundAppException('Asset not found.');
    if (new Date(dto.endDate) < new Date(dto.startDate)) {
      throw new ConflictAppException('Policy end date is before its start date.');
    }
    const created = await this.prisma.assetInsurancePolicy.create({
      data: {
        assetId,
        insurer: dto.insurer.trim(),
        policyNumber: dto.policyNumber.trim(),
        coverageAmount: dto.coverageAmount,
        premium: dto.premium ?? null,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        note: dto.note ?? null,
        createdBy: user.id,
      },
    });
    // Keep the legacy inline fields in step with the latest active policy.
    await this.prisma.asset.update({
      where: { id: assetId },
      data: {
        insurer: dto.insurer.trim(),
        insurancePolicyNumber: dto.policyNumber.trim(),
        insuranceExpiryDate: new Date(dto.endDate),
      },
    });
    await this.auditService.record({
      eventType: 'asset.insurance.added',
      sourceService: 'asset-service',
      userId: user.id,
      companyId: asset.companyId,
      entityType: 'asset',
      entityId: asset.id,
      action: 'create',
      newValue: { insurer: dto.insurer, policyNumber: dto.policyNumber, endDate: dto.endDate },
    });
    await this.logEvent(
      asset.id,
      asset.companyId,
      'insurance_added',
      `Insurance policy ${dto.policyNumber} (${dto.insurer})`,
      { coverageAmount: dto.coverageAmount, startDate: dto.startDate, endDate: dto.endDate },
      user.id,
    );
    return { ...created, coverageAmount: Number(created.coverageAmount).toFixed(2) };
  }

  // PATCH /assets/insurance/:policyId
  async updateInsurance(user: AuthenticatedUser, policyId: string, dto: UpdateAssetInsuranceDto) {
    const policy = await this.prisma.assetInsurancePolicy.findUnique({
      where: { id: policyId },
      include: { asset: true },
    });
    if (!policy || !isCompanyInScope(user, policy.asset.companyId, GROUP_PERM)) {
      throw new NotFoundAppException('Insurance policy not found.');
    }
    const data: any = {};
    for (const k of ['insurer', 'policyNumber', 'note', 'status'] as const) {
      if (dto[k] !== undefined) data[k] = k === 'status' ? (dto[k] as any) : dto[k];
    }
    if (dto.coverageAmount !== undefined) data.coverageAmount = dto.coverageAmount;
    if (dto.premium !== undefined) data.premium = dto.premium;
    if (dto.startDate) data.startDate = new Date(dto.startDate);
    if (dto.endDate) data.endDate = new Date(dto.endDate);
    const updated = await this.prisma.assetInsurancePolicy.update({ where: { id: policyId }, data });
    await this.auditService.record({
      eventType: 'asset.insurance.updated',
      sourceService: 'asset-service',
      userId: user.id,
      companyId: policy.asset.companyId,
      entityType: 'asset',
      entityId: policy.assetId,
      action: 'update',
      newValue: { status: updated.status, endDate: updated.endDate },
    });
    await this.logEvent(policy.assetId, policy.asset.companyId, 'insurance_updated', `Insurance policy ${updated.policyNumber} updated`, { status: updated.status }, user.id);
    return { ...updated, coverageAmount: Number(updated.coverageAmount).toFixed(2), premium: updated.premium != null ? Number(updated.premium).toFixed(2) : null };
  }

  // GET /assets/:id/history
  async history(user: AuthenticatedUser, assetId: string) {
    const asset = await this.findOrThrow(assetId);
    if (!isCompanyInScope(user, asset.companyId, GROUP_PERM)) throw new NotFoundAppException('Asset not found.');
    const events = await this.prisma.assetEvent.findMany({
      where: { assetId },
      orderBy: { occurredAt: 'asc' },
    });
    return events.map((e) => ({
      id: e.id,
      eventType: e.eventType,
      occurredAt: e.occurredAt,
      summary: e.summary,
      detail: e.detail ?? null,
      createdBy: e.createdBy,
    }));
  }

  // ---- Reports ---------------------------------------------------
  private annualCharge(a: any) {
    if (a.depreciationMethod !== 'straight_line' || !a.usefulLifeYears) return 0;
    const depreciable = Number(a.purchaseCost) - Number(a.salvageValue ?? 0);
    return Math.max(0, depreciable) / a.usefulLifeYears;
  }

  // GET /assets/reports/register
  async reportRegister(user: AuthenticatedUser, companyId?: string) {
    const rows = await this.prisma.asset.findMany({
      where: { ...this.companyFilter(user, companyId), status: { not: 'disposed' } } as any,
      include: { assetCategory: true, supplier: true },
      orderBy: { assetNumber: 'asc' },
      take: 5000,
    });
    const lines = rows.map((a) => {
      const cost = Number(a.purchaseCost);
      const acc = Number(a.accumulatedDepreciation);
      return {
        assetId: a.id,
        assetNumber: a.assetNumber,
        name: a.name,
        categoryName: a.assetCategory?.name ?? a.category ?? null,
        custodianEmployeeId: a.custodianEmployeeId,
        branchId: a.branchId,
        supplierName: a.supplier?.name ?? null,
        purchaseDate: a.purchaseDate,
        purchaseCost: cost.toFixed(2),
        accumulatedDepreciation: acc.toFixed(2),
        netBookValue: (cost - acc).toFixed(2),
        status: a.status,
      };
    });
    return {
      lines,
      totals: {
        assets: lines.length,
        purchaseCost: lines.reduce((s, l) => s + Number(l.purchaseCost), 0).toFixed(2),
        accumulatedDepreciation: lines.reduce((s, l) => s + Number(l.accumulatedDepreciation), 0).toFixed(2),
        netBookValue: lines.reduce((s, l) => s + Number(l.netBookValue), 0).toFixed(2),
      },
    };
  }

  // GET /assets/reports/depreciation-schedule
  async reportDepreciationSchedule(user: AuthenticatedUser, companyId?: string) {
    const rows = await this.prisma.asset.findMany({
      where: { ...this.companyFilter(user, companyId), status: 'active', depreciationMethod: 'straight_line' } as any,
      include: { assetCategory: true },
      orderBy: { assetNumber: 'asc' },
      take: 5000,
    });
    const lines = rows.map((a) => {
      const cost = Number(a.purchaseCost);
      const acc = Number(a.accumulatedDepreciation);
      const salvage = Number(a.salvageValue ?? 0);
      const annual = this.annualCharge(a);
      const remainingDepreciable = Math.max(0, cost - salvage - acc);
      return {
        assetId: a.id,
        assetNumber: a.assetNumber,
        name: a.name,
        categoryName: a.assetCategory?.name ?? a.category ?? null,
        purchaseCost: cost.toFixed(2),
        salvageValue: salvage.toFixed(2),
        usefulLifeYears: a.usefulLifeYears,
        annualCharge: annual.toFixed(2),
        accumulatedDepreciation: acc.toFixed(2),
        netBookValue: (cost - acc).toFixed(2),
        remainingDepreciable: remainingDepreciable.toFixed(2),
        yearsRemaining: annual > 0 ? Number((remainingDepreciable / annual).toFixed(2)) : null,
      };
    });
    return {
      lines,
      totals: {
        assets: lines.length,
        annualCharge: lines.reduce((s, l) => s + Number(l.annualCharge), 0).toFixed(2),
      },
    };
  }

  // GET /assets/reports/insurance-expiring
  async reportInsuranceExpiring(user: AuthenticatedUser, companyId?: string, days = 60) {
    const window = Math.min(Math.max(days, 0), 3650);
    const cutoff = new Date();
    cutoff.setHours(23, 59, 59, 999);
    cutoff.setDate(cutoff.getDate() + window);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const assets = await this.prisma.asset.findMany({
      where: { ...this.companyFilter(user, companyId) } as any,
      select: { id: true, assetNumber: true, name: true },
    });
    const assetById = new Map(assets.map((a) => [a.id, a]));
    const policies = await this.prisma.assetInsurancePolicy.findMany({
      where: { assetId: { in: assets.map((a) => a.id) }, status: 'active', endDate: { lte: cutoff } },
      orderBy: { endDate: 'asc' },
    });
    return {
      windowDays: window,
      cutoff,
      policies: policies.map((p) => ({
        id: p.id,
        assetId: p.assetId,
        assetNumber: assetById.get(p.assetId)?.assetNumber ?? null,
        assetName: assetById.get(p.assetId)?.name ?? null,
        insurer: p.insurer,
        policyNumber: p.policyNumber,
        coverageAmount: Number(p.coverageAmount).toFixed(2),
        endDate: p.endDate,
        expired: new Date(p.endDate) < today,
      })),
    };
  }

  // GET /assets/reports/inspections-due
  async reportInspectionsDue(user: AuthenticatedUser, companyId?: string, days = 30) {
    const window = Math.min(Math.max(days, 0), 3650);
    const cutoff = new Date();
    cutoff.setHours(23, 59, 59, 999);
    cutoff.setDate(cutoff.getDate() + window);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const assets = await this.prisma.asset.findMany({
      where: { ...this.companyFilter(user, companyId), status: { not: 'disposed' } } as any,
      select: { id: true, assetNumber: true, name: true },
    });
    const assetById = new Map(assets.map((a) => [a.id, a]));
    // latest inspection per asset with a nextInspectionDate on/before the cutoff
    const inspections = await this.prisma.assetInspection.findMany({
      where: { assetId: { in: assets.map((a) => a.id) }, nextInspectionDate: { not: null, lte: cutoff } },
      orderBy: { inspectionDate: 'desc' },
    });
    const seen = new Set<string>();
    const due: any[] = [];
    for (const i of inspections) {
      if (seen.has(i.assetId)) continue;
      seen.add(i.assetId);
      due.push({
        assetId: i.assetId,
        assetNumber: assetById.get(i.assetId)?.assetNumber ?? null,
        assetName: assetById.get(i.assetId)?.name ?? null,
        lastInspectionDate: i.inspectionDate,
        lastCondition: i.condition,
        nextInspectionDate: i.nextInspectionDate,
        overdue: i.nextInspectionDate ? new Date(i.nextInspectionDate) < today : false,
      });
    }
    return { windowDays: window, cutoff, due };
  }

  private async assertAccount(companyId: string, accountId: string, expectedType: string, field: string) {
    const account = await this.prisma.account.findUnique({ where: { id: accountId } });
    if (!account || account.companyId !== companyId || account.accountType !== expectedType) {
      throw new NotFoundAppException(`${field}: account not found for this company or wrong type (expected ${expectedType}).`);
    }
  }

  private async findOrThrow(id: string) {
    const asset = await this.prisma.asset.findUnique({
      where: { id },
      include: { assetCategory: true, supplier: true },
    });
    if (!asset) throw new NotFoundAppException('Asset not found.');
    return asset;
  }

  // Append-only asset-history row. Written from every lifecycle action so
  // GET /assets/:id/history is a single chronological read.
  private async logEvent(
    assetId: string,
    companyId: string,
    eventType: string,
    summary: string,
    detail: any,
    userId: string,
  ) {
    await this.prisma.assetEvent.create({
      data: { assetId, companyId, eventType: eventType as any, summary, detail: detail ?? undefined, createdBy: userId },
    });
  }
}
