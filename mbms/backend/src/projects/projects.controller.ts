import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/strategies/jwt.strategy';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { ProjectsService } from './projects.service';
import {
  AddTeamMemberDto,
  CreateMilestoneDto,
  CreateProjectDto,
  CreateTaskDto,
  RemoveTeamMemberDto,
  UpdateProjectDto,
  UpdateTaskDto,
} from './dto/project.dto';

// Base path /api/v1/projects — Sprint 12 (Phase 2: Project Management).
@Controller('projects')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQueryDto,
    @Query('filter[companyId]') companyId?: string,
    @Query('filter[status]') status?: string,
  ) {
    return this.projectsService.list(user, query.page, query.pageSize, { companyId, status });
  }

  @Post()
  @RequirePermission('project.manage')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateProjectDto) {
    return this.projectsService.create(user, dto);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.projectsService.get(user, id);
  }

  @Patch(':id')
  @RequirePermission('project.manage')
  update(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateProjectDto) {
    return this.projectsService.update(user, id, dto);
  }

  @Get(':id/team')
  listTeam(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.projectsService.listTeam(user, id);
  }

  @Post(':id/team')
  @RequirePermission('project.manage')
  addTeamMember(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AddTeamMemberDto) {
    return this.projectsService.addTeamMember(user, id, dto);
  }

  @Post(':id/team/remove')
  @RequirePermission('project.manage')
  removeTeamMember(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RemoveTeamMemberDto) {
    return this.projectsService.removeTeamMember(user, id, dto);
  }

  @Get(':id/tasks')
  listTasks(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.projectsService.listTasks(user, id);
  }

  @Post(':id/tasks')
  @RequirePermission('project.manage')
  createTask(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateTaskDto) {
    return this.projectsService.createTask(user, id, dto);
  }

  @Patch(':id/tasks/:taskId')
  @RequirePermission('project.manage')
  updateTask(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.projectsService.updateTask(user, id, taskId, dto);
  }

  @Get(':id/milestones')
  listMilestones(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.projectsService.listMilestones(user, id);
  }

  @Post(':id/milestones')
  @RequirePermission('project.manage')
  createMilestone(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateMilestoneDto) {
    return this.projectsService.createMilestone(user, id, dto);
  }

  @Post(':id/milestones/:milestoneId/complete')
  @RequirePermission('project.manage')
  completeMilestone(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('milestoneId', ParseUUIDPipe) milestoneId: string,
  ) {
    return this.projectsService.completeMilestone(user, id, milestoneId);
  }

  @Post(':id/activate')
  @RequirePermission('project.manage')
  activate(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.projectsService.transition(user, id, 'activate');
  }

  @Post(':id/hold')
  @RequirePermission('project.manage')
  hold(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.projectsService.transition(user, id, 'hold');
  }

  @Post(':id/resume')
  @RequirePermission('project.manage')
  resume(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.projectsService.transition(user, id, 'resume');
  }

  @Post(':id/complete')
  @RequirePermission('project.manage')
  complete(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.projectsService.transition(user, id, 'complete');
  }

  @Post(':id/close')
  @RequirePermission('project.manage')
  close(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.projectsService.transition(user, id, 'close');
  }

  @Get(':id/profitability')
  profitability(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.projectsService.profitability(user, id);
  }
}
