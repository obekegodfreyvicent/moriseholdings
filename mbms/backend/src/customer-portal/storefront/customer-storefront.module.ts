import { Module } from '@nestjs/common';
import { MarketingModule } from '../../marketing/marketing.module';
import { CmsModule } from '../../cms/cms.module';
import { CustomerCatalogModule } from '../catalog/customer-catalog.module';
import {
  CustomerContentController,
  CustomerPromoController,
  CustomerPublicController,
} from './customer-storefront.controller';

@Module({
  imports: [MarketingModule, CmsModule, CustomerCatalogModule],
  controllers: [CustomerContentController, CustomerPromoController, CustomerPublicController],
})
export class CustomerStorefrontModule {}
