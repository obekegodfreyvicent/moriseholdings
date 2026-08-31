import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNumberString, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreateProductDto {
  @IsUUID()
  companyId: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsString()
  productCode: string;

  @IsOptional()
  @IsIn(['good', 'service'])
  productType?: 'good' | 'service';

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  unitOfMeasure?: string;

  @IsOptional()
  @IsString()
  barcode?: string;

  // Sprint 16 (Customer Storefront) — nullable at the schema level, but a
  // customer never sees a product with no price (CustomerCatalogService
  // filters unitPrice: {not: null}), so staff should set this whenever a
  // product is meant to be sold through the storefront.
  @IsOptional()
  @IsNumberString()
  unitPrice?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  stockQuantity?: number;
}

export class UpdateProductDto {
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsIn(['good', 'service'])
  productType?: 'good' | 'service';

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  unitOfMeasure?: string;

  @IsOptional()
  @IsString()
  barcode?: string;

  @IsOptional()
  @IsNumberString()
  unitPrice?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  stockQuantity?: number;

  @IsOptional()
  @IsIn(['active', 'inactive'])
  status?: 'active' | 'inactive';
}

export class CreateProductCategoryDto {
  @IsUUID()
  companyId: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsUUID()
  parentCategoryId?: string;
}
