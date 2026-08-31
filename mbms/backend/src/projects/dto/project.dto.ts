import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreateProjectDto {
  @IsUUID()
  companyId: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsString()
  projectCode: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUUID()
  managerEmployeeId?: string;

  @IsDateString()
  startDate: string;

  @IsOptional()
  @IsDateString()
  plannedEndDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  budget?: number;
}

export class UpdateProjectDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUUID()
  managerEmployeeId?: string;

  @IsOptional()
  @IsDateString()
  plannedEndDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  budget?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  revenueAmount?: number;
}

export class AddTeamMemberDto {
  @IsUUID()
  employeeId: string;

  @IsOptional()
  @IsString()
  role?: string;
}

export class RemoveTeamMemberDto {
  @IsUUID()
  employeeId: string;
}

export class CreateTaskDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUUID()
  assignedToEmployeeId?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}

export class UpdateTaskDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUUID()
  assignedToEmployeeId?: string;

  @IsOptional()
  @IsEnum(['not_started', 'in_progress', 'done'])
  status?: 'not_started' | 'in_progress' | 'done';

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}

export class CreateMilestoneDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}
