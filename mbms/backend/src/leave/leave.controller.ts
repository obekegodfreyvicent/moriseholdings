import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/strategies/jwt.strategy';
import { LeaveService } from './leave.service';
import { RejectLeaveDto, SetLeaveBalanceDto, SubmitLeaveDto } from './dto/leave.dto';

const MANAGE = 'leave.manage';
const APPROVE = 'leave.approve';

// Base path /api/v1/leave — HR Module deepening, 19 August 2026.
@Controller('leave')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class LeaveController {
  constructor(private readonly leaveService: LeaveService) {}

  @Get('balances')
  listBalances(@CurrentUser() user: AuthenticatedUser, @Query('filter[employeeId]') employeeId?: string) {
    return this.leaveService.listBalances(user, employeeId);
  }

  @Post('balances')
  @RequirePermission(MANAGE)
  setBalance(@CurrentUser() user: AuthenticatedUser, @Body() dto: SetLeaveBalanceDto) {
    return this.leaveService.setBalance(user, dto);
  }

  @Get('applications')
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('filter[companyId]') companyId?: string,
    @Query('filter[employeeId]') employeeId?: string,
    @Query('filter[status]') status?: string,
  ) {
    return this.leaveService.list(user, { companyId, employeeId, status });
  }

  @Post('applications')
  submit(@CurrentUser() user: AuthenticatedUser, @Body() dto: SubmitLeaveDto) {
    return this.leaveService.submit(user, dto);
  }

  @Post('applications/:id/approve')
  @RequirePermission(APPROVE)
  approve(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.leaveService.approve(user, id);
  }

  @Post('applications/:id/reject')
  @RequirePermission(APPROVE)
  reject(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RejectLeaveDto) {
    return this.leaveService.reject(user, id, dto);
  }

  @Post('applications/:id/cancel')
  cancel(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.leaveService.cancel(user, id);
  }

  // No @RequirePermission here — LeaveService.calendar itself checks
  // isCompanyInScope (group-wide OR the caller's own scope), the same
  // pattern GET /dashboard/companies/{id} already uses, so a scoped HR
  // Manager can see their own company's calendar without needing
  // leave.viewAll specifically.
  @Get('calendar')
  calendar(
    @CurrentUser() user: AuthenticatedUser,
    @Query('companyId', ParseUUIDPipe) companyId: string,
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
  ) {
    return this.leaveService.calendar(user, companyId, dateFrom, dateTo);
  }
}
