import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateAssetDto {
  @IsUUID()
  companyId: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  // Asset Management (2 September 2026): optional — auto-generated as
  // AST-YYYY-NNNN when omitted.
  @IsOptional()
  @IsString()
  @MaxLength(50)
  assetNumber?: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUUID()
  custodianEmployeeId?: string;

  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  purchaseReference?: string;

  @IsOptional()
  @IsDateString()
  warrantyExpiryDate?: string;

  @IsDateString()
  purchaseDate: string;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  purchaseCost: number;

  @IsOptional()
  @IsIn(['none', 'straight_line'])
  depreciationMethod?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  usefulLifeYears?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  salvageValue?: number;

  @IsOptional()
  @IsUUID()
  assetAccountId?: string;

  @IsOptional()
  @IsUUID()
  depreciationExpenseAccountId?: string;

  @IsOptional()
  @IsUUID()
  accumulatedDepreciationAccountId?: string;

  @IsOptional()
  @IsString()
  insurer?: string;

  @IsOptional()
  @IsString()
  insurancePolicyNumber?: string;

  @IsOptional()
  @IsDateString()
  insuranceExpiryDate?: string;

  @IsOptional()
  @IsString()
  documentReference?: string;
}

export class UpdateAssetDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string | null;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string | null;

  @IsOptional()
  @IsUUID()
  departmentId?: string | null;

  @IsOptional()
  @IsUUID()
  custodianEmployeeId?: string | null;

  @IsOptional()
  @IsUUID()
  supplierId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  purchaseReference?: string;

  @IsOptional()
  @IsDateString()
  warrantyExpiryDate?: string;

  @IsOptional()
  @IsString()
  insurer?: string;

  @IsOptional()
  @IsString()
  insurancePolicyNumber?: string;

  @IsOptional()
  @IsDateString()
  insuranceExpiryDate?: string;

  @IsOptional()
  @IsString()
  documentReference?: string;
}

// ---- Asset categories ----------------------------------------------
const DEP_METHODS = ['none', 'straight_line'] as const;

export class CreateAssetCategoryDto {
  @IsUUID()
  companyId: string;

  @IsString()
  @MaxLength(30)
  code: string;

  @IsString()
  @MaxLength(120)
  name: string;

  @IsOptional()
  @IsIn(DEP_METHODS)
  defaultDepreciationMethod?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  defaultUsefulLifeYears?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  defaultSalvagePercent?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class UpdateAssetCategoryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsIn(DEP_METHODS)
  defaultDepreciationMethod?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  defaultUsefulLifeYears?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  defaultSalvagePercent?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// ---- Asset inspection --------------------------------------------
export class CreateAssetInspectionDto {
  @IsDateString()
  inspectionDate: string;

  @IsOptional()
  @IsUUID()
  inspectorEmployeeId?: string;

  @IsIn(['excellent', 'good', 'fair', 'poor', 'unserviceable'])
  condition: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  findings?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  actionRequired?: string;

  @IsOptional()
  @IsDateString()
  nextInspectionDate?: string;
}

// ---- Asset insurance policy ------------------------------------
export class CreateAssetInsuranceDto {
  @IsString()
  @MaxLength(150)
  insurer: string;

  @IsString()
  @MaxLength(100)
  policyNumber: string;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  coverageAmount: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  premium?: number;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class UpdateAssetInsuranceDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  insurer?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  policyNumber?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  coverageAmount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  premium?: number;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsIn(['active', 'expired', 'cancelled'])
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class TransferAssetDto {
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsUUID()
  custodianEmployeeId?: string;

  // morise.docx, Section 2: "Transfer or share resources between
  // companies." Optional — when supplied, the asset's companyId itself
  // changes, not just its branch/custodian. Requires asset.manage in BOTH
  // the source and destination company (checked in the service, not just
  // one).
  @IsOptional()
  @IsUUID()
  toCompanyId?: string;
}

export class RecordDepreciationDto {
  @IsUUID()
  financialPeriodId: string;

  @IsDateString()
  entryDate: string;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  amount: number;
}

export class RequestDisposalDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

export class ApproveDisposalDto {
  @IsOptional()
  @IsString()
  inspectionNotes?: string;
}

export class DisposeAssetDto {
  @IsEnum(['sale', 'write_off'])
  disposalMethod: 'sale' | 'write_off';

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  disposalProceeds: number;

  @IsUUID()
  proceedsAccountId: string;

  @IsUUID()
  gainLossAccountId: string;

  @IsUUID()
  financialPeriodId: string;

  @IsDateString()
  entryDate: string;
}

export class CreateMaintenanceRecordDto {
  @IsDateString()
  maintenanceDate: string;

  @IsString()
  description: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  cost?: number;

  @IsOptional()
  @IsUUID()
  expenseAccountId?: string;

  @IsOptional()
  @IsUUID()
  paymentAccountId?: string;

  @IsOptional()
  @IsUUID()
  financialPeriodId?: string;

  @IsOptional()
  @IsDateString()
  entryDate?: string;
}
