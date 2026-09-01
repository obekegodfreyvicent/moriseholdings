import { Module } from '@nestjs/common';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { WarehouseManagementController } from './warehouse-management.controller';
import { WarehouseManagementService } from './warehouse-management.service';

@Module({
  controllers: [InventoryController, WarehouseManagementController],
  providers: [InventoryService, WarehouseManagementService],
})
export class InventoryModule {}
