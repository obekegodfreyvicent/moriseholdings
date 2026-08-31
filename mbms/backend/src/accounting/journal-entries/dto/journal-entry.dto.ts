import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsDateString, IsIn, IsNumber, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator';

export class JournalEntryItemDto {
  @IsUUID()
  accountId: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  debitAmount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  creditAmount?: number;

  @IsOptional()
  @IsString()
  description?: string;
}

export class CreateJournalEntryDto {
  @IsUUID()
  companyId: string;

  @IsUUID()
  financialPeriodId: string;

  @IsDateString()
  entryDate: string;

  @IsOptional()
  @IsString()
  description?: string;

  // Financial Module deepening (19 August 2026), General Ledger: "Adjusting
  // entries" — a classification tag (accruals, prepayments, depreciation
  // catch-ups entered manually), not a different posting mechanism. Closing
  // entries are never set here — they're system-generated only, by
  // FinancialPeriodsService.close().
  @IsOptional()
  @IsIn(['standard', 'adjusting'])
  entryType?: 'standard' | 'adjusting';

  @IsArray()
  @ArrayMinSize(2, { message: 'A journal entry needs at least two line items.' })
  @ValidateNested({ each: true })
  @Type(() => JournalEntryItemDto)
  items: JournalEntryItemDto[];
}
