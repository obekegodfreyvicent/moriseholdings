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
import { MarketingService } from './marketing.service';
import {
  CreateBannerDto,
  CreateDiscountCodeDto,
  UpdateBannerDto,
  UpdateDiscountCodeDto,
} from './dto/marketing.dto';

// Base path /api/v1/marketing — the Admin "Marketing & Promos" section
// (28 August 2026). Reads need marketing.viewAll or marketing.manage;
// writes need marketing.manage. Per-company, scoped per BR-01.
@Controller('marketing')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('marketing.manage', 'marketing.viewAll')
export class MarketingController {
  constructor(private readonly marketingService: MarketingService) {}

  @Get('discount-codes')
  listCodes(@CurrentUser() user: AuthenticatedUser, @Query('companyId') companyId?: string) {
    return this.marketingService.listDiscountCodes(user, companyId || undefined);
  }

  @Post('discount-codes')
  @RequirePermission('marketing.manage')
  createCode(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateDiscountCodeDto) {
    return this.marketingService.createDiscountCode(user, dto);
  }

  @Patch('discount-codes/:id')
  @RequirePermission('marketing.manage')
  updateCode(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDiscountCodeDto,
  ) {
    return this.marketingService.updateDiscountCode(user, id, dto);
  }

  @Post('discount-codes/:id/activate')
  @RequirePermission('marketing.manage')
  activateCode(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.marketingService.setDiscountStatus(user, id, 'active');
  }

  @Post('discount-codes/:id/deactivate')
  @RequirePermission('marketing.manage')
  deactivateCode(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.marketingService.setDiscountStatus(user, id, 'inactive');
  }

  @Delete('discount-codes/:id')
  @RequirePermission('marketing.manage')
  removeCode(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.marketingService.removeDiscountCode(user, id);
  }

  @Get('banners')
  listBanners(@CurrentUser() user: AuthenticatedUser, @Query('companyId') companyId?: string) {
    return this.marketingService.listBanners(user, companyId || undefined);
  }

  @Post('banners')
  @RequirePermission('marketing.manage')
  createBanner(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateBannerDto) {
    return this.marketingService.createBanner(user, dto);
  }

  @Patch('banners/:id')
  @RequirePermission('marketing.manage')
  updateBanner(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBannerDto,
  ) {
    return this.marketingService.updateBanner(user, id, dto);
  }

  @Delete('banners/:id')
  @RequirePermission('marketing.manage')
  removeBanner(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.marketingService.removeBanner(user, id);
  }
}
