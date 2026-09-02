import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/strategies/jwt.strategy';
import { AlertsService } from './alerts.service';

// Base path /api/v1/alerts — Notifications & Alerts (section 39). Any
// authenticated user may read; the feed is filtered to their company scope.
@Controller('alerts')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AlertsController {
  constructor(private readonly alerts: AlertsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('days') days?: string,
    @Query('category') category?: string,
    @Query('severity') severity?: string,
  ) {
    return this.alerts.list(user, {
      days: days ? Number(days) : undefined,
      category: category || undefined,
      severity: severity || undefined,
    });
  }

  @Get('summary')
  summary(@CurrentUser() user: AuthenticatedUser, @Query('days') days?: string) {
    return this.alerts.summary(user, days ? Number(days) : undefined);
  }
}
