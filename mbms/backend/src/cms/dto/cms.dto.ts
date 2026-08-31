import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

const SLUG_RE = /^[a-z0-9]([a-z0-9._-]*[a-z0-9])?$/;

export class CreateContentBlockDto {
  @IsString()
  @MaxLength(80)
  @Matches(SLUG_RE, { message: 'slug must be lowercase letters, digits, dot, hyphen or underscore (e.g. page.about)' })
  slug: string;

  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title: string;

  @IsString()
  @MaxLength(20000)
  body: string;
}

export class UpdateContentBlockDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  @Matches(SLUG_RE, { message: 'slug must be lowercase letters, digits, dot, hyphen or underscore (e.g. page.about)' })
  slug?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  body?: string;
}
