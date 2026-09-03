import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SOCIAL_PLATFORMS } from '../../cms/dto/social-link.dto';

// Social Media Publishing (3 September 2026) — request bodies for the
// /api/v1/social composer + publishing engine. See docx/24.

export const SOCIAL_MEDIA_TYPES = ['none', 'image', 'video', 'link'] as const;

export class SocialTargetInputDto {
  @IsIn(SOCIAL_PLATFORMS, { message: `platform must be one of: ${SOCIAL_PLATFORMS.join(', ')}` })
  platform: (typeof SOCIAL_PLATFORMS)[number];

  // Per-platform caption override. Omit to publish the post's master body on
  // this platform.
  @IsOptional()
  @IsString()
  @MaxLength(8000)
  caption?: string;
}

export class CreateSocialPostDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  title?: string;

  @IsString()
  @MaxLength(8000)
  bodyMaster: string;

  @IsOptional()
  @IsIn(SOCIAL_MEDIA_TYPES)
  mediaType?: (typeof SOCIAL_MEDIA_TYPES)[number];

  // Text reference to the image / video (object-storage upload is a
  // documented gap in this build).
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  mediaUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  linkUrl?: string;

  // The platforms to fan this post out to. Either a bare platform list or
  // objects carrying a per-platform caption override.
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SocialTargetInputDto)
  targets: SocialTargetInputDto[];

  // Publish at a future time instead of now (the post is stored `scheduled`;
  // fired by POST /social/run-scheduled or manually with the publish button).
  @IsOptional()
  @IsDateString()
  scheduledFor?: string;
}

export class UpdateSocialPostDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  bodyMaster?: string;

  @IsOptional()
  @IsIn(SOCIAL_MEDIA_TYPES)
  mediaType?: (typeof SOCIAL_MEDIA_TYPES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  mediaUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  linkUrl?: string;

  // When present, replaces the whole target set (add / remove platforms,
  // change caption overrides).
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SocialTargetInputDto)
  targets?: SocialTargetInputDto[];

  // Pass an empty string to clear a schedule.
  @IsOptional()
  @IsString()
  scheduledFor?: string;
}

export class ConnectPlatformDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  accountLabel?: string;
}
