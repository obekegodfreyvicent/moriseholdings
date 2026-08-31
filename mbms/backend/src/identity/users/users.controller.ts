import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/strategies/jwt.strategy';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateMeDto, UpdateUserDto } from './dto/update-user.dto';
import { AssignPermissionDto, AssignRoleDto, AssignScopeDto } from './dto/assign.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

const MANAGE = 'identity.user.manage';
// Delegated-administration model (27 August 2026): the grant/revoke endpoints
// accept EITHER the platform-wide identity.user.manage (Super Administrator /
// IT Administrator bootstrap) OR identity.user.delegate (Managing Director,
// Branch Manager, HR Manager). The bounded grantors' authority is then
// enforced per-grant in DelegationService.
const DELEGATE = 'identity.user.delegate';

// Base path /api/v1/identity/users — 09_API Specification, Section 3.
@Controller('identity/users')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // GET /identity/users/me must be registered before GET /identity/users/:id
  // so Nest's router doesn't capture "me" as a UUID param.
  @Get('me')
  getMe(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.getMe(user.id);
  }

  @Patch('me')
  updateMe(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateMeDto) {
    return this.usersService.updateMe(user.id, dto);
  }

  // Listing and viewing users is also open to DELEGATE holders (Managing
  // Director, Branch Manager, HR Manager) so they can pick a target to grant
  // to — but user lifecycle (create/update/activate/lock/scopes) stays
  // MANAGE-only.
  @Get()
  @RequirePermission(MANAGE, DELEGATE)
  list(@Query() query: PaginationQueryDto, @Query('filter[status]') status?: string) {
    return this.usersService.list(query.page, query.pageSize, status);
  }

  @Post()
  @RequirePermission(MANAGE)
  create(@CurrentUser() actor: AuthenticatedUser, @Body() dto: CreateUserDto) {
    return this.usersService.create(actor, dto);
  }

  @Get(':id')
  @RequirePermission(MANAGE, DELEGATE)
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.get(id);
  }

  @Patch(':id')
  @RequirePermission(MANAGE)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Post(':id/activate')
  @RequirePermission(MANAGE)
  activate(@CurrentUser() actor: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.activate(actor, id);
  }

  @Post(':id/deactivate')
  @RequirePermission(MANAGE)
  deactivate(@CurrentUser() actor: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.deactivate(actor, id);
  }

  @Post(':id/reset-password')
  @RequirePermission(MANAGE)
  resetPassword(@CurrentUser() actor: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.resetPassword(actor, id);
  }

  // POST /identity/users/me/change-password — self-service, no
  // RequirePermission decorator, since every authenticated user may change
  // their own password; the currentPassword check inside the service is
  // the actual gate, not a permission.
  @Post('me/change-password')
  changePassword(@CurrentUser() actor: AuthenticatedUser, @Body() dto: ChangePasswordDto) {
    return this.usersService.changePassword(actor, dto);
  }

  @Post(':id/lock')
  @RequirePermission(MANAGE)
  lock(@CurrentUser() actor: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.lock(actor, id);
  }

  @Post(':id/unlock')
  @RequirePermission(MANAGE)
  unlock(@CurrentUser() actor: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.unlock(actor, id);
  }

  @Post(':id/scopes')
  @RequirePermission(MANAGE)
  addScope(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AssignScopeDto) {
    return this.usersService.addScope(id, dto);
  }

  @Delete(':id/scopes/:scopeId')
  @RequirePermission(MANAGE)
  removeScope(@Param('id', ParseUUIDPipe) id: string, @Param('scopeId', ParseUUIDPipe) scopeId: string) {
    return this.usersService.removeScope(id, scopeId);
  }

  // The roles / permissions the signed-in admin may actually grant on this
  // user (delegated-administration model). MANAGE or DELEGATE may read it.
  @Get(':id/delegatable-grants')
  @RequirePermission(MANAGE, DELEGATE)
  delegatableGrants(@CurrentUser() actor: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.delegatableGrants(actor, id);
  }

  @Post(':id/roles')
  @RequirePermission(MANAGE, DELEGATE)
  addRole(@CurrentUser() actor: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AssignRoleDto) {
    return this.usersService.addRole(actor, id, dto);
  }

  @Delete(':id/roles/:roleId')
  @RequirePermission(MANAGE, DELEGATE)
  removeRole(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('roleId', ParseUUIDPipe) roleId: string,
  ) {
    return this.usersService.removeRole(actor, id, roleId);
  }

  @Post(':id/permissions')
  @RequirePermission(MANAGE, DELEGATE)
  addPermission(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignPermissionDto,
  ) {
    return this.usersService.addPermission(actor, id, dto);
  }

  @Delete(':id/permissions/:permissionId')
  @RequirePermission(MANAGE, DELEGATE)
  removePermission(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('permissionId', ParseUUIDPipe) permissionId: string,
  ) {
    return this.usersService.removePermission(actor, id, permissionId);
  }
}
