import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/strategies/jwt.strategy';
import { PoliciesService } from './policies.service';
import { CreatePolicyDto, UpdatePolicyDto } from './dto/policy.dto';

// GET/POST /api/v1/organization/companies/{id}/policies
@Controller('organization/companies')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CompanyPoliciesController {
  constructor(private readonly policiesService: PoliciesService) {}

  @Get(':id/policies')
  list(@Param('id', ParseUUIDPipe) companyId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.policiesService.listForCompany(companyId, user);
  }

  @Post(':id/policies')
  @RequirePermission('organization.company.manage')
  create(@CurrentUser() actor: AuthenticatedUser, @Param('id', ParseUUIDPipe) companyId: string, @Body() dto: CreatePolicyDto) {
    return this.policiesService.create(actor, companyId, dto);
  }
}

// PATCH /api/v1/organization/policies/{id}
@Controller('organization/policies')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PoliciesController {
  constructor(private readonly policiesService: PoliciesService) {}

  @Patch(':id')
  @RequirePermission('organization.company.manage')
  update(@CurrentUser() actor: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePolicyDto) {
    return this.policiesService.update(actor, id, dto);
  }

  @Delete(':id')
  @RequirePermission('organization.company.manage')
  remove(@CurrentUser() actor: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.policiesService.remove(actor, id);
  }
}
