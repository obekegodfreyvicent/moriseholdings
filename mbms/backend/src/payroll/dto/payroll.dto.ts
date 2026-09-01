import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsNumberString, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class CreatePayrollRunDto {
  @IsUUID()
  companyId: string;

  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  periodYear: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  periodMonth: number;
}

export class RejectDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class RequestSalaryAdvanceDto {
  @IsUUID()
  companyId: string;

  @IsUUID()
  employeeId: string;

  @IsNumberString()
  amount: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(24)
  installments: number;
}

// ---- Salary structures (basic / allowances / overtime / bonuses) ----------

export const SALARY_COMPONENT_TYPES = ['basic', 'allowance', 'overtime', 'bonus'] as const;
export type SalaryComponentTypeDto = (typeof SALARY_COMPONENT_TYPES)[number];

export class CreateSalaryComponentDto {
  @IsUUID()
  companyId: string;

  @IsUUID()
  employeeId: string;

  @IsIn(SALARY_COMPONENT_TYPES)
  type: SalaryComponentTypeDto;

  @IsString()
  @MaxLength(120)
  label: string;

  @IsNumberString()
  amount: string;

  // true (default) = applies every payroll run; false = one specific month
  // (then periodYear + periodMonth are required).
  @IsOptional()
  @IsBoolean()
  recurring?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  periodYear?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  periodMonth?: number;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}

export class UpdateSalaryComponentDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string;

  @IsOptional()
  @IsNumberString()
  amount?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}
