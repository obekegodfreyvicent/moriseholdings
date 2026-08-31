import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

// Site disclaimer (30 August 2026) — one statement per row, managed in
// Admin » CMS / Site Builder.
export class CreateDisclaimerItemDto {
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  body: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isVisible?: boolean;
}

export class UpdateDisclaimerItemDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  body?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isVisible?: boolean;
}
