import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/strategies/jwt.strategy';
import { DashboardService } from './dashboard.service';

// Base path /api/v1/dashboard — 09_API Specification, Section 10.
@Controller('dashboard')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  @RequirePermission('organization.company.viewAll')
  summary() {
    return this.dashboardService.summary();
  }

  @Get('accounting-summary')
  @RequirePermission('accounting.viewAll')
  accountingSummary() {
    return this.dashboardService.accountingSummary();
  }

  // Dashboard deepening (19 August 2026): group-wide financial position
  // (assets/liabilities/equity, cash/bank, receivables/payables, revenue/
  // expense/net profit) — same accounting.viewAll gate as
  // accounting-summary above, since it exposes the same class of ledger
  // data.
  @Get('financials')
  @RequirePermission('accounting.viewAll')
  financials() {
    return this.dashboardService.financials();
  }

  // Monthly revenue/expense/profit-and-loss/cash-flow chart series,
  // trailing 6 months, group-wide.
  @Get('charts')
  @RequirePermission('accounting.viewAll')
  charts() {
    return this.dashboardService.charts();
  }

  // Financial + operational alerts. Guarded at organization.company.viewAll
  // (a Group-level view); the financial half additionally checks
  // accounting.viewAll internally before including ledger-derived alerts.
  @Get('alerts')
  @RequirePermission('organization.company.viewAll')
  alerts(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboardService.alerts(user);
  }

  @Get('companies/:id')
  companyDashboard(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.dashboardService.companyDashboard(user, id);
  }

  @Get('recent-activity')
  @RequirePermission('audit.view')
  recentActivity() {
    return this.dashboardService.recentActivity();
  }
}
