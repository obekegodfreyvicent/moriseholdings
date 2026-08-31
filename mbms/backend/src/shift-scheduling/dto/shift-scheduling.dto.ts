import { IsDateString, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateRosterEntryDto {
  @IsUUID()
  companyId: string;

  @IsUUID()
  employeeId: string;

  @IsUUID()
  shiftId: string;

  @IsDateString()
  date: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}

export class PublishRosterDto {
  @IsUUID()
  companyId: string;

  @IsDateString()
  from: string;

  @IsDateString()
  to: string;
}
