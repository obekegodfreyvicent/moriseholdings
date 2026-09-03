import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/strategies/jwt.strategy';
import { MyHrService } from './my-hr.service';
import { RequestMyAdvanceDto } from './dto/my-hr.dto';

// Base path /api/v1/my-hr — employee self-service (28 August 2026). Any
// authenticated staff user; the data is scoped to their own linked Employee
// record. No permission is required — these are "my own" reads and the one
// "request an advance for myself" action.
@Controller('my-hr')
@UseGuards(JwtAuthGuard)
export class MyHrController {
  constructor(private readonly myHr: MyHrService) {}

  @Get('summary')
  summary(@CurrentUser() user: AuthenticatedUser) {
    return this.myHr.summary(user);
  }

  @Get('attendance')
  attendance(@CurrentUser() user: AuthenticatedUser, @Query('from') from?: string, @Query('to') to?: string) {
    return this.myHr.attendance(user, from, to);
  }

  @Get('leave')
  leave(@CurrentUser() user: AuthenticatedUser) {
    return this.myHr.leave(user);
  }

  @Get('shifts')
  shifts(@CurrentUser() user: AuthenticatedUser, @Query('from') from?: string, @Query('to') to?: string) {
    return this.myHr.shifts(user, from, to);
  }

  @Get('performance')
  performance(@CurrentUser() user: AuthenticatedUser) {
    return this.myHr.performance(user);
  }

  @Get('payslips')
  payslips(@CurrentUser() user: AuthenticatedUser) {
    return this.myHr.payslips(user);
  }

  @Get('id-card')
  idCard(@CurrentUser() user: AuthenticatedUser) {
    return this.myHr.idCard(user);
  }

  @Get('salary-advances')
  salaryAdvances(@CurrentUser() user: AuthenticatedUser) {
    return this.myHr.salaryAdvances(user);
  }

  @Post('salary-advances')
  requestAdvance(@CurrentUser() user: AuthenticatedUser, @Body() dto: RequestMyAdvanceDto) {
    return this.myHr.requestSalaryAdvance(user, dto);
  }
}
