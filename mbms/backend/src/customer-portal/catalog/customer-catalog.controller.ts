import { Controller, Get, Headers, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { CustomerJwtAuthGuard } from '../common/customer-jwt-auth.guard';
import { CurrentCustomer } from '../common/current-customer.decorator';
import { AuthenticatedCustomer } from '../common/customer-auth.types';
import { CustomerCatalogService } from './customer-catalog.service';
import { ContentTranslationService } from '../../common/translation/content-translation.service';

// Base path /api/v1/customer-portal/catalog. Since 29 August 2026 the
// catalogue spans the whole holding group — every Morise subsidiary's
// priced, active products, each tagged with its company and branch.
// Catalogue text is returned in the customer's language (Accept-Language).
@Controller('customer-portal/catalog')
@UseGuards(CustomerJwtAuthGuard)
export class CustomerCatalogController {
  constructor(
    private readonly catalogService: CustomerCatalogService,
    private readonly translation: ContentTranslationService,
  ) {}

  @Get('products')
  listProducts(
    @CurrentCustomer() customer: AuthenticatedCustomer,
    @Query('categoryId') categoryId?: string,
    @Query('search') search?: string,
    @Query('companyId') companyId?: string,
    @Query('branchId') branchId?: string,
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    return this.catalogService.listProducts(
      customer,
      { categoryId, search, companyId, branchId },
      this.translation.resolveLang(acceptLanguage),
    );
  }

  @Get('subsidiaries')
  listSubsidiaries(
    @CurrentCustomer() customer: AuthenticatedCustomer,
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    return this.catalogService.listSubsidiaries(customer, this.translation.resolveLang(acceptLanguage));
  }

  @Get('products/:id')
  getProduct(
    @CurrentCustomer() customer: AuthenticatedCustomer,
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    return this.catalogService.getProduct(customer, id, this.translation.resolveLang(acceptLanguage));
  }

  @Get('categories')
  listCategories(@CurrentCustomer() customer: AuthenticatedCustomer, @Headers('accept-language') acceptLanguage?: string) {
    return this.catalogService.listCategories(customer, this.translation.resolveLang(acceptLanguage));
  }
}
