import { Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/strategies/jwt.strategy';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { NotificationsService } from '../common/notifications/notifications.service';
import { AlertsService } from '../alerts/alerts.service';

// Base path /api/v1/notifications — Sprint 14. No @RequirePermission
// anywhere here: every authenticated user reads and manages only their own
// notification feed (scoped implicitly by userId in the service, never a
// caller-supplied parameter), so there is nothing to permission-gate
// beyond being logged in.
//
// Notifications & Alerts (2 September 2026): every read path first mirrors
// the caller's live Alerts feed onto their bell, filtered to their
// department, so time-sensitive items "pop up" as notifications without a
// scheduler. The sync is best-effort and throttled inside AlertsService.
@Controller('notifications')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly alerts: AlertsService,
  ) {}

  @Get()
  async list(@CurrentUser() user: AuthenticatedUser, @Query() query: PaginationQueryDto, @Query('unreadOnly') unreadOnly?: string) {
    await this.syncAlerts(user);
    return this.notificationsService.list(user.id, query.page, query.pageSize, unreadOnly === 'true');
  }

  @Get('unread-count')
  async unreadCount(@CurrentUser() user: AuthenticatedUser) {
    await this.syncAlerts(user);
    return { count: await this.notificationsService.unreadCount(user.id) };
  }

  @Post(':id/read')
  markRead(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.notificationsService.markRead(user.id, id);
  }

  @Post('read-all')
  markAllRead(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.markAllRead(user.id);
  }

  private async syncAlerts(user: AuthenticatedUser): Promise<void> {
    // Never let an alert-mirroring hiccup break the notification feed itself.
    try {
      await this.alerts.syncToNotifications(user);
    } catch {
      /* swallowed — AlertsService already logs */
    }
  }
}
