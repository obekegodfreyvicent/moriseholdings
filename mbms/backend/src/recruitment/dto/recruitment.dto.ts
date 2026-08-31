import { IsDateString, IsEmail, IsIn, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreateVacancyDto {
  @IsUUID()
  companyId: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  employmentType?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  numberOfPositions?: number;

  @IsOptional()
  @IsDateString()
  closingDate?: string;
}

export class UpdateVacancyDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  employmentType?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  numberOfPositions?: number;

  @IsOptional()
  @IsDateString()
  closingDate?: string;
}

export class CreateApplicationDto {
  @IsString()
  applicantName: string;

  @IsEmail()
  applicantEmail: string;

  @IsOptional()
  @IsString()
  applicantPhone?: string;

  @IsOptional()
  @IsString()
  cvReference?: string;

  @IsOptional()
  @IsString()
  coverNote?: string;
}

export class RejectApplicationDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

export class CreateInterviewDto {
  @IsDateString()
  scheduledAt: string;

  @IsOptional()
  @IsUUID()
  interviewerEmployeeId?: string;

  @IsOptional()
  @IsString()
  mode?: string;
}

export class CompleteInterviewDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  score?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateOfferDto {
  @IsInt()
  @Min(0)
  offeredSalary: number;

  @IsString()
  currency: string;

  @IsDateString()
  proposedStartDate: string;
}

export class RespondOfferDto {
  @IsIn(['accepted', 'declined'])
  status: 'accepted' | 'declined';
}
