import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/strategies/jwt.strategy';
import { InventoryService } from './inventory.service';
import { AdjustStockDto, SetReorderPointDto } from './dto/inventory.dto';

// Base path /api/v1/inventory — the Admin "Inventory" section (28 August
// 2026). Reads are scoped per BR-01 like the Product list; writes require
// `product.manage`, the same permission that gates creating/editing a
// product. Per-branch stock and inter-branch transfers are Warehouse
// Management System scope (docx/20), not built here.
@Controller('inventory')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('stock')
  listStock(
    @CurrentUser() user: AuthenticatedUser,
    @Query('companyId') companyId?: string,
    @Query('lowStockOnly') lowStockOnly?: string,
    @Query('search') search?: string,
  ) {
    return this.inventoryService.listStock(user, {
      companyId: companyId || undefined,
      lowStockOnly: lowStockOnly === 'true' || lowStockOnly === '1',
      search: search || undefined,
    });
  }

  @Get('movements')
  listMovements(
    @CurrentUser() user: AuthenticatedUser,
    @Query('companyId') companyId?: string,
    @Query('productId') productId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.inventoryService.listMovements(user, {
      companyId: companyId || undefined,
      productId: productId || undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Post('adjustments')
  @RequirePermission('product.manage')
  adjust(@CurrentUser() user: AuthenticatedUser, @Body() dto: AdjustStockDto) {
    return this.inventoryService.adjust(user, dto);
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
}
