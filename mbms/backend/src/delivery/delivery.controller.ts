import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/strategies/jwt.strategy';
import { DeliveryService } from './delivery.service';
import {
  AdvanceDeliveryStatusDto,
  AssignDriverDto,
  CancelDeliveryDto,
  CreateDeliveryDriverDto,
  CreateDeliveryDto,
  FailDeliveryDto,
  ProofOfDeliveryDto,
  UpdateDeliveryDriverDto,
} from './dto/delivery.dto';

// Base path /api/v1/delivery — the Admin "Delivery" section (31 August
// 2026), the dispatch surface for Morise Logistics Ltd. Reads open to
// `delivery.viewAll` OR `delivery.manage` (manage implies read within
// scope); every write requires `delivery.manage`. Customer-facing tracking
// lives at /customer-portal/orders/:id/delivery (customer-jwt guard).
@Controller('delivery')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('delivery.manage', 'delivery.viewAll')
export class DeliveryController {
  constructor(private readonly service: DeliveryService) {}

  // ---- drivers (declared before :id so "/delivery/drivers" isn't an id) ----

  @Get('drivers')
  listDrivers(
    @CurrentUser() user: AuthenticatedUser,
    @Query('companyId') companyId?: string,
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.service.listDrivers(user, companyId || undefined, includeInactive === 'true' || includeInactive === '1');
  }

  @Post('drivers')
  @RequirePermission('delivery.manage')
  createDriver(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateDeliveryDriverDto) {
    return this.service.createDriver(user, dto);
  }

  @Put('drivers/:id')
  @RequirePermission('delivery.manage')
  updateDriver(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDeliveryDriverDto,
  ) {
    return this.service.updateDriver(user, id, dto);
  }

  // ---- dispatch metrics + eligible orders ----------------------------------

  @Get('metrics')
  metrics(@CurrentUser() user: AuthenticatedUser, @Query('companyId') companyId?: string) {
    return this.service.metrics(user, companyId || undefined);
  }

  @Get('eligible-orders')
  eligibleOrders(@CurrentUser() user: AuthenticatedUser, @Query('companyId') companyId?: string) {
    return this.service.eligibleOrders(user, companyId || undefined);
  }

  // ---- deliveries ---------------------------------------------------------

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('companyId') companyId?: string,
    @Query('status') status?: string,
    @Query('customerId') customerId?: string,
    @Query('q') q?: string,
  ) {
    return this.service.list(user, {
      companyId: companyId || undefined,
      status: status || undefined,
      customerId: customerId || undefined,
      q: q || undefined,
    });
  }

  @Get(':id')
  get(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.get(user, id);
  }

  @Post()
  @RequirePermission('delivery.manage')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateDeliveryDto) {
    return this.service.create(user, dto);
  }

  @Post(':id/assign')
  @RequirePermission('delivery.manage')
  assign(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignDriverDto,
  ) {
    return this.service.assignDriver(user, id, dto);
  }

  @Post(':id/status')
  @RequirePermission('delivery.manage')
  advance(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdvanceDeliveryStatusDto,
  ) {
    return this.service.advanceStatus(user, id, dto);
  }

  @Post(':id/proof')
  @RequirePermission('delivery.manage')
  proof(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ProofOfDeliveryDto,
  ) {
    return this.service.captureProof(user, id, dto);
  }

  @Post(':id/fail')
  @RequirePermission('delivery.manage')
  fail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: FailDeliveryDto,
  ) {
    return this.service.failDelivery(user, id, dto);
  }

  @Post(':id/cancel')
  @RequirePermission('delivery.manage')
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelDeliveryDto,
  ) {
    return this.service.cancelDelivery(user, id, dto);
  }
}
