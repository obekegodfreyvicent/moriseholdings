import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateDiscountCodeDto {
  @IsUUID()
  companyId: string;

  @IsString()
  @MinLength(2)
  @MaxLength(40)
  code: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsIn(['percentage', 'fixed'])
  discountType: 'percentage' | 'fixed';

  // decimal-as-string, matching how the rest of the API takes money/rates
  @IsNumberString()
  value: string;

  @IsOptional()
  @IsNumberString()
  minOrderValue?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxRedemptions?: number;

  @IsOptional()
  @IsString()
  startsAt?: string;

  @IsOptional()
  @IsString()
  endsAt?: string;
}

export class UpdateDiscountCodeDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsIn(['percentage', 'fixed'])
  discountType?: 'percentage' | 'fixed';

  @IsOptional()
  @IsNumberString()
  value?: string;

  @IsOptional()
  @IsNumberString()
  minOrderValue?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxRedemptions?: number | null;

  @IsOptional()
  @IsString()
  startsAt?: string | null;

  @IsOptional()
  @IsString()
  endsAt?: string | null;
}

export class CreateBannerDto {
  @IsUUID()
  companyId: string;

  @IsString()
  @MinLength(2)
  @MaxLength(160)
  heading: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  body?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  linkUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  linkLabel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  placement?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsString()
  startsAt?: string;

  @IsOptional()
  @IsString()
  endsAt?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateBannerDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  heading?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  body?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  linkUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  linkLabel?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  placement?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsString()
  startsAt?: string | null;

  @IsOptional()
  @IsString()
  endsAt?: string | null;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class ValidateDiscountCodeDto {
  @IsString()
  @MaxLength(40)
  code: string;

  // order subtotal (pre-VAT, pre-delivery), decimal-as-string
  @IsNumberString()
  subtotal: string;
}
