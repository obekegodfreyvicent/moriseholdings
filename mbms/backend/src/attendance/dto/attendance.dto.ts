import { IsDateString, IsInt, IsOptional, IsString, IsUUID, Matches, Min } from 'class-validator';

export class ClockDto {
  // Omitted -> the caller's own linked Employee record (Employee.userId).
  // Provided -> requires attendance.manage, recording on someone else's
  // behalf (most seeded employees have no login at all).
  @IsOptional()
  @IsUUID()
  employeeId?: string;
}

export class MarkAbsentDto {
  @IsUUID()
  employeeId: string;

  @IsDateString()
  date: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateShiftDto {
  @IsUUID()
  companyId: string;

  @IsString()
  name: string;

  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'startTime must be HH:MM (24h)' })
  startTime: string;

  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'endTime must be HH:MM (24h)' })
  endTime: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  graceMinutes?: number;
}

export class AssignShiftDto {
  @IsOptional()
  @IsUUID()
  shiftId?: string; // omitted/null -> unassign
}
