import { IsString } from 'class-validator';
import { IsStrongPassword } from '../../../common/validators/strong-password.validator';

// Self-service password change — distinct from the two existing password
// flows: POST /identity/users/{id}/reset-password (admin-initiated, no
// current password needed) and POST /identity/auth/password-reset/confirm
// (forgot-password, token-based, unauthenticated). This one requires the
// caller to already be logged in and to prove they know their current
// password before setting a new one.
export class ChangePasswordDto {
  @IsString()
  currentPassword: string;

  @IsString()
  @IsStrongPassword()
  newPassword: string;
}
