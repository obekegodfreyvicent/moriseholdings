import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/strategies/jwt.strategy';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { EmployeesService } from './employees.service';
import { CreateEmployeeDto, UpdateEmployeeDto } from './dto/employee.dto';

// Base path /api/v1/employees — 09_API Specification, Section 5.
@Controller('employees')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Get()
  @RequirePermission('employee.manage', 'employee.viewAll')
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQueryDto,
    @Query('filter[companyId]') companyId?: string,
    @Query('filter[branchId]') branchId?: string,
    @Query('filter[departmentId]') departmentId?: string,
    @Query('filter[status]') status?: string,
  ) {
    return this.employeesService.list(user, query.page, query.pageSize, {
      companyId,
      branchId,
      departmentId,
      status,
    });
  }

  @Post()
  @RequirePermission('employee.manage')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateEmployeeDto) {
    return this.employeesService.create(user, dto);
  }

  @Get(':id')
  @RequirePermission('employee.manage', 'employee.viewAll')
  get(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.employeesService.get(user, id);
  }

  @Patch(':id')
  @RequirePermission('employee.manage')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEmployeeDto,
  ) {
    return this.employeesService.update(user, id, dto);
  }

  // "Employment history" — HR Module deepening, 19 August 2026.
  @Get(':id/employment-history')
  @RequirePermission('employee.manage', 'employee.viewAll')
  employmentHistory(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.employeesService.employmentHistory(user, id);
  }
}
