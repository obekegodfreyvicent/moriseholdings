import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/strategies/jwt.strategy';
import { DepartmentsService } from './departments.service';
import { CreateDepartmentDto, UpdateDepartmentDto } from './dto/department.dto';

// GET/POST /api/v1/organization/companies/{id}/departments
@Controller('organization/companies')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CompanyDepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Get(':id/departments')
  list(@Param('id', ParseUUIDPipe) companyId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.departmentsService.listForCompany(companyId, user);
  }

  @Post(':id/departments')
  @RequirePermission('organization.company.manage')
  create(@CurrentUser() actor: AuthenticatedUser, @Param('id', ParseUUIDPipe) companyId: string, @Body() dto: CreateDepartmentDto) {
    return this.departmentsService.create(actor, companyId, dto);
  }
}

// PATCH /api/v1/organization/departments/{id}
@Controller('organization/departments')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Get()
  @RequirePermission('organization.company.manage', 'organization.company.viewAll', 'employee.viewAll', 'recruitment.viewAll')
  list(@CurrentUser() user: AuthenticatedUser, @Query('companyId') companyId?: string) {
    return this.departmentsService.listAll(user, companyId || undefined);
  }

  @Patch(':id')
  @RequirePermission('organization.company.manage')
  update(@CurrentUser() actor: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateDepartmentDto) {
    return this.departmentsService.update(actor, id, dto);
  }

  @Delete(':id')
  @RequirePermission('organization.company.manage')
  remove(@CurrentUser() actor: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.departmentsService.remove(actor, id);
  }
}
