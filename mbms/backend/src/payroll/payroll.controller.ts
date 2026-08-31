import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/strategies/jwt.strategy';
import { PayrollService } from './payroll.service';
import { CreatePayrollRunDto, RejectDto, RequestSalaryAdvanceDto } from './dto/payroll.dto';

// Base path /api/v1/payroll — the Admin "Payroll" section (28 August 2026).
// Read: payroll.viewAll / manage / approve. Create a run or request an
// advance: payroll.manage. Approve / pay / approve-advance: payroll.approve.
@Controller('payroll')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('payroll.manage', 'payroll.approve', 'payroll.viewAll')
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  @Get('runs')
  listRuns(@CurrentUser() user: AuthenticatedUser, @Query('companyId') companyId?: string) {
    return this.payrollService.listRuns(user, companyId || undefined);
  }

  @Get('runs/:id')
  getRun(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.payrollService.getRun(user, id);
  }

  @Post('runs')
  @RequirePermission('payroll.manage')
  createRun(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreatePayrollRunDto) {
    return this.payrollService.createRun(user, dto);
  }

  @Post('runs/:id/approve')
  @RequirePermission('payroll.approve')
  approveRun(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.payrollService.approveRun(user, id);
  }

  @Post('runs/:id/pay')
  @RequirePermission('payroll.approve')
  payRun(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.payrollService.payRun(user, id);
  }

  @Post('runs/:id/cancel')
  @RequirePermission('payroll.manage')
  cancelRun(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.payrollService.cancelRun(user, id);
  }

  @Get('salary-advances')
  listAdvances(
    @CurrentUser() user: AuthenticatedUser,
    @Query('companyId') companyId?: string,
    @Query('employeeId') employeeId?: string,
  ) {
    return this.payrollService.listAdvances(user, { companyId: companyId || undefined, employeeId: employeeId || undefined });
  }

  @Post('salary-advances')
  @RequirePermission('payroll.manage')
  requestAdvance(@CurrentUser() user: AuthenticatedUser, @Body() dto: RequestSalaryAdvanceDto) {
    return this.payrollService.requestAdvance(user, dto);
  }

  @Post('salary-advances/:id/approve')
  @RequirePermission('payroll.approve')
  approveAdvance(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.payrollService.approveAdvance(user, id);
  }

  @Post('salary-advances/:id/reject')
  @RequirePermission('payroll.approve')
  rejectAdvance(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectDto,
  ) {
    return this.payrollService.rejectAdvance(user, id, dto);
  }
}
