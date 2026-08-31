import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/strategies/jwt.strategy';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { OrdersService } from './orders.service';
import { CancelOrderDto } from './dto/cancel-order.dto';

// Base path /api/v1/sales/orders — Sprint 16, staff side: view and advance
// a customer order through fulfillment. The customer's own side lives at
// /customer-portal/orders (customer-jwt guard, not this one).
@Controller('sales/orders')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('sales.order.manage', 'sales.order.viewAll')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQueryDto,
    @Query('filter[companyId]') companyId?: string,
    @Query('filter[status]') status?: string,
  ) {
    return this.ordersService.listForStaff(user, query.page, query.pageSize, { companyId, status });
  }

  @Get(':id')
  get(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.ordersService.getForStaff(user, id);
  }

  @Post(':id/advance-status')
  @RequirePermission('sales.order.manage')
  advanceStatus(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.ordersService.advanceStatus(user, id);
  }

  @Post(':id/cancel')
  @RequirePermission('sales.order.manage')
  cancel(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CancelOrderDto) {
    return this.ordersService.cancelForStaff(user, id, dto);
  }
}
