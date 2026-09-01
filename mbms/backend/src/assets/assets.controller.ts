import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/strategies/jwt.strategy';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { AssetsService } from './assets.service';
import {
  ApproveDisposalDto,
  CreateAssetCategoryDto,
  CreateAssetDto,
  CreateAssetInspectionDto,
  CreateAssetInsuranceDto,
  CreateMaintenanceRecordDto,
  DisposeAssetDto,
  RecordDepreciationDto,
  RequestDisposalDto,
  TransferAssetDto,
  UpdateAssetCategoryDto,
  UpdateAssetDto,
  UpdateAssetInsuranceDto,
} from './dto/asset.dto';

// Base path /api/v1/assets — Sprint 11 (Phase 2: Asset Management).
@Controller('assets')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQueryDto,
    @Query('filter[companyId]') companyId?: string,
    @Query('filter[status]') status?: string,
    @Query('filter[category]') category?: string,
  ) {
    return this.assetsService.list(user, query.page, query.pageSize, { companyId, status, category });
  }

  @Post()
  @RequirePermission('asset.manage')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateAssetDto) {
    return this.assetsService.create(user, dto);
  }

  // ---- Asset categories (2 September 2026) ------------------------
  @Get('categories')
  listCategories(@CurrentUser() user: AuthenticatedUser, @Query('companyId') companyId?: string) {
    return this.assetsService.listCategories(user, companyId || undefined);
  }

  @Post('categories')
  @RequirePermission('asset.manage')
  createCategory(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateAssetCategoryDto) {
    return this.assetsService.createCategory(user, dto);
  }

  @Patch('categories/:categoryId')
  @RequirePermission('asset.manage')
  updateCategory(
    @CurrentUser() user: AuthenticatedUser,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
    @Body() dto: UpdateAssetCategoryDto,
  ) {
    return this.assetsService.updateCategory(user, categoryId, dto);
  }

  // ---- Reports ---------------------------------------------------
  @Get('reports/register')
  reportRegister(@CurrentUser() user: AuthenticatedUser, @Query('companyId') companyId?: string) {
    return this.assetsService.reportRegister(user, companyId || undefined);
  }

  @Get('reports/depreciation-schedule')
  reportDepreciationSchedule(@CurrentUser() user: AuthenticatedUser, @Query('companyId') companyId?: string) {
    return this.assetsService.reportDepreciationSchedule(user, companyId || undefined);
  }

  @Get('reports/insurance-expiring')
  reportInsuranceExpiring(
    @CurrentUser() user: AuthenticatedUser,
    @Query('companyId') companyId?: string,
    @Query('days') days?: string,
  ) {
    return this.assetsService.reportInsuranceExpiring(user, companyId || undefined, days ? Number(days) : undefined);
  }

  @Get('reports/inspections-due')
  reportInspectionsDue(
    @CurrentUser() user: AuthenticatedUser,
    @Query('companyId') companyId?: string,
    @Query('days') days?: string,
  ) {
    return this.assetsService.reportInspectionsDue(user, companyId || undefined, days ? Number(days) : undefined);
  }

  // ---- Insurance policy update by id --------------------------
  @Patch('insurance/:policyId')
  @RequirePermission('asset.manage')
  updateInsurance(
    @CurrentUser() user: AuthenticatedUser,
    @Param('policyId', ParseUUIDPipe) policyId: string,
    @Body() dto: UpdateAssetInsuranceDto,
  ) {
    return this.assetsService.updateInsurance(user, policyId, dto);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.assetsService.get(user, id);
  }

  @Get(':id/history')
  history(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.assetsService.history(user, id);
  }

  @Get(':id/inspections')
  listInspections(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.assetsService.listInspections(user, id);
  }

  @Post(':id/inspections')
  @RequirePermission('asset.manage')
  addInspection(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateAssetInspectionDto,
  ) {
    return this.assetsService.addInspection(user, id, dto);
  }

  @Get(':id/insurance')
  listInsurance(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.assetsService.listInsurance(user, id);
  }

  @Post(':id/insurance')
  @RequirePermission('asset.manage')
  addInsurance(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateAssetInsuranceDto,
  ) {
    return this.assetsService.addInsurance(user, id, dto);
  }

  @Patch(':id')
  @RequirePermission('asset.manage')
  update(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAssetDto) {
    return this.assetsService.update(user, id, dto);
  }

  @Post(':id/transfer')
  @RequirePermission('asset.manage')
  transfer(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: TransferAssetDto) {
    return this.assetsService.transfer(user, id, dto);
  }

  @Post(':id/record-depreciation')
  @RequirePermission('asset.manage')
  recordDepreciation(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RecordDepreciationDto) {
    return this.assetsService.recordDepreciation(user, id, dto);
  }

  @Post(':id/request-disposal')
  @RequirePermission('asset.manage')
  requestDisposal(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RequestDisposalDto) {
    return this.assetsService.requestDisposal(user, id, dto);
  }

  @Post(':id/approve-disposal')
  @RequirePermission('asset.approve.disposal')
  approveDisposal(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ApproveDisposalDto) {
    return this.assetsService.approveDisposal(user, id, dto);
  }

  @Post(':id/dispose')
  @RequirePermission('asset.approve.disposal')
  dispose(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: DisposeAssetDto) {
    return this.assetsService.dispose(user, id, dto);
  }

  @Get(':id/maintenance-records')
  listMaintenanceRecords(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.assetsService.listMaintenanceRecords(user, id);
  }

  @Post(':id/maintenance-records')
  @RequirePermission('asset.manage')
  addMaintenanceRecord(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateMaintenanceRecordDto) {
    return this.assetsService.addMaintenanceRecord(user, id, dto);
  }
}
