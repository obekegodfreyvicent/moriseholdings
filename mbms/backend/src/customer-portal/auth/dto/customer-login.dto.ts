import { IsNotEmpty, IsString } from 'class-validator';

// Matches screenshots/Customer/01-login.png's single "Email or Account
// Number" field — CustomerAuthService tries both lookups.
export class CustomerLoginDto {
  @IsString()
  @IsNotEmpty()
  identifier!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;
}
