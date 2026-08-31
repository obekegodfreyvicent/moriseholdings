import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsDateString, IsNumber, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator';

export class InvoiceItemDto {
  @IsString()
  description: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  quantity?: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitPrice: number;
}

export class CreateSupplierInvoiceDto {
  @IsUUID()
  companyId: string;

  @IsUUID()
  supplierId: string;

  @IsDateString()
  invoiceDate: string;

  @IsDateString()
  dueDate: string;

  @IsString()
  currency: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  taxAmount?: number;

  @IsUUID()
  apAccountId: string;

  @IsUUID()
  expenseAccountId: string;

  @IsUUID()
  financialPeriodId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => InvoiceItemDto)
  items: InvoiceItemDto[];
}

export class RecordSupplierPaymentDto {
  @IsUUID()
  companyId: string;

  @IsUUID()
  supplierId: string;

  @IsDateString()
  paymentDate: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsString()
  currency: string;

  @IsOptional()
  @IsString()
  method?: string;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsUUID()
  bankAccountId: string;

  @IsUUID()
  invoiceId: string; // this slice applies one payment to one invoice at a time
}

export class CreateSupplierCreditNoteDto {
  @IsUUID()
  companyId: string;

  @IsUUID()
  supplierId: string;

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
  appliedToInvoiceId?: string;

  @IsUUID()
  offsetAccountId: string; // the expense/asset account this credit reduces

  @IsUUID()
  financialPeriodId: string;
}
