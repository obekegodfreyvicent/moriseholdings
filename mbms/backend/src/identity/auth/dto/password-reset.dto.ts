import { IsEmail, IsString } from 'class-validator';
import { IsStrongPassword } from '../../../common/validators/strong-password.validator';

export class PasswordResetRequestDto {
  @IsEmail()
  email: string;
}

export class PasswordResetConfirmDto {
  @IsString()
  token: string;

  @IsString()
  @IsStrongPassword()
  newPassword: string;
}
