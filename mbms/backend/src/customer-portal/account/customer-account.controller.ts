import { Body, Controller, Get, Headers, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { CustomerJwtAuthGuard } from '../common/customer-jwt-auth.guard';
import { CurrentCustomer } from '../common/current-customer.decorator';
import { AuthenticatedCustomer } from '../common/customer-auth.types';
import { CustomerAccountService } from './customer-account.service';
import { UpdateCustomerProfileDto } from './dto/update-customer-profile.dto';
import { CreateDeliveryAddressDto } from './dto/create-delivery-address.dto';
import { ContentTranslationService } from '../../common/translation/content-translation.service';

// Base path /api/v1/customer-portal.
@Controller('customer-portal')
@UseGuards(CustomerJwtAuthGuard)
export class CustomerAccountController {
  constructor(
    private readonly accountService: CustomerAccountService,
    private readonly translation: ContentTranslationService,
  ) {}

  @Get('me')
  getProfile(
    @CurrentCustomer() customer: AuthenticatedCustomer,
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    return this.accountService.getProfile(customer, this.translation.resolveLang(acceptLanguage));
  }

  @Patch('me')
  updateProfile(
    @CurrentCustomer() customer: AuthenticatedCustomer,
    @Body() dto: UpdateCustomerProfileDto,
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    return this.accountService.updateProfile(customer, dto, this.translation.resolveLang(acceptLanguage));
  }

  @Get('dashboard-summary')
  dashboardSummary(
    @CurrentCustomer() customer: AuthenticatedCustomer,
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    return this.accountService.dashboardSummary(customer, this.translation.resolveLang(acceptLanguage));
  }

  @Get('delivery-addresses')
  listAddresses(@CurrentCustomer() customer: AuthenticatedCustomer, @Headers('accept-language') acceptLanguage?: string) {
    return this.accountService.listAddresses(customer, this.translation.resolveLang(acceptLanguage));
  }

  @Post('delivery-addresses')
  createAddress(
    @CurrentCustomer() customer: AuthenticatedCustomer,
    @Body() dto: CreateDeliveryAddressDto,
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    return this.accountService.createAddress(customer, dto, this.translation.resolveLang(acceptLanguage));
  }

  @Patch('delivery-addresses/:id')
  updateAddress(
    @CurrentCustomer() customer: AuthenticatedCustomer,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateDeliveryAddressDto,
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    return this.accountService.updateAddress(customer, id, dto, this.translation.resolveLang(acceptLanguage));
  }
}
