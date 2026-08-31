import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/strategies/jwt.strategy';
import { ShiftSchedulingService } from './shift-scheduling.service';
import { CreateRosterEntryDto, PublishRosterDto } from './dto/shift-scheduling.dto';

// Base path /api/v1/shift-scheduling — the Admin "Shift Scheduling" section
// (28 August 2026). Roster entries reuse the attendance module's permissions:
// attendance.viewAll to view, attendance.manage to build and publish.
@Controller('shift-scheduling')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('attendance.manage', 'attendance.viewAll')
export class ShiftSchedulingController {
  constructor(private readonly service: ShiftSchedulingService) {}

  @Get('entries')
  listEntries(
    @CurrentUser() user: AuthenticatedUser,
    @Query('companyId') companyId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.listEntries(user, { companyId: companyId || undefined, from, to });
  }

  @Post('entries')
  @RequirePermission('attendance.manage')
  createEntry(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateRosterEntryDto) {
    return this.service.createEntry(user, dto);
  }

  @Delete('entries/:id')
  @RequirePermission('attendance.manage')
  removeEntry(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.removeEntry(user, id);
  }

  @Post('publish')
  @RequirePermission('attendance.manage')
  publish(@CurrentUser() user: AuthenticatedUser, @Body() dto: PublishRosterDto) {
    return this.service.publish(user, dto);
  }

  @Get('coverage')
  coverage(
    @CurrentUser() user: AuthenticatedUser,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('companyId') companyId?: string,
  ) {
    return this.service.coverage(user, { companyId: companyId || undefined, from, to });
  }
}
