import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsDateString, IsEnum, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min, ValidateNested } from 'class-validator';
import { PaymentMethod } from '@prisma/client';

class OrderItemInputDto {
  @IsUUID()
  productId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}

export class CreateOrderDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OrderItemInputDto)
  items!: OrderItemInputDto[];

  @IsOptional()
  @IsUUID()
  deliveryAddressId?: string;

  @IsOptional()
  @IsDateString()
  requestedDeliveryDate?: string;

  // Captured as stated intent only — see OrdersService.createForCustomer's
  // judgment-call comment for why this never drives GL posting directly.
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethodPreference?: PaymentMethod;

  // Marketing & Promos (28 August 2026): an optional storefront discount
  // code. Re-validated server-side at placement and redeemed once.
  @IsOptional()
  @IsString()
  @MaxLength(40)
  discountCode?: string;
}
