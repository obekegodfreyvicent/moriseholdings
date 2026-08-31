import { Module } from '@nestjs/common';
import { SalesModule } from '../../sales/sales.module';
import { DeliveryModule } from '../../delivery/delivery.module';
import { CustomerOrdersController } from './customer-orders.controller';

@Module({
  imports: [SalesModule, DeliveryModule],
  controllers: [CustomerOrdersController],
})
export class CustomerOrdersModule {}
