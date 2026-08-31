import { IsEmail, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CustomerRegisterDto {
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name!: string;

  @IsEmail()
  contactEmail!: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  contactPhone?: string;

  @IsString()
  @MinLength(8)
  @MaxLength(200)
  password!: string;

  // which Morise company the customer's account belongs to (they can still
  // shop across every subsidiary in the group)
  @IsUUID()
  companyId!: string;

  // Storefront group catalogue (29 August 2026): optional home branch of
  // that company — must belong to companyId.
  @IsOptional()
  @IsUUID()
  homeBranchId?: string;
}

export class GoogleSignInDto {
  // In production this is derived from a verified Google ID token; in this
  // offline build the storefront's "Continue with Google" button sends it
  // directly (documented seam).
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsUUID()
  companyId?: string;
}

export class ForgotPasswordDto {
  @IsString()
  @IsNotEmpty()
  identifier!: string; // email, phone or account number
}

export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  token!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(200)
  newPassword!: string;
}
