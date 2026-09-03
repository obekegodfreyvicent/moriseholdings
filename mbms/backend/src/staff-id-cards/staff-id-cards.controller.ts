import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/strategies/jwt.strategy';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { StaffIdCardsService } from './staff-id-cards.service';
import { GenerateCardsDto, IssueCardDto, ReissueCardDto, RevokeCardDto, UpdateCardDto } from './dto/staff-id-card.dto';

// Base path /api/v1/staff-id-cards — Automatic Staff Identification Card
// (3 September 2026). Reads need employee.idcard.manage OR
// employee.idcard.viewAll; every mutation needs employee.idcard.manage.
// The card feed is scoped to the caller's company scope (BR-01) unless they
// hold employee.idcard.viewAll.
@Controller('staff-id-cards')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class StaffIdCardsController {
  constructor(private readonly cards: StaffIdCardsService) {}

  @Get()
  @RequirePermission('employee.idcard.manage', 'employee.idcard.viewAll')
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQueryDto,
    @Query('filter[companyId]') companyId?: string,
    @Query('filter[status]') status?: string,
    @Query('filter[employeeId]') employeeId?: string,
    @Query('filter[search]') search?: string,
  ) {
    return this.cards.list(user, query.page, query.pageSize, { companyId, status, employeeId, search });
  }

  @Get('summary')
  @RequirePermission('employee.idcard.manage', 'employee.idcard.viewAll')
  summary(@CurrentUser() user: AuthenticatedUser, @Query('filter[companyId]') companyId?: string) {
    return this.cards.summary(user, companyId);
  }

  @Get('verify/:code')
  @RequirePermission('employee.idcard.manage', 'employee.idcard.viewAll')
  verify(@CurrentUser() user: AuthenticatedUser, @Param('code') code: string) {
    return this.cards.verify(user, code);
  }

  @Get('by-employee/:employeeId')
  @RequirePermission('employee.idcard.manage', 'employee.idcard.viewAll')
  byEmployee(@CurrentUser() user: AuthenticatedUser, @Param('employeeId', ParseUUIDPipe) employeeId: string) {
    return this.cards.getByEmployee(user, employeeId);
  }

  @Post('generate')
  @RequirePermission('employee.idcard.manage')
  generate(@CurrentUser() user: AuthenticatedUser, @Body() dto: GenerateCardsDto) {
    return this.cards.generate(user, dto);
  }

  @Post()
  @RequirePermission('employee.idcard.manage')
  issue(@CurrentUser() user: AuthenticatedUser, @Body() dto: IssueCardDto) {
    return this.cards.issue(user, dto);
  }

  @Get(':id')
  @RequirePermission('employee.idcard.manage', 'employee.idcard.viewAll')
  get(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.cards.get(user, id);
  }

  @Patch(':id')
  @RequirePermission('employee.idcard.manage')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCardDto,
  ) {
    return this.cards.update(user, id, dto);
  }

  @Post(':id/reissue')
  @RequirePermission('employee.idcard.manage')
  reissue(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReissueCardDto,
  ) {
    return this.cards.reissue(user, id, dto);
  }

  @Post(':id/revoke')
  @RequirePermission('employee.idcard.manage')
  revoke(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RevokeCardDto,
  ) {
    return this.cards.revoke(user, id, dto);
  }

  @Post(':id/restore')
  @RequirePermission('employee.idcard.manage')
  restore(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.cards.restore(user, id);
  }
}
