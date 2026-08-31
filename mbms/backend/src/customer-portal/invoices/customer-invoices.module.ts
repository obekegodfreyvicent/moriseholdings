import { Module } from '@nestjs/common';
import { SalesModule } from '../../sales/sales.module';
import { CustomerInvoicesController } from './customer-invoices.controller';

@Module({
  imports: [SalesModule],
  controllers: [CustomerInvoicesController],
})
export class CustomerInvoicesModule {}
