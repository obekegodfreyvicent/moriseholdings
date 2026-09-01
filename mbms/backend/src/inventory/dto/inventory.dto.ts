import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
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
} from 'class-validator';

// Inventory section (28 August 2026). A stock adjustment records one change
// to a product's on-hand quantity:
//   • receipt — goods received into stock (adds `quantity`)
//   • issue   — goods issued out of stock (subtracts `quantity`)
//   • count   — a physical count correction: `quantity` is the counted
//               absolute figure, and the movement stores the signed
//               difference from the previous on-hand.
export const STOCK_MOVEMENT_TYPES = ['receipt', 'issue', 'count'] as const;
export type StockMovementTypeDto = (typeof STOCK_MOVEMENT_TYPES)[number];

export class AdjustStockDto {
  @IsUUID()
  productId: string;

  @IsIn(STOCK_MOVEMENT_TYPES)
  movementType: StockMovementTypeDto;

  // receipt / issue: how many units moved (> 0, enforced in the service).
  // count: the counted total on the shelf (0 is valid).
  @Type(() => Number)
  @IsInt()
  @Min(0)
  quantity: number;

  // Inventory Management (1 September 2026): which warehouse the change lands
  // in. Omitted → the company's default (MAIN) warehouse.
  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  // receipt only, batch-tracked products: record / top up a batch and its
  // optional expiry date.
  @IsOptional()
  @IsString()
  @MaxLength(80)
  batchNumber?: string;

  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  // receipt / issue, serial-tracked products: the serial numbers received
  // (created as in_stock) or issued (flipped to issued).
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @IsString({ each: true })
  serialNumbers?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  reference?: string;
}

export class SetReorderPointDto {
  // null clears the threshold; a number (>= 0) sets it.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  reorderPoint?: number | null;
}

// Inventory Management (1 September 2026): set the re-order point together
// with the minimum / maximum stock levels and the batch / serial flags.
// Any omitted field is left unchanged; sending an explicit null clears a
// numeric threshold.
export class SetStockLevelsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  reorderPoint?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minStockLevel?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxStockLevel?: number | null;

  @IsOptional()
  @IsBoolean()
  trackBatches?: boolean;

  @IsOptional()
  @IsBoolean()
  trackSerials?: boolean;
}

export class CreateWarehouseDto {
  @IsUUID()
  companyId: string;

  @IsString()
  @MaxLength(30)
  code: string;

  @IsString()
  @MaxLength(150)
  name: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;
}

export class UpdateWarehouseDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  name?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateStockLocationDto {
  @IsString()
  @MaxLength(30)
  code: string;

  @IsString()
  @MaxLength(150)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class UpdateStockLocationDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class TransferStockDto {
  @IsUUID()
  productId: string;

  @IsUUID()
  fromWarehouseId: string;

  @IsUUID()
  toWarehouseId: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  reference?: string;
}

export class ReturnStockDto {
  @IsUUID()
  productId: string;

  @IsUUID()
  warehouseId: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  reference?: string;
}
