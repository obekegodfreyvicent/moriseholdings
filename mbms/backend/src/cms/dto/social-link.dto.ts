import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
} from 'class-validator';

// Social media channels (29 August 2026) — managed in Admin » CMS / Site
// Builder, shown in the storefront footer.
export const SOCIAL_PLATFORMS = [
  'facebook',
  'x',
  'instagram',
  'linkedin',
  'youtube',
  'tiktok',
  'whatsapp',
  'telegram',
  'other',
] as const;

export class CreateSocialLinkDto {
  @IsIn(SOCIAL_PLATFORMS, { message: `platform must be one of: ${SOCIAL_PLATFORMS.join(', ')}` })
  platform: (typeof SOCIAL_PLATFORMS)[number];

  @IsString()
  @IsUrl({ require_protocol: true }, { message: 'url must be an absolute http(s) URL' })
  @MaxLength(500)
  url: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isVisible?: boolean;
}

export class UpdateSocialLinkDto {
  @IsOptional()
  @IsIn(SOCIAL_PLATFORMS, { message: `platform must be one of: ${SOCIAL_PLATFORMS.join(', ')}` })
  platform?: (typeof SOCIAL_PLATFORMS)[number];

  @IsOptional()
  @IsString()
  @IsUrl({ require_protocol: true }, { message: 'url must be an absolute http(s) URL' })
  @MaxLength(500)
  url?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isVisible?: boolean;
}
