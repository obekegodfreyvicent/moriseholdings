import { IsDateString, IsEmail, IsIn, IsNumber, IsOptional, IsString, IsUUID, IsUrl, Length, Max, Min } from 'class-validator';

export class CreateCompanyDto {
  @IsOptional()
  @IsUUID()
  parentCompanyId?: string;

  // FR-COMP-03: required whenever parentCompanyId is set — the root holding
  // company (no parent) has no relationship type. Enforced in the service,
  // not here, since it depends on parentCompanyId's value.
  @IsOptional()
  @IsIn(['subsidiary', 'associate'])
  relationshipType?: 'subsidiary' | 'associate';

  // FR-COMP-05: percentage of this company owned by its parent.
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  ownershipPercent?: number;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  registrationNumber?: string;

  @IsOptional()
  @IsString()
  taxId?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;

  @IsOptional()
  @IsUrl()
  logoUrl?: string;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @IsDateString()
  financialYearStart: string;
}

export class UpdateCompanyDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsIn(['subsidiary', 'associate'])
  relationshipType?: 'subsidiary' | 'associate';

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  ownershipPercent?: number;

  @IsOptional()
  @IsString()
  registrationNumber?: string;

  @IsOptional()
  @IsString()
  taxId?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;

  @IsOptional()
  @IsUrl()
  logoUrl?: string;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @IsOptional()
  @IsDateString()
  financialYearStart?: string;

  @IsOptional()
  @IsIn(['active', 'inactive'])
  status?: 'active' | 'inactive';
}
