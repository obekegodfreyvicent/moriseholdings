import { Module } from '@nestjs/common';
import { MyHrController } from './my-hr.controller';
import { MyHrService } from './my-hr.service';

@Module({
  controllers: [MyHrController],
  providers: [MyHrService],
})
export class MyHrModule {}
