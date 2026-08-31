import { Module } from '@nestjs/common';
import { ShiftSchedulingController } from './shift-scheduling.controller';
import { ShiftSchedulingService } from './shift-scheduling.service';

@Module({
  controllers: [ShiftSchedulingController],
  providers: [ShiftSchedulingService],
})
export class ShiftSchedulingModule {}
