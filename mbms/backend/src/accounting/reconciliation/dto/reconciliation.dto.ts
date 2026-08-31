import { IsDateString, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateReconciliationDto {
  @IsUUID()
  companyId: string;

  @IsUUID()
  accountId: string;

  @IsDateString()
  asOfDate: string;

  @IsNumber()
  statementBalance: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
