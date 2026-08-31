import { IsNotEmpty, IsString } from 'class-validator';

export class CustomerRefreshDto {
  @IsString()
  @IsNotEmpty()
  refresh_token!: string;
}
