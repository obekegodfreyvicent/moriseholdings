import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/strategies/jwt.strategy';
import { PerformanceService } from './performance.service';
import {
  CreateCycleDto,
  CreateObjectiveDto,
  CreateReviewDto,
  SetObjectiveStatusDto,
  SubmitManagerAssessmentDto,
  SubmitSelfAssessmentDto,
} from './dto/performance.dto';

const MANAGE = 'performance.manage';

// Base path /api/v1/performance — HR Module deepening, 19 August 2026.
@Controller('performance')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PerformanceController {
  constructor(private readonly performanceService: PerformanceService) {}

  @Get('cycles')
  listCycles(@CurrentUser() user: AuthenticatedUser, @Query('filter[companyId]') companyId?: string) {
    return this.performanceService.listCycles(user, companyId);
  }

  @Post('cycles')
  @RequirePermission(MANAGE)
  createCycle(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateCycleDto) {
    return this.performanceService.createCycle(user, dto);
  }

  @Post('cycles/:id/close')
  @RequirePermission(MANAGE)
  closeCycle(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.performanceService.closeCycle(user, id);
  }

  @Get('objectives')
  listObjectives(@CurrentUser() user: AuthenticatedUser, @Query('filter[cycleId]') cycleId?: string, @Query('filter[employeeId]') employeeId?: string) {
    return this.performanceService.listObjectives(user, { cycleId, employeeId });
  }

  @Post('objectives')
  @RequirePermission(MANAGE)
  createObjective(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateObjectiveDto) {
    return this.performanceService.createObjective(user, dto);
  }

  @Post('objectives/:id/status')
  @RequirePermission(MANAGE)
  setObjectiveStatus(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SetObjectiveStatusDto) {
    return this.performanceService.setObjectiveStatus(user, id, dto);
  }

  @Get('reviews')
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('filter[companyId]') companyId?: string,
    @Query('filter[employeeId]') employeeId?: string,
    @Query('filter[cycleId]') cycleId?: string,
  ) {
    return this.performanceService.list(user, { companyId, employeeId, cycleId });
  }

  @Post('reviews')
  @RequirePermission(MANAGE)
  createReview(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateReviewDto) {
    return this.performanceService.createReview(user, dto);
  }

  @Get('reviews/:id')
  getReview(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.performanceService.getReview(user, id);
  }

  @Post('reviews/:id/self-assessment')
  submitSelfAssessment(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SubmitSelfAssessmentDto) {
    return this.performanceService.submitSelfAssessment(user, id, dto);
  }

  @Post('reviews/:id/manager-assessment')
  @RequirePermission(MANAGE)
  submitManagerAssessment(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SubmitManagerAssessmentDto) {
    return this.performanceService.submitManagerAssessment(user, id, dto);
  }
}
