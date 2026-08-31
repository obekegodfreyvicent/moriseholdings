import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { RolesController } from './roles/roles.controller';

@Module({
  imports: [AuthModule, UsersModule],
  controllers: [RolesController],
})
export class IdentityModule {}
