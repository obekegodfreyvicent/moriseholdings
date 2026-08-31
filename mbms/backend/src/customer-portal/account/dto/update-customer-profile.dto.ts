import { IsEmail, IsOptional, IsString } from 'class-validator';

export class UpdateCustomerProfileDto {
  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;

  @IsOptional()
  @IsString()
  address?: string;
}
