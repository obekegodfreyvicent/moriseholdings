import { Body, Controller, Get, Headers, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { CustomerJwtAuthGuard } from '../common/customer-jwt-auth.guard';
import { CurrentCustomer } from '../common/current-customer.decorator';
import { AuthenticatedCustomer } from '../common/customer-auth.types';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { OrdersService } from '../../sales/orders.service';
import { DeliveryService } from '../../delivery/delivery.service';
import { CreateOrderDto } from '../../sales/dto/create-order.dto';
import { CancelOrderDto } from '../../sales/dto/cancel-order.dto';
import { ContentTranslationService } from '../../common/translation/content-translation.service';

// Base path /api/v1/customer-portal/orders.
//
// Content localisation (29 August 2026): reads honour Accept-Language —
// line-item product names, the selling subsidiary name and the cancellation
// reason come back in the customer's chosen language; a cancellation reason
// the customer typed in a non-English language is stored in English (with
// the original kept).
@Controller('customer-portal/orders')
@UseGuards(CustomerJwtAuthGuard)
export class CustomerOrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly deliveryService: DeliveryService,
    private readonly translation: ContentTranslationService,
  ) {}

  @Get()
  list(
    @CurrentCustomer() customer: AuthenticatedCustomer,
    @Query() query: PaginationQueryDto,
    @Query('filter[status]') status?: string,
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    return this.ordersService.listForCustomer(
      customer,
      query.page,
      query.pageSize,
      { status },
      this.translation.resolveLang(acceptLanguage),
    );
  }

  @Post()
  create(
    @CurrentCustomer() customer: AuthenticatedCustomer,
    @Body() dto: CreateOrderDto,
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    return this.ordersService.createForCustomer(customer, dto, this.translation.resolveLang(acceptLanguage));
  }

  @Get(':id')
  get(
    @CurrentCustomer() customer: AuthenticatedCustomer,
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    return this.ordersService.getForCustomer(customer, id, this.translation.resolveLang(acceptLanguage));
  }

  // Delivery tracking for the customer's own order — driver, ETA/schedule,
  // status checkpoints and proof of delivery. Returns null until Morise
  // Logistics has created a delivery for the order.
  @Get(':id/delivery')
  delivery(@CurrentCustomer() customer: AuthenticatedCustomer, @Param('id', ParseUUIDPipe) id: string) {
    return this.deliveryService.getForCustomerOrder(customer, id);
  }

  @Post(':id/cancel')
  cancel(
    @CurrentCustomer() customer: AuthenticatedCustomer,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelOrderDto,
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    return this.ordersService.cancelForCustomer(customer, id, dto, this.translation.resolveLang(acceptLanguage));
  }
}
