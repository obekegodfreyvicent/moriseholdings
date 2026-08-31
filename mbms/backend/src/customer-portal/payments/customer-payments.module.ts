import { Module } from '@nestjs/common';
import { SalesModule } from '../../sales/sales.module';
import { CustomerPaymentsController } from './customer-payments.controller';

@Module({
  imports: [SalesModule],
  controllers: [CustomerPaymentsController],
})
export class CustomerPaymentsModule {}
