import { Type } from 'class-transformer';
import { IsInt, IsNumberString, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

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
