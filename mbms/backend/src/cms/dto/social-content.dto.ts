import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

// Shared social media content (2 September 2026) — one canonical set of
// details managed in Admin » CMS / Site Builder and pushed to every social
// channel in a single click, so all channels carry the same information.

export class UpdateSocialContentDto {
  // The bare account handle, no @ and no URL — e.g. "moriseholdings". Used to
  // build each platform's URL when channels are (re)generated from this
  // shared record.
  @IsOptional()
  @IsString()
  @MaxLength(120)
  handle?: string | null;

  // The label shown for every channel (footer link text, aria-label).
  @IsOptional()
  @IsString()
  @MaxLength(120)
  displayName?: string | null;

  // Optional one-line description shown beside the channel row in the
  // storefront footer.
  @IsOptional()
  @IsString()
  @MaxLength(300)
  tagline?: string | null;

  // Shared visibility applied to every channel when this record is pushed.
  @IsOptional()
  @IsBoolean()
  isVisible?: boolean;
}

// Body for the single-click "apply to all channels" action.
export class ApplySocialContentDto {
  // When true, first create a channel row for every supported platform that
  // doesn't have one yet (a platform is skipped only if it needs a handle
  // and none is set). When false, only channels that already exist are
  // touched.
  @IsOptional()
  @IsBoolean()
  createMissing?: boolean;

  // When true, rebuild every channel's URL from the shared handle and the
  // platform's base URL. When false, existing URLs are left as they are and
  // only the label / visibility are synced.
  @IsOptional()
  @IsBoolean()
  overwriteUrls?: boolean;
}
