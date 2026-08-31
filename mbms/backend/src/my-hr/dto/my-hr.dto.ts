import { Type } from 'class-transformer';
import { IsInt, IsNumberString, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class RequestMyAdvanceDto {
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
