import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/strategies/jwt.strategy';
import { FinancialPeriodsService } from './financial-periods.service';
import { CloseFinancialPeriodDto, CreateFinancialPeriodDto } from './dto/financial-period.dto';

// Base path /api/v1/accounting/financial-periods — 09_API Specification, Section 9.
@Controller('accounting/financial-periods')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class FinancialPeriodsController {
  constructor(private readonly periodsService: FinancialPeriodsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query('companyId', ParseUUIDPipe) companyId: string) {
    return this.periodsService.list(user, companyId);
  }

  @Post()
  @RequirePermission('accounting.manage')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateFinancialPeriodDto) {
    return this.periodsService.create(user, dto);
  }

  @Post(':id/close')
  @RequirePermission('accounting.manage')
  close(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CloseFinancialPeriodDto) {
    return this.periodsService.close(user, id, dto);
  }
}
