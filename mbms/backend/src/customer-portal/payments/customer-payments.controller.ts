import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { CustomerJwtAuthGuard } from '../common/customer-jwt-auth.guard';
import { CurrentCustomer } from '../common/current-customer.decorator';
import { AuthenticatedCustomer } from '../common/customer-auth.types';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { PaymentsService } from '../../sales/payments.service';
import { CreatePaymentDto } from '../../sales/dto/create-payment.dto';

// Base path /api/v1/customer-portal/payments.
@Controller('customer-portal/payments')
@UseGuards(CustomerJwtAuthGuard)
export class CustomerPaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get()
  list(@CurrentCustomer() customer: AuthenticatedCustomer, @Query() query: PaginationQueryDto) {
    return this.paymentsService.listForCustomer(customer, query.page, query.pageSize);
  }

  @Post()
  create(@CurrentCustomer() customer: AuthenticatedCustomer, @Body() dto: CreatePaymentDto) {
    return this.paymentsService.createForCustomer(customer, dto);
  }
}
