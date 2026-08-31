import { Type } from 'class-transformer';
import { IsDateString, IsNumber, IsOptional, IsPositive, IsString, IsUUID, Length } from 'class-validator';

export class CreateExpenseDto {
  @IsUUID()
  companyId: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  // Sprint 12: optional attribution to a project — feeds its actual-cost/
  // profitability figures once this claim is paid.
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  amount: number;

  @IsString()
  @Length(3, 3)
  currency: string;

  @IsDateString()
  expenseDate: string;

  // FR-EXP-02: a reference/number for the receipt — actual receipt image/
  // file upload remains deferred pending object storage infrastructure, the
  // same honest gap already noted for Company logos and Supplier contracts.
  @IsOptional()
  @IsString()
  receiptReference?: string;

  @IsUUID()
  expenseAccountId: string;
}

export class RejectExpenseDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

export class PayExpenseDto {
  @IsUUID()
  paymentAccountId: string;

  @IsUUID()
  financialPeriodId: string;
}
