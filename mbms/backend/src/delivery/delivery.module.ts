import { Module } from '@nestjs/common';
import { DeliveryController } from './delivery.controller';
import { DeliveryService } from './delivery.service';

// Delivery (31 August 2026) — Morise Logistics Ltd dispatch. Exports
// DeliveryService so the customer portal's orders controller can surface a
// customer's own delivery tracking (one shared service, staff + customer
// controllers — the same shape SalesModule uses for OrdersService).
@Module({
  controllers: [DeliveryController],
  providers: [DeliveryService],
  exports: [DeliveryService],
})
export class DeliveryModule {}
