import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

// ---- Warehouse staff -------------------------------------------------

export const WAREHOUSE_ROLES = [
  'manager',
  'supervisor',
  'receiver',
  'picker',
  'packer',
  'dispatcher',
] as const;
export type WarehouseRoleDto = (typeof WAREHOUSE_ROLES)[number];

export class AddWarehouseStaffDto {
  @IsUUID()
  employeeId: string;

  @IsIn(WAREHOUSE_ROLES)
  role: WarehouseRoleDto;
}

export class UpdateWarehouseStaffDto {
  @IsOptional()
  @IsIn(WAREHOUSE_ROLES)
  role?: WarehouseRoleDto;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// ---- Goods receipt (receiving) -------------------------------------

class GoodsReceiptLineDto {
  @IsOptional()
  @IsUUID()
  productId?: string;

  // Barcode scanning: an alternative to productId — resolved server-side.
  @IsOptional()
  @IsString()
  @MaxLength(100)
  barcode?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity: number;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  batchNumber?: string;

  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @IsOptional()
  @IsUUID()
  locationId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}

export class CreateGoodsReceiptDto {
  @IsUUID()
  companyId: string;

  @IsUUID()
  warehouseId: string;

  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  reference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => GoodsReceiptLineDto)
  lines: GoodsReceiptLineDto[];
}

// ---- Pick list (picking / packing / dispatch) --------------------

class PickListLineDto {
  @IsOptional()
  @IsUUID()
  productId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  barcode?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantityRequested: number;

  @IsOptional()
  @IsUUID()
  locationId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}

export class CreatePickListDto {
  @IsUUID()
  companyId: string;

  @IsUUID()
  warehouseId: string;

  // Either supply an orderId (lines are copied from the order's items) or
  // supply lines directly.
  @IsOptional()
  @IsUUID()
  orderId?: string;

  @IsOptional()
  @IsUUID()
  assignedToEmployeeId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  reference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PickListLineDto)
  lines?: PickListLineDto[];
}

export class AssignPickListDto {
  @IsUUID()
  assignedToEmployeeId: string;
}

class PickQuantityDto {
  @IsUUID()
  lineId: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  quantityPicked: number;
}

export class PickDto {
  // Omit to pick every line in full; supply to record short / partial picks.
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PickQuantityDto)
  lines?: PickQuantityDto[];
}

// ---- Stock count (count + reconciliation) -----------------------

class StockCountLineDto {
  @IsOptional()
  @IsUUID()
  productId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  barcode?: string;

  @IsOptional()
  @IsUUID()
  locationId?: string;
}

export class CreateStockCountDto {
  @IsUUID()
  companyId: string;

  @IsUUID()
  warehouseId: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  reference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  // 'full' snapshots every product that currently has a balance in the
  // warehouse; otherwise supply the lines to count.
  @IsOptional()
  @IsIn(['full', 'partial'])
  scope?: 'full' | 'partial';

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StockCountLineDto)
  lines?: StockCountLineDto[];
}

export class AddStockCountLinesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => StockCountLineDto)
  lines: StockCountLineDto[];
}

export class SetCountedQuantityDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  countedQuantity: number;
}
