import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

// Newsletter sign-up from the landing page (29 August 2026) — public, no
// account.
export class NewsletterSubscribeDto {
  @IsEmail({}, { message: 'A valid email address is required.' })
  @MaxLength(255)
  email: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  source?: string;
}
