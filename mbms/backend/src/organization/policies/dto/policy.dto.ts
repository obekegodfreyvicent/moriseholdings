import { IsDateString, IsIn, IsOptional, IsString } from 'class-validator';

export class CreatePolicyDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  policyType?: string;

  @IsOptional()
  @IsString()
  documentReference?: string;

  @IsOptional()
  @IsDateString()
  effectiveDate?: string;
}

export class UpdatePolicyDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  policyType?: string;

  @IsOptional()
  @IsString()
  documentReference?: string;

  @IsOptional()
  @IsDateString()
  effectiveDate?: string;

  @IsOptional()
  @IsIn(['active', 'inactive'])
  status?: string;
}
