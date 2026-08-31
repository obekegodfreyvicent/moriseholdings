import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/strategies/jwt.strategy';
import { BranchesService } from './branches.service';
import { CreateBranchDto, UpdateBranchDto } from './dto/branch.dto';

// GET/POST /api/v1/organization/companies/{id}/branches
@Controller('organization/companies')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CompanyBranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Get(':id/branches')
  list(@Param('id', ParseUUIDPipe) companyId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.branchesService.listForCompany(companyId, user);
  }

  @Post(':id/branches')
  @RequirePermission('organization.company.manage')
  create(@CurrentUser() actor: AuthenticatedUser, @Param('id', ParseUUIDPipe) companyId: string, @Body() dto: CreateBranchDto) {
    return this.branchesService.create(actor, companyId, dto);
  }
}

// PATCH /api/v1/organization/branches/{id}
@Controller('organization/branches')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Patch(':id')
  @RequirePermission('organization.company.manage')
  update(@CurrentUser() actor: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateBranchDto) {
    return this.branchesService.update(actor, id, dto);
  }

  @Delete(':id')
  @RequirePermission('organization.company.manage')
  remove(@CurrentUser() actor: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.branchesService.remove(actor, id);
  }
}
