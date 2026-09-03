import { IsDateString, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

// Automatic Staff Identification Card (3 September 2026) — request bodies for
// the /api/v1/staff-id-cards module. A card is normally issued automatically
// (on Employee creation, or by POST /generate); these DTOs cover the manual
// issue / maintenance actions an administrator performs on top of that.

export class IssueCardDto {
  @IsUUID()
  employeeId: string;

  // Text reference only — object-storage for real photo uploads is a
  // documented gap across this codebase; the UI falls back to initials.
  @IsOptional()
  @IsString()
  @MaxLength(500)
  photoUrl?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  validYears?: number;

  @IsOptional()
  @IsDateString()
  issuedOn?: string;

  // Card back.
  @IsOptional()
  @IsString()
  @MaxLength(8)
  bloodGroup?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  backNotes?: string;
}

export class GenerateCardsDto {
  // Limit the sweep to one company; omit to cover every company in scope.
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  validYears?: number;
}

export class UpdateCardDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  photoUrl?: string;

  @IsOptional()
  @IsDateString()
  expiresOn?: string;

  // Card back.
  @IsOptional()
  @IsString()
  @MaxLength(8)
  bloodGroup?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  backNotes?: string;
}

export class ReissueCardDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  validYears?: number;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  reason?: string;
}

export class RevokeCardDto {
  @IsString()
  @MaxLength(400)
  reason: string;
}
