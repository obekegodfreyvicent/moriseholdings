import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsNumber, IsOptional, IsPositive, IsString, IsUUID, Length } from 'class-validator';

export class CreateInterCompanyTransactionDto {
  @IsUUID()
  fromCompanyId: string;

  @IsUUID()
  toCompanyId: string;

  @IsEnum(['loan', 'transfer', 'service_charge', 'cost_allocation', 'other'])
  transactionType: 'loan' | 'transfer' | 'service_charge' | 'cost_allocation' | 'other';

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  amount: number;

  @IsString()
  @Length(3, 3)
  currency: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsDateString()
  transactionDate: string;
}

export class PostInterCompanyTransactionDto {
  @IsUUID()
  fromAccountId: string;

  @IsUUID()
  fromClearingAccountId: string;

  @IsUUID()
  toClearingAccountId: string;

  @IsUUID()
  toAccountId: string;

  @IsUUID()
  fromFinancialPeriodId: string;

  @IsUUID()
  toFinancialPeriodId: string;
}
