import { IsDateString, IsEmail, IsOptional, IsString, IsUUID } from 'class-validator';

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
