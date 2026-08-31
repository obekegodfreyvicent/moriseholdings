import { IsBoolean, IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

const ACCOUNT_TYPES = ['asset', 'liability', 'equity', 'revenue', 'expense'];

export class CreateAccountDto {
  @IsUUID()
  companyId: string;

  @IsString()
  accountCode: string;

  @IsString()
  accountName: string;

  @IsIn(ACCOUNT_TYPES)
  accountType: string;

  @IsOptional()
  @IsUUID()
  parentAccountId?: string;
}

export class UpdateAccountDto {
  @IsOptional()
  @IsString()
  accountName?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
