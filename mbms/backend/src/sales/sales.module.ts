import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { InvoicesService } from './invoices.service';
import { PaymentsService } from './payments.service';

// Sprint 16 (Customer Storefront). Exports OrdersService/InvoicesService/
// PaymentsService so CustomerPortalModule's thin per-resource controllers
// (customer-portal/orders, /invoices, /payments) can inject the same
// business logic the staff OrdersController above uses — one shared
// service, two differently-scoped controllers, the same shape
// NotificationsService already establishes.
@Module({
  controllers: [OrdersController],
  providers: [OrdersService, InvoicesService, PaymentsService],
  exports: [OrdersService, InvoicesService, PaymentsService],
})
export class SalesModule {}
