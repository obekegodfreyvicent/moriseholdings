import { IsEmail, IsOptional, IsString, IsUUID } from 'class-validator';
import { IsStrongPassword } from '../../../common/validators/strong-password.validator';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @IsStrongPassword()
  password: string;

  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  // Optional convenience: assign a first role/scope at creation time.
  @IsOptional()
  @IsUUID()
  roleId?: string;

  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;
}
