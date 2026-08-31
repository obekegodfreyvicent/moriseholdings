import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsBoolean, IsDateString, IsNumber, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator';

export class RecurringEntryItemDto {
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

export class CreateRecurringEntryDto {
  @IsUUID()
  companyId: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsArray()
  @ArrayMinSize(2, { message: 'A recurring entry template needs at least two line items.' })
  @ValidateNested({ each: true })
  @Type(() => RecurringEntryItemDto)
  items: RecurringEntryItemDto[];
}

export class UpdateRecurringEntryDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class GenerateRecurringEntryDto {
  @IsUUID()
  financialPeriodId: string;

  @IsDateString()
  entryDate: string;
}
