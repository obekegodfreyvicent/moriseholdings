import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
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

  @IsString()
  assetNumber: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUUID()
  custodianEmployeeId?: string;

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
  @IsString()
  description?: string;

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
