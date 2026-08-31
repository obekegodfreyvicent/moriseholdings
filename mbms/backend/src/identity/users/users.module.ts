import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { DelegationService } from '../delegation/delegation.service';

@Module({
  controllers: [UsersController],
  providers: [UsersService, DelegationService],
})
export class UsersModule {}
