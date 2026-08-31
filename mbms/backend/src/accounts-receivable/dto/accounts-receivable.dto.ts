import { Type } from 'class-transformer';
import { IsDateString, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreateCustomerCreditNoteDto {
  @IsUUID()
  companyId: string;

  @IsUUID()
  customerId: string;

  @IsDateString()
  creditDate: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsUUID()
  appliedToInvoiceId?: string; // an id from the existing invoices table (Customer Storefront)

  @IsUUID()
  offsetAccountId: string; // revenue account this credit reduces

  @IsUUID()
  financialPeriodId: string;
}

export class CreateCustomerDebitNoteDto {
  @IsUUID()
  companyId: string;

  @IsUUID()
  customerId: string;

  @IsDateString()
  debitDate: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsUUID()
  offsetAccountId: string; // account credited for the increase (e.g. an "Other Income" or adjustment account)

  @IsUUID()
  financialPeriodId: string;
}
