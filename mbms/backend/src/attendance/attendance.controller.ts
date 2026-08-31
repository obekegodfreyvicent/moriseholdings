import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/strategies/jwt.strategy';
import { AttendanceService } from './attendance.service';
import { AssignShiftDto, ClockDto, CreateShiftDto, MarkAbsentDto } from './dto/attendance.dto';

const MANAGE = 'attendance.manage';

// Base path /api/v1/attendance — HR Module deepening, 19 August 2026.
@Controller('attendance')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Post('clock-in')
  clockIn(@CurrentUser() user: AuthenticatedUser, @Body() dto: ClockDto) {
    return this.attendanceService.clockIn(user, dto);
  }

  @Post('clock-out')
  clockOut(@CurrentUser() user: AuthenticatedUser, @Body() dto: ClockDto) {
    return this.attendanceService.clockOut(user, dto);
  }

  @Post('mark-absent')
  @RequirePermission(MANAGE)
  markAbsent(@CurrentUser() user: AuthenticatedUser, @Body() dto: MarkAbsentDto) {
    return this.attendanceService.markAbsent(user, dto);
  }

  @Get('records')
  listRecords(
    @CurrentUser() user: AuthenticatedUser,
    @Query('filter[companyId]') companyId?: string,
    @Query('filter[employeeId]') employeeId?: string,
    @Query('filter[dateFrom]') dateFrom?: string,
    @Query('filter[dateTo]') dateTo?: string,
  ) {
    return this.attendanceService.listRecords(user, { companyId, employeeId, dateFrom, dateTo });
  }

  @Get('summary')
  summary(
    @CurrentUser() user: AuthenticatedUser,
    @Query('filter[companyId]') companyId?: string,
    @Query('filter[dateFrom]') dateFrom?: string,
    @Query('filter[dateTo]') dateTo?: string,
  ) {
    return this.attendanceService.summary(user, { companyId, dateFrom, dateTo });
  }

  @Get('shifts')
  listShifts(@CurrentUser() user: AuthenticatedUser, @Query('filter[companyId]') companyId?: string) {
    return this.attendanceService.listShifts(user, companyId);
  }

  @Post('shifts')
  @RequirePermission(MANAGE)
  createShift(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateShiftDto) {
    return this.attendanceService.createShift(user, dto);
  }

  @Patch('employees/:employeeId/shift')
  @RequirePermission(MANAGE)
  assignShift(@CurrentUser() user: AuthenticatedUser, @Param('employeeId', ParseUUIDPipe) employeeId: string, @Body() dto: AssignShiftDto) {
    return this.attendanceService.assignShift(user, employeeId, dto);
  }
}
