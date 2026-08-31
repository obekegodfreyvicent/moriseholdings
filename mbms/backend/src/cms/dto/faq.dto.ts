import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

// Landing-page FAQ (29 August 2026) — managed in Admin » CMS / Site Builder.
export class CreateFaqItemDto {
  @IsString()
  @MinLength(3)
  @MaxLength(300)
  question: string;

  @IsString()
  @MinLength(2)
  @MaxLength(4000)
  answer: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isVisible?: boolean;
}

export class UpdateFaqItemDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(300)
  question?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(4000)
  answer?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isVisible?: boolean;
}
