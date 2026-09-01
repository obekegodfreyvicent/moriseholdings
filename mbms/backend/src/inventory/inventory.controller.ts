import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/strategies/jwt.strategy';
import { InventoryService } from './inventory.service';
import {
  AdjustStockDto,
  CreateStockLocationDto,
  CreateWarehouseDto,
  ReturnStockDto,
  SetReorderPointDto,
  SetStockLevelsDto,
  TransferStockDto,
  UpdateStockLocationDto,
  UpdateWarehouseDto,
} from './dto/inventory.dto';

// Base path /api/v1/inventory — the Admin "Inventory" section (28 August
// 2026), extended into full Inventory Management (1 September 2026):
// warehouses, stock locations, per-warehouse balances, transfers, returns,
// batch / expiry / serial tracking, min / max stock levels and the eight
// inventory reports. Reads are scoped per BR-01 like the Product list;
// writes require `product.manage`, the same permission that gates
// creating / editing a product.
@Controller('inventory')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('stock')
  listStock(
    @CurrentUser() user: AuthenticatedUser,
    @Query('companyId') companyId?: string,
    @Query('warehouseId') warehouseId?: string,
    @Query('lowStockOnly') lowStockOnly?: string,
    @Query('search') search?: string,
  ) {
    return this.inventoryService.listStock(user, {
      companyId: companyId || undefined,
      warehouseId: warehouseId || undefined,
      lowStockOnly: lowStockOnly === 'true' || lowStockOnly === '1',
      search: search || undefined,
    });
  }

  @Get('balances')
  listBalances(@CurrentUser() user: AuthenticatedUser, @Query('productId', ParseUUIDPipe) productId: string) {
    return this.inventoryService.listBalances(user, productId);
  }

  @Get('movements')
  listMovements(
    @CurrentUser() user: AuthenticatedUser,
    @Query('companyId') companyId?: string,
    @Query('productId') productId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
  ) {
    return this.inventoryService.listMovements(user, {
      companyId: companyId || undefined,
      productId: productId || undefined,
      from: from || undefined,
      to: to || undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Post('adjustments')
  @RequirePermission('product.manage')
  adjust(@CurrentUser() user: AuthenticatedUser, @Body() dto: AdjustStockDto) {
    return this.inventoryService.adjust(user, dto);
  }

  @Post('transfers')
  @RequirePermission('product.manage')
  transfer(@CurrentUser() user: AuthenticatedUser, @Body() dto: TransferStockDto) {
    return this.inventoryService.transfer(user, dto);
  }

  @Post('returns')
  @RequirePermission('product.manage')
  recordReturn(@CurrentUser() user: AuthenticatedUser, @Body() dto: ReturnStockDto) {
    return this.inventoryService.recordReturn(user, dto);
  }

  @Put('products/:id/reorder-point')
  @RequirePermission('product.manage')
  setReorderPoint(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetReorderPointDto,
  ) {
    return this.inventoryService.setReorderPoint(user, id, dto);
  }

  @Put('products/:id/stock-levels')
  @RequirePermission('product.manage')
  setStockLevels(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetStockLevelsDto,
  ) {
    return this.inventoryService.setStockLevels(user, id, dto);
  }

  // ---- Warehouses & locations ----------------------------------------

  @Get('warehouses')
  listWarehouses(@CurrentUser() user: AuthenticatedUser, @Query('companyId') companyId?: string) {
    return this.inventoryService.listWarehouses(user, companyId || undefined);
  }

  @Post('warehouses')
  @RequirePermission('product.manage')
  createWarehouse(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateWarehouseDto) {
    return this.inventoryService.createWarehouse(user, dto);
  }

  @Patch('warehouses/:id')
  @RequirePermission('product.manage')
  updateWarehouse(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWarehouseDto,
  ) {
    return this.inventoryService.updateWarehouse(user, id, dto);
  }

  @Get('warehouses/:id/locations')
  listLocations(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.inventoryService.listLocations(user, id);
  }

  @Post('warehouses/:id/locations')
  @RequirePermission('product.manage')
  createLocation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateStockLocationDto,
  ) {
    return this.inventoryService.createLocation(user, id, dto);
  }

  @Patch('locations/:locationId')
  @RequirePermission('product.manage')
  updateLocation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('locationId', ParseUUIDPipe) locationId: string,
    @Body() dto: UpdateStockLocationDto,
  ) {
    return this.inventoryService.updateLocation(user, locationId, dto);
  }

  // ---- Batches & serials --------------------------------------------

  @Get('batches')
  listBatches(
    @CurrentUser() user: AuthenticatedUser,
    @Query('companyId') companyId?: string,
    @Query('productId') productId?: string,
    @Query('warehouseId') warehouseId?: string,
  ) {
    return this.inventoryService.listBatches(user, {
      companyId: companyId || undefined,
      productId: productId || undefined,
      warehouseId: warehouseId || undefined,
    });
  }

  @Get('serials')
  listSerials(
    @CurrentUser() user: AuthenticatedUser,
    @Query('companyId') companyId?: string,
    @Query('productId') productId?: string,
    @Query('status') status?: string,
  ) {
    return this.inventoryService.listSerials(user, {
      companyId: companyId || undefined,
      productId: productId || undefined,
      status: status || undefined,
    });
  }

  // ---- Reports ------------------------------------------------------

  @Get('reports/stock-balance')
  reportStockBalance(
    @CurrentUser() user: AuthenticatedUser,
    @Query('companyId') companyId?: string,
    @Query('warehouseId') warehouseId?: string,
  ) {
    return this.inventoryService.reportStockBalance(user, companyId || undefined, warehouseId || undefined);
  }

  @Get('reports/stock-movement')
  reportStockMovement(
    @CurrentUser() user: AuthenticatedUser,
    @Query('companyId') companyId?: string,
    @Query('productId') productId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.inventoryService.reportStockMovement(user, {
      companyId: companyId || undefined,
      productId: productId || undefined,
      from: from || undefined,
      to: to || undefined,
    });
  }

  @Get('reports/movement-analysis')
  reportMovementAnalysis(
    @CurrentUser() user: AuthenticatedUser,
    @Query('companyId') companyId?: string,
    @Query('days') days?: string,
  ) {
    return this.inventoryService.reportMovementAnalysis(
      user,
      companyId || undefined,
      days ? Number(days) : undefined,
    );
  }

  @Get('reports/valuation')
  reportValuation(
    @CurrentUser() user: AuthenticatedUser,
    @Query('companyId') companyId?: string,
    @Query('warehouseId') warehouseId?: string,
  ) {
    return this.inventoryService.reportValuation(user, companyId || undefined, warehouseId || undefined);
  }

  @Get('reports/shortage')
  reportShortage(@CurrentUser() user: AuthenticatedUser, @Query('companyId') companyId?: string) {
    return this.inventoryService.reportShortage(user, companyId || undefined);
  }

  @Get('reports/surplus')
  reportSurplus(@CurrentUser() user: AuthenticatedUser, @Query('companyId') companyId?: string) {
    return this.inventoryService.reportSurplus(user, companyId || undefined);
  }

  @Get('reports/expiring')
  reportExpiring(
    @CurrentUser() user: AuthenticatedUser,
    @Query('companyId') companyId?: string,
    @Query('days') days?: string,
  ) {
    return this.inventoryService.reportExpiring(
      user,
      companyId || undefined,
      days ? Number(days) : undefined,
    );
  }
}
