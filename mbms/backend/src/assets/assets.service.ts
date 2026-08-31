import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConflictAppException, NotFoundAppException } from '../common/app-exception';
import { Paginated } from '../common/interceptors/response.interceptor';
import { AuthenticatedUser } from '../common/strategies/jwt.strategy';
import { hasGroupVisibility, isCompanyInScope } from '../common/scope.util';
import {
  ApproveDisposalDto,
  CreateAssetDto,
  CreateMaintenanceRecordDto,
  DisposeAssetDto,
  RecordDepreciationDto,
  RequestDisposalDto,
  TransferAssetDto,
  UpdateAssetDto,
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

    const asset = await this.prisma.asset.create({
      data: {
        companyId: dto.companyId,
        branchId: dto.branchId,
        departmentId: dto.departmentId,
        assetNumber: dto.assetNumber,
        name: dto.name,
        category: dto.category,
        description: dto.description,
        custodianEmployeeId: dto.custodianEmployeeId,
        purchaseDate: new Date(dto.purchaseDate),
        purchaseCost: dto.purchaseCost,
        depreciationMethod: (dto.depreciationMethod as any) ?? 'none',
        usefulLifeYears: dto.usefulLifeYears,
        salvageValue: dto.salvageValue ?? 0,
        assetAccountId: dto.assetAccountId,
        depreciationExpenseAccountId: dto.depreciationExpenseAccountId,
        accumulatedDepreciationAccountId: dto.accumulatedDepreciationAccountId,
        insurer: dto.insurer,
        insurancePolicyNumber: dto.insurancePolicyNumber,
        insuranceExpiryDate: dto.insuranceExpiryDate ? new Date(dto.insuranceExpiryDate) : undefined,
        documentReference: dto.documentReference,
      },
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
    const updated = await this.prisma.asset.update({
      where: { id },
      data: {
        ...dto,
        insuranceExpiryDate: dto.insuranceExpiryDate ? new Date(dto.insuranceExpiryDate) : undefined,
      },
    });
    await this.auditService.record({
      eventType: 'asset.record.updated',
      sourceService: 'asset-service',
      userId: user.id,
      companyId: updated.companyId,
      entityType: 'asset',
      entityId: updated.id,
      action: 'update',
      previousValue: { category: asset.category },
      newValue: { category: updated.category },
    });
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

  private async assertAccount(companyId: string, accountId: string, expectedType: string, field: string) {
    const account = await this.prisma.account.findUnique({ where: { id: accountId } });
    if (!account || account.companyId !== companyId || account.accountType !== expectedType) {
      throw new NotFoundAppException(`${field}: account not found for this company or wrong type (expected ${expectedType}).`);
    }
  }

  private async findOrThrow(id: string) {
    const asset = await this.prisma.asset.findUnique({ where: { id } });
    if (!asset) throw new NotFoundAppException('Asset not found.');
    return asset;
  }
}
