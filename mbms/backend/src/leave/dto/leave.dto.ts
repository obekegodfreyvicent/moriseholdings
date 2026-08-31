import { IsDateString, IsIn, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';

const LEAVE_TYPES = ['annual', 'sick', 'maternity', 'paternity', 'emergency'] as const;

export class SubmitLeaveDto {
  @IsOptional()
  @IsUUID()
  employeeId?: string; // omitted -> the caller's own linked employee record

  @IsIn(LEAVE_TYPES)
  leaveType: (typeof LEAVE_TYPES)[number];

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class RejectLeaveDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

export class SetLeaveBalanceDto {
  @IsUUID()
  employeeId: string;

  @IsIn(LEAVE_TYPES)
  leaveType: (typeof LEAVE_TYPES)[number];

  @IsInt()
  @Min(0)
  year: number;

  @IsInt()
  @Min(0)
  entitledDays: number;
}
