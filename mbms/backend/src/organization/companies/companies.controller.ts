import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/strategies/jwt.strategy';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { CompaniesService } from './companies.service';
import { CreateCompanyDto, UpdateCompanyDto } from './dto/company.dto';

// Base path /api/v1/organization — 09_API Specification, Section 4.
@Controller('organization/companies')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get()
  @RequirePermission('organization.company.viewAll')
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: PaginationQueryDto) {
    return this.companiesService.list(user, query.page, query.pageSize);
  }

  @Post()
  @RequirePermission('organization.company.manage')
  create(@CurrentUser() actor: AuthenticatedUser, @Body() dto: CreateCompanyDto) {
    return this.companiesService.create(actor, dto);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.companiesService.get(id, user);
  }

  @Patch(':id')
  @RequirePermission('organization.company.manage')
  update(@CurrentUser() actor: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCompanyDto) {
    return this.companiesService.update(actor, id, dto);
  }

  @Post(':id/activate')
  @RequirePermission('organization.company.manage')
  activate(@CurrentUser() actor: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.companiesService.setStatus(actor, id, 'active');
  }

  @Post(':id/deactivate')
  @RequirePermission('organization.company.manage')
  deactivate(@CurrentUser() actor: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.companiesService.setStatus(actor, id, 'inactive');
  }

  @Delete(':id')
  @RequirePermission('organization.company.manage')
  remove(@CurrentUser() actor: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.companiesService.remove(actor, id);
  }

  @Get(':id/hierarchy')
  hierarchy(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.companiesService.hierarchy(id, user);
  }
}
