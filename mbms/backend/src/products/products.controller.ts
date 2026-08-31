import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/strategies/jwt.strategy';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { ProductsService } from './products.service';
import { CreateProductCategoryDto, CreateProductDto, UpdateProductDto } from './dto/product.dto';

// Base path /api/v1/products — 09_API Specification, Section 8.
@Controller('products')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQueryDto,
    @Query('filter[companyId]') companyId?: string,
    @Query('filter[categoryId]') categoryId?: string,
    @Query('filter[status]') status?: string,
  ) {
    return this.productsService.list(user, query.page, query.pageSize, { companyId, categoryId, status });
  }

  @Post()
  @RequirePermission('product.manage')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateProductDto) {
    return this.productsService.create(user, dto);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.productsService.get(user, id);
  }

  @Patch(':id')
  @RequirePermission('product.manage')
  update(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateProductDto) {
    return this.productsService.update(user, id, dto);
  }
}

// Base path /api/v1/product-categories — 09_API Specification, Section 8.
@Controller('product-categories')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ProductCategoriesController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query('companyId', ParseUUIDPipe) companyId: string) {
    return this.productsService.listCategories(user, companyId);
  }

  @Post()
  @RequirePermission('product.manage')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateProductCategoryDto) {
    return this.productsService.createCategory(user, dto);
  }
}
