import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateSupplierDto {
  @IsUUID()
  companyId: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  taxId?: string;

  // FR-SUPP-02: a reference/number for the supplier's contract, plus its
  // expiry — the actual contract document upload remains deferred pending
  // object storage infrastructure, same as Company logos and Employee docs.
  @IsOptional()
  @IsString()
  contractReference?: string;

  @IsOptional()
  @IsDateString()
  contractExpiryDate?: string;

  @IsOptional()
  @IsString()
  bankName?: string;

  @IsOptional()
  @IsString()
  bankAccountNumber?: string;
}

export class UpdateSupplierDto {
  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  taxId?: string;

  @IsOptional()
  @IsString()
  contractReference?: string;

  @IsOptional()
  @IsDateString()
  contractExpiryDate?: string;

  @IsOptional()
  @IsString()
  bankName?: string;

  @IsOptional()
  @IsString()
  bankAccountNumber?: string;
}

// FR-SUPP-05: multi-contact list
export class CreateSupplierContactDto {
  @IsString()
  @MaxLength(160)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class UpdateSupplierContactDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

// FR-SUPP-04: time-bound suspension
export class SuspendSupplierDto {
  @IsString()
  @MaxLength(500)
  reason: string;

  @IsOptional()
  @IsDateString()
  until?: string;
}

// FR-SUPP-06: periodic evaluation scorecard (each criterion 1–5)
export class CreateSupplierEvaluationDto {
  @IsString()
  @MaxLength(40)
  periodLabel: string;

  @IsInt()
  @Min(1)
  @Max(5)
  deliveryScore: number;

  @IsInt()
  @Min(1)
  @Max(5)
  qualityScore: number;

  @IsInt()
  @Min(1)
  @Max(5)
  priceScore: number;

  @IsInt()
  @Min(1)
  @Max(5)
  communicationScore: number;

  @IsInt()
  @Min(1)
  @Max(5)
  complianceScore: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comments?: string;
}
