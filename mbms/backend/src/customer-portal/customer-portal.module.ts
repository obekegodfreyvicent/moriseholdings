import { Module } from '@nestjs/common';
import { CustomerAuthModule } from './auth/customer-auth.module';
import { CustomerCatalogModule } from './catalog/customer-catalog.module';
import { CustomerOrdersModule } from './orders/customer-orders.module';
import { CustomerInvoicesModule } from './invoices/customer-invoices.module';
import { CustomerPaymentsModule } from './payments/customer-payments.module';
import { CustomerSupportPortalModule } from './support/customer-support.module';
import { CustomerAccountModule } from './account/customer-account.module';
import { CustomerStorefrontModule } from './storefront/customer-storefront.module';

// Sprint 16 (Customer Storefront) — aggregates every /customer-portal/*
// sub-module, mirroring identity.module.ts's own role as a thin composer
// of its sub-modules. Imported once into app.module.ts.
@Module({
  imports: [
    CustomerAuthModule,
    CustomerCatalogModule,
    CustomerOrdersModule,
    CustomerInvoicesModule,
    CustomerPaymentsModule,
    CustomerSupportPortalModule,
    CustomerAccountModule,
    CustomerStorefrontModule,
  ],
})
export class CustomerPortalModule {}
