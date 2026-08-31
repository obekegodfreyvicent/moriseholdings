import { IsBoolean, IsDateString, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class CreateCycleDto {
  @IsUUID()
  companyId: string;

  @IsString()
  name: string;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;
}

export class CreateObjectiveDto {
  @IsUUID()
  cycleId: string;

  @IsUUID()
  employeeId: string;

  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  weight?: number;

  @IsOptional()
  @IsString()
  targetValue?: string;
}

export class SetObjectiveStatusDto {
  @IsIn(['achieved', 'not_achieved'])
  status: 'achieved' | 'not_achieved';
}

export class CreateReviewDto {
  @IsUUID()
  cycleId: string;

  @IsUUID()
  employeeId: string;

  @IsOptional()
  @IsUUID()
  managerEmployeeId?: string;
}

export class SubmitSelfAssessmentDto {
  @IsString()
  selfAssessment: string;
}

export class SubmitManagerAssessmentDto {
  @IsString()
  managerAssessment: string;

  @IsInt()
  @Min(1)
  @Max(5)
  managerRating: number;

  @IsOptional()
  @IsBoolean()
  promotionRecommended?: boolean;

  @IsOptional()
  @IsString()
  trainingRecommendation?: string;
}
