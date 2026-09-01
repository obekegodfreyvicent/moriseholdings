import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/strategies/jwt.strategy';
import { WarehouseManagementService } from './warehouse-management.service';
import {
  AddStockCountLinesDto,
  AddWarehouseStaffDto,
  AssignPickListDto,
  CreateGoodsReceiptDto,
  CreatePickListDto,
  CreateStockCountDto,
  PickDto,
  SetCountedQuantityDto,
  UpdateWarehouseStaffDto,
} from './dto/warehouse-management.dto';

// The Warehouse Management operations layer (1 September 2026): warehouse
// staff, receiving (goods receipts), picking / packing / dispatch (pick
// lists), and physical count + reconciliation (stock counts). Same base
// path and permissions as the rest of /inventory — reads scoped per BR-01,
// writes gated by product.manage.
@Controller('inventory')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class WarehouseManagementController {
  constructor(private readonly wms: WarehouseManagementService) {}

  // ---- Barcode lookup --------------------------------------------
  @Get('lookup')
  lookup(
    @CurrentUser() user: AuthenticatedUser,
    @Query('barcode') barcode: string,
    @Query('companyId') companyId?: string,
  ) {
    return this.wms.lookup(user, barcode ?? '', companyId || undefined);
  }

  // ---- Warehouse staff -----------------------------------------
  @Get('warehouses/:id/staff')
  listStaff(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.wms.listStaff(user, id);
  }

  @Post('warehouses/:id/staff')
  @RequirePermission('product.manage')
  addStaff(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddWarehouseStaffDto,
  ) {
    return this.wms.addStaff(user, id, dto);
  }

  @Patch('warehouse-staff/:staffId')
  @RequirePermission('product.manage')
  updateStaff(
    @CurrentUser() user: AuthenticatedUser,
    @Param('staffId', ParseUUIDPipe) staffId: string,
    @Body() dto: UpdateWarehouseStaffDto,
  ) {
    return this.wms.updateStaff(user, staffId, dto);
  }

  @Delete('warehouse-staff/:staffId')
  @RequirePermission('product.manage')
  removeStaff(@CurrentUser() user: AuthenticatedUser, @Param('staffId', ParseUUIDPipe) staffId: string) {
    return this.wms.removeStaff(user, staffId);
  }

  // ---- Goods receipts (receiving) ----------------------------
  @Get('goods-receipts')
  listGoodsReceipts(
    @CurrentUser() user: AuthenticatedUser,
    @Query('companyId') companyId?: string,
    @Query('warehouseId') warehouseId?: string,
    @Query('status') status?: string,
  ) {
    return this.wms.listGoodsReceipts(user, {
      companyId: companyId || undefined,
      warehouseId: warehouseId || undefined,
      status: status || undefined,
    });
  }

  @Post('goods-receipts')
  @RequirePermission('product.manage')
  createGoodsReceipt(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateGoodsReceiptDto) {
    return this.wms.createGoodsReceipt(user, dto);
  }

  @Get('goods-receipts/:id')
  getGoodsReceipt(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.wms.getGoodsReceipt(user, id);
  }

  @Post('goods-receipts/:id/receive')
  @RequirePermission('product.manage')
  receiveGoodsReceipt(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.wms.receiveGoodsReceipt(user, id);
  }

  @Post('goods-receipts/:id/cancel')
  @RequirePermission('product.manage')
  cancelGoodsReceipt(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.wms.cancelGoodsReceipt(user, id);
  }

  // ---- Pick lists (picking / packing / dispatch) -----------
  @Get('pick-lists')
  listPickLists(
    @CurrentUser() user: AuthenticatedUser,
    @Query('companyId') companyId?: string,
    @Query('warehouseId') warehouseId?: string,
    @Query('status') status?: string,
  ) {
    return this.wms.listPickLists(user, {
      companyId: companyId || undefined,
      warehouseId: warehouseId || undefined,
      status: status || undefined,
    });
  }

  @Post('pick-lists')
  @RequirePermission('product.manage')
  createPickList(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreatePickListDto) {
    return this.wms.createPickList(user, dto);
  }

  @Get('pick-lists/:id')
  getPickList(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.wms.getPickList(user, id);
  }

  @Post('pick-lists/:id/assign')
  @RequirePermission('product.manage')
  assignPickList(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignPickListDto,
  ) {
    return this.wms.assignPickList(user, id, dto);
  }

  @Post('pick-lists/:id/pick')
  @RequirePermission('product.manage')
  pick(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PickDto,
  ) {
    return this.wms.pick(user, id, dto);
  }

  @Post('pick-lists/:id/pack')
  @RequirePermission('product.manage')
  packPickList(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.wms.packPickList(user, id);
  }

  @Post('pick-lists/:id/dispatch')
  @RequirePermission('product.manage')
  dispatchPickList(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.wms.dispatchPickList(user, id);
  }

  @Post('pick-lists/:id/cancel')
  @RequirePermission('product.manage')
  cancelPickList(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.wms.cancelPickList(user, id);
  }

  // ---- Stock counts (count + reconciliation) --------------
  @Get('stock-counts')
  listStockCounts(
    @CurrentUser() user: AuthenticatedUser,
    @Query('companyId') companyId?: string,
    @Query('warehouseId') warehouseId?: string,
    @Query('status') status?: string,
  ) {
    return this.wms.listStockCounts(user, {
      companyId: companyId || undefined,
      warehouseId: warehouseId || undefined,
      status: status || undefined,
    });
  }

  @Post('stock-counts')
  @RequirePermission('product.manage')
  createStockCount(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateStockCountDto) {
    return this.wms.createStockCount(user, dto);
  }

  @Get('stock-counts/:id')
  getStockCount(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.wms.getStockCount(user, id);
  }

  @Post('stock-counts/:id/lines')
  @RequirePermission('product.manage')
  addStockCountLines(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddStockCountLinesDto,
  ) {
    return this.wms.addStockCountLines(user, id, dto);
  }

  @Patch('stock-counts/:id/lines/:lineId')
  @RequirePermission('product.manage')
  setCountedQuantity(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('lineId', ParseUUIDPipe) lineId: string,
    @Body() dto: SetCountedQuantityDto,
  ) {
    return this.wms.setCountedQuantity(user, id, lineId, dto);
  }

  @Post('stock-counts/:id/reconcile')
  @RequirePermission('product.manage')
  reconcileStockCount(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.wms.reconcileStockCount(user, id);
  }

  @Post('stock-counts/:id/cancel')
  @RequirePermission('product.manage')
  cancelStockCount(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.wms.cancelStockCount(user, id);
  }
}
