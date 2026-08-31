import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

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
