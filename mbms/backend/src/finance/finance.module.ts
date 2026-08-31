import { Module } from '@nestjs/common';
import { DashboardModule } from '../dashboard/dashboard.module';
import { FinanceController } from './finance.controller';
import { FinanceService } from './finance.service';

@Module({
  imports: [DashboardModule],
  controllers: [FinanceController],
  providers: [FinanceService],
})
export class FinanceModule {}
