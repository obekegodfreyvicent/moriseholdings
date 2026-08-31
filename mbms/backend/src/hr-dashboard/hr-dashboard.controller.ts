import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/strategies/jwt.strategy';
import { HrDashboardService } from './hr-dashboard.service';

// Base path /api/v1/hr — the Admin "HR Dashboard" section (28 August 2026).
// Read-only; visible to any holder of an HR "viewAll" permission.
@Controller('hr')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class HrDashboardController {
  constructor(private readonly hrDashboardService: HrDashboardService) {}

  @Get('dashboard')
  @RequirePermission(
    'employee.viewAll',
    'recruitment.viewAll',
    'attendance.viewAll',
    'leave.viewAll',
    'performance.viewAll',
  )
  dashboard(@CurrentUser() user: AuthenticatedUser) {
    return this.hrDashboardService.overview(user);
  }
}
