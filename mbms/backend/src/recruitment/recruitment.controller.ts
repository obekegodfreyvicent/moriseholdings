import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/strategies/jwt.strategy';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { RecruitmentService } from './recruitment.service';
import {
  CompleteInterviewDto,
  CreateApplicationDto,
  CreateInterviewDto,
  CreateOfferDto,
  CreateVacancyDto,
  RejectApplicationDto,
  RespondOfferDto,
  UpdateVacancyDto,
} from './dto/recruitment.dto';

const MANAGE = 'recruitment.manage';
const APPROVE = 'recruitment.approve';

// Base path /api/v1/recruitment — HR Module deepening, 19 August 2026.
@Controller('recruitment')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RecruitmentController {
  constructor(private readonly recruitmentService: RecruitmentService) {}

  @Get('vacancies')
  listVacancies(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQueryDto,
    @Query('filter[companyId]') companyId?: string,
    @Query('filter[status]') status?: string,
  ) {
    return this.recruitmentService.listVacancies(user, query.page, query.pageSize, { companyId, status });
  }

  @Post('vacancies')
  @RequirePermission(MANAGE)
  createVacancy(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateVacancyDto) {
    return this.recruitmentService.createVacancy(user, dto);
  }

  @Get('vacancies/:id')
  getVacancy(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.recruitmentService.getVacancy(user, id);
  }

  @Patch('vacancies/:id')
  @RequirePermission(MANAGE)
  updateVacancy(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateVacancyDto) {
    return this.recruitmentService.updateVacancy(user, id, dto);
  }

  @Post('vacancies/:id/submit-for-approval')
  @RequirePermission(MANAGE)
  submitVacancyForApproval(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.recruitmentService.submitVacancyForApproval(user, id);
  }

  @Post('vacancies/:id/approve')
  @RequirePermission(APPROVE)
  approveVacancy(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.recruitmentService.approveVacancy(user, id);
  }

  @Post('vacancies/:id/close')
  @RequirePermission(MANAGE)
  closeVacancy(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.recruitmentService.closeVacancy(user, id);
  }

  @Get('vacancies/:id/applications')
  listApplications(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.recruitmentService.listApplications(user, id);
  }

  @Post('vacancies/:id/applications')
  @RequirePermission(MANAGE)
  createApplication(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateApplicationDto) {
    return this.recruitmentService.createApplication(user, id, dto);
  }

  @Get('applications/:id')
  getApplication(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.recruitmentService.getApplication(user, id);
  }

  @Post('applications/:id/shortlist')
  @RequirePermission(MANAGE)
  shortlistApplication(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.recruitmentService.shortlistApplication(user, id);
  }

  @Post('applications/:id/reject')
  @RequirePermission(MANAGE)
  rejectApplication(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RejectApplicationDto) {
    return this.recruitmentService.rejectApplication(user, id, dto);
  }

  @Post('applications/:id/interviews')
  @RequirePermission(MANAGE)
  createInterview(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateInterviewDto) {
    return this.recruitmentService.createInterview(user, id, dto);
  }

  @Post('interviews/:id/complete')
  @RequirePermission(MANAGE)
  completeInterview(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CompleteInterviewDto) {
    return this.recruitmentService.completeInterview(user, id, dto);
  }

  @Post('applications/:id/offer')
  @RequirePermission(MANAGE)
  createOffer(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateOfferDto) {
    return this.recruitmentService.createOffer(user, id, dto);
  }

  @Post('offers/:id/respond')
  @RequirePermission(MANAGE)
  respondOffer(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RespondOfferDto) {
    return this.recruitmentService.respondOffer(user, id, dto);
  }

  @Post('offers/:id/onboard')
  @RequirePermission(MANAGE)
  onboard(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.recruitmentService.onboard(user, id);
  }
}
