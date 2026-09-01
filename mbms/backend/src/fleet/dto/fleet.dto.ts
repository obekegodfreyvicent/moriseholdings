import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

const FUEL_TYPES = ['petrol', 'diesel', 'electric', 'hybrid', 'lpg', 'cng'] as const;
const OWNERSHIP = ['owned', 'leased', 'financed', 'hired'] as const;
const VEHICLE_STATUS = ['active', 'in_service', 'off_road', 'sold', 'written_off'] as const;
const RENEWAL_TYPES = [
  'road_licence',
  'inspection_certificate',
  'psv_permit',
  'insurance',
  'road_worthiness',
  'other',
] as const;
const SEVERITY = ['minor', 'moderate', 'major', 'total_loss'] as const;
const EXPENSE_CATEGORIES = [
  'fuel',
  'service',
  'repair',
  'licence',
  'insurance',
  'tyres',
  'toll',
  'fine',
  'parking',
  'other',
] as const;

export class CreateVehicleDto {
  @IsUUID()
  companyId: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsUUID()
  assetId?: string;

  @IsString()
  @MaxLength(30)
  registrationNumber: string;

  @IsString()
  @MaxLength(80)
  make: string;

  @IsString()
  @MaxLength(80)
  model: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1900)
  year?: number;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  vin?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  colour?: string;

  @IsOptional()
  @IsIn(FUEL_TYPES)
  fuelType?: string;

  @IsOptional()
  @IsIn(OWNERSHIP)
  ownershipType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  ownerName?: string;

  @IsOptional()
  @IsDateString()
  acquisitionDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  currentOdometer?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class UpdateVehicleDto {
  @IsOptional() @IsUUID() branchId?: string | null;
  @IsOptional() @IsUUID() assetId?: string | null;
  @IsOptional() @IsString() @MaxLength(80) make?: string;
  @IsOptional() @IsString() @MaxLength(80) model?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1900) year?: number;
  @IsOptional() @IsString() @MaxLength(60) vin?: string;
  @IsOptional() @IsString() @MaxLength(40) colour?: string;
  @IsOptional() @IsIn(FUEL_TYPES) fuelType?: string;
  @IsOptional() @IsIn(OWNERSHIP) ownershipType?: string;
  @IsOptional() @IsString() @MaxLength(150) ownerName?: string;
  @IsOptional() @IsDateString() acquisitionDate?: string;
  @IsOptional() @IsIn(VEHICLE_STATUS) status?: string;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
}

export class AssignDriverDto {
  @IsUUID()
  driverEmployeeId: string;

  @IsDateString()
  startDate: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}

export class EndAssignmentDto {
  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export class LogOdometerDto {
  @IsDateString()
  readingDate: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  odometer: number;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}

export class LogLocationDto {
  @IsString()
  @MaxLength(300)
  location: string;
}

export class LogFuelDto {
  @IsDateString()
  logDate: string;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  litres: number;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  cost: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  odometer?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  fuelStation?: string;

  @IsOptional()
  @IsBoolean()
  filledToFull?: boolean;
}

export class CreateServiceScheduleDto {
  @IsString()
  @MaxLength(120)
  name: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  intervalKm?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  intervalDays?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  lastServiceOdometer?: number;

  @IsOptional()
  @IsDateString()
  lastServiceDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class UpdateServiceScheduleDto {
  @IsOptional() @IsString() @MaxLength(120) name?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) intervalKm?: number | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) intervalDays?: number | null;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

export class CreateServiceRecordDto {
  @IsDateString()
  serviceDate: string;

  @IsOptional()
  @IsUUID()
  scheduleId?: string;

  @IsOptional()
  @IsIn(['service', 'repair'])
  kind?: string;

  @IsString()
  @MaxLength(1000)
  description: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  odometer?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  cost?: number;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  provider?: string;
}

export class CreateRenewalDto {
  @IsIn(RENEWAL_TYPES)
  renewalType: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  reference?: string;

  @IsOptional()
  @IsDateString()
  issueDate?: string;

  @IsDateString()
  expiryDate: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  cost?: number;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  provider?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class CreateAccidentDto {
  @IsDateString()
  accidentDate: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  location?: string;

  @IsIn(SEVERITY)
  severity: string;

  @IsString()
  @MaxLength(2000)
  description: string;

  @IsOptional()
  @IsUUID()
  driverEmployeeId?: string;

  @IsOptional()
  @IsBoolean()
  thirdPartyInvolved?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  estimatedCost?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  insuranceClaimReference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  policeReportReference?: string;
}

export class UpdateAccidentDto {
  @IsOptional() @IsBoolean() resolved?: boolean;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) estimatedCost?: number;
  @IsOptional() @IsString() @MaxLength(120) insuranceClaimReference?: string;
  @IsOptional() @IsString() @MaxLength(120) policeReportReference?: string;
}

export class CreateVehicleExpenseDto {
  @IsDateString()
  expenseDate: string;

  @IsIn(EXPENSE_CATEGORIES)
  category: string;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  amount: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  odometer?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  reference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
