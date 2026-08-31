import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { ConflictAppException, ForbiddenAppException, NotFoundAppException } from '../../common/app-exception';
import { Paginated } from '../../common/interceptors/response.interceptor';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateMeDto, UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { AssignPermissionDto, AssignRoleDto, AssignScopeDto } from './dto/assign.dto';
import { generateOpaqueToken } from '../auth/token.util';
import { AuditService } from '../../common/audit/audit.service';
import { AuthenticatedUser } from '../../common/strategies/jwt.strategy';
import { DelegationService } from '../delegation/delegation.service';

const userInclude = {
  userRoles: { include: { role: { include: { rolePermissions: { include: { permission: true } } } } } },
  userPermissions: { include: { permission: true } },
  scopes: true,
} as const;

function toResource(user: any) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    status: user.status,
    roles: user.userRoles.map((ur: any) => ({ id: ur.role.id, name: ur.role.name })),
    // FR-USER-06: permissions granted directly to this user, on top of
    // whatever their roles already carry.
    directPermissions: user.userPermissions.map((up: any) => ({ id: up.permission.id, code: up.permission.code })),
    // Effective permission codes (role + direct), so the Admin app can hide
    // nav items / screens the user has not been granted. Same set the JWT
    // strategy re-derives per request and the guard enforces.
    permissions: Array.from(
      new Set([
        ...user.userRoles.flatMap((ur: any) => ur.role.rolePermissions.map((rp: any) => rp.permission.code)),
        ...user.userPermissions.map((up: any) => up.permission.code),
      ]),
    ),
    scopes: user.scopes.map((s: any) => ({
      id: s.id,
      companyId: s.companyId,
      branchId: s.branchId,
      departmentId: s.departmentId,
    })),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly delegation: DelegationService,
  ) {}

  // GET /identity/users/{id}/delegatable-grants — the roles and permissions
  // the signed-in admin is actually allowed to grant/revoke on this user,
  // under the delegated-administration model. Powers the Users & Settings
  // screen so it never offers a grant the actor cannot make.
  async delegatableGrants(actor: AuthenticatedUser, targetUserId: string) {
    await this.ensureExists(targetUserId);
    return this.delegation.listDelegatable(actor, targetUserId);
  }

  // GET /identity/users — FR-USER-01
  async list(page: number, pageSize: number, status?: string): Promise<Paginated<unknown>> {
    const where = status ? { status: status as any } : {};
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        include: userInclude,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.user.count({ where }),
    ]);
    return { items: rows.map(toResource), page, pageSize, total };
  }

  // POST /identity/users — FR-USER-01 / AC-03
  async create(actor: AuthenticatedUser, dto: CreateUserDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictAppException(`A user with email "${dto.email}" already exists.`);

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        ...(dto.roleId ? { userRoles: { create: { roleId: dto.roleId } } } : {}),
        ...(dto.companyId
          ? { scopes: { create: { companyId: dto.companyId, branchId: dto.branchId ?? null } } }
          : {}),
      },
      include: userInclude,
    });
    await this.auditService.record({
      eventType: 'identity.user.created',
      sourceService: 'identity-service',
      userId: actor.id,
      companyId: dto.companyId ?? null,
      entityType: 'user',
      entityId: user.id,
      action: 'create',
      newValue: { email: user.email, firstName: user.firstName, lastName: user.lastName },
    });
    return toResource(user);
  }

  // GET /identity/users/{id}
  async get(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, include: userInclude });
    if (!user) throw new NotFoundAppException('User not found.');
    return toResource(user);
  }

  // GET /identity/users/me — FR-USER-03
  async getMe(id: string) {
    return this.get(id);
  }

  // PATCH /identity/users/me — FR-USER-03
  async updateMe(id: string, dto: UpdateMeDto) {
    const user = await this.prisma.user.update({ where: { id }, data: dto, include: userInclude });
    return toResource(user);
  }

  // PATCH /identity/users/{id}
  async update(id: string, dto: UpdateUserDto) {
    await this.ensureExists(id);
    const user = await this.prisma.user.update({ where: { id }, data: dto, include: userInclude });
    return toResource(user);
  }

  // POST /identity/users/{id}/activate
  async activate(actor: AuthenticatedUser, id: string) {
    const before = await this.ensureExists(id);
    const user = await this.prisma.user.update({
      where: { id },
      data: { status: 'active', lockedUntil: null, failedLoginAttempts: 0 },
      include: userInclude,
    });
    await this.recordStatusChange(actor, user.id, before.status, 'active');
    return toResource(user);
  }

  // POST /identity/users/{id}/deactivate — BR-06: revokes access, keeps the row
  async deactivate(actor: AuthenticatedUser, id: string) {
    const before = await this.ensureExists(id);
    const user = await this.prisma.user.update({
      where: { id },
      data: { status: 'inactive' },
      include: userInclude,
    });
    await this.prisma.refreshToken.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.recordStatusChange(actor, user.id, before.status, 'inactive');
    return toResource(user);
  }

  // POST /identity/users/{id}/lock
  async lock(actor: AuthenticatedUser, id: string) {
    const before = await this.ensureExists(id);
    const user = await this.prisma.user.update({
      where: { id },
      data: { status: 'locked', lockedUntil: new Date(Date.now() + 15 * 60_000) },
      include: userInclude,
    });
    await this.recordStatusChange(actor, user.id, before.status, 'locked');
    return toResource(user);
  }

  // POST /identity/users/{id}/unlock
  async unlock(actor: AuthenticatedUser, id: string) {
    const before = await this.ensureExists(id);
    const user = await this.prisma.user.update({
      where: { id },
      data: { status: 'active', lockedUntil: null, failedLoginAttempts: 0 },
      include: userInclude,
    });
    await this.recordStatusChange(actor, user.id, before.status, 'active');
    return toResource(user);
  }

  private async recordStatusChange(actor: AuthenticatedUser, userId: string, before: string, after: string) {
    await this.auditService.record({
      eventType: 'identity.user.updated',
      sourceService: 'identity-service',
      userId: actor.id,
      entityType: 'user',
      entityId: userId,
      action: 'update',
      previousValue: { status: before },
      newValue: { status: after },
    });
  }

  // POST /identity/users/{id}/reset-password — administrator-initiated
  async resetPassword(actor: AuthenticatedUser, id: string) {
    await this.ensureExists(id);
    const tempPassword = generateOpaqueToken().slice(0, 12);
    const passwordHash = await bcrypt.hash(tempPassword, 12);
    await this.prisma.user.update({ where: { id }, data: { passwordHash } });
    await this.prisma.refreshToken.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    // RBAC completion pass (19 August 2026): this mutation never called
    // AuditService — every other password-affecting action
    // (password-reset/confirm's own audit-worthy status flip, lock/unlock,
    // and the new self-service changePassword below) is represented in the
    // audit trail, but an administrator resetting another user's password
    // silently wasn't. Fixed, following the same
    // identity.user.password_reset naming convention the new
    // changePassword method below establishes. Never logs the temporary
    // password itself, matching the no-sensitive-values-in-audit-payloads
    // convention already established for bank/tax fields elsewhere.
    await this.auditService.record({
      eventType: 'identity.user.password_reset',
      sourceService: 'identity-service',
      userId: actor.id,
      entityType: 'user',
      entityId: id,
      action: 'update',
    });
    // In production this would be emailed directly to the user, never
    // returned via API/logged — no mail service is wired up in this
    // Sprint 1+2 slice, so it is surfaced here for the demo only.
    return { message: 'Password has been reset.', temporaryPassword: tempPassword };
  }

  // POST /identity/users/me/change-password — RBAC completion pass (19
  // August 2026), self-service, distinct from the admin-initiated
  // resetPassword above (no current-password check, generates a temp
  // password) and the unauthenticated forgot-password flow in
  // AuthService (token-based). Requires proving knowledge of the current
  // password, matching the "User Management: change passwords" bullet
  // this pass was requested against — "reset" (admin/forgot-password) and
  // "change" (self-service, logged-in) are two different actions this
  // codebase previously conflated by only having the former.
  async changePassword(actor: AuthenticatedUser, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: actor.id } });
    const currentOk = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!currentOk) {
      throw new ForbiddenAppException('Current password is incorrect.');
    }
    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.user.update({ where: { id: actor.id }, data: { passwordHash } });
    // Same "revoke every other active session" behavior password-reset/
    // confirm already uses — a changed password should invalidate any
    // refresh token issued under the old one, not just the current
    // request's access token (which expires on its own in 15 minutes
    // regardless).
    await this.prisma.refreshToken.updateMany({
      where: { userId: actor.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.auditService.record({
      eventType: 'identity.user.password_changed',
      sourceService: 'identity-service',
      userId: actor.id,
      entityType: 'user',
      entityId: actor.id,
      action: 'update',
    });
    return { message: 'Password has been changed.' };
  }

  // POST /identity/users/{id}/scopes — FR-USER-04
  async addScope(id: string, dto: AssignScopeDto) {
    await this.ensureExists(id);
    await this.prisma.userScope.create({
      data: {
        userId: id,
        companyId: dto.companyId,
        branchId: dto.branchId ?? null,
        departmentId: dto.departmentId ?? null,
      },
    });
    return this.get(id);
  }

  // DELETE /identity/users/{id}/scopes/{scopeId}
  async removeScope(id: string, scopeId: string) {
    await this.ensureExists(id);
    await this.prisma.userScope.deleteMany({ where: { id: scopeId, userId: id } });
    return this.get(id);
  }

  // POST /identity/users/{id}/roles — FR-USER-06 / AC-03
  async addRole(actor: AuthenticatedUser, id: string, dto: AssignRoleDto) {
    await this.ensureExists(id);
    const role = await this.prisma.role.findUnique({ where: { id: dto.roleId } });
    if (!role) throw new NotFoundAppException('Role not found.');
    // Delegated-administration model (27 August 2026): the actor may only
    // assign a role every one of whose permissions is inside their
    // delegation authority (domain + scope). See identity/delegation.
    await this.delegation.assertCanGrant(actor, id, await this.delegation.rolePermissionCodes(dto.roleId));
    await this.prisma.userRole.upsert({
      where: { userId_roleId: { userId: id, roleId: dto.roleId } },
      create: { userId: id, roleId: dto.roleId },
      update: {},
    });
    await this.auditService.record({
      eventType: 'identity.user.updated',
      sourceService: 'identity-service',
      userId: actor.id,
      entityType: 'user',
      entityId: id,
      action: 'approve',
      newValue: { roleAssigned: role.name },
    });
    return this.get(id);
  }

  // DELETE /identity/users/{id}/roles/{roleId}
  async removeRole(actor: AuthenticatedUser, id: string, roleId: string) {
    await this.ensureExists(id);
    // Same authority gate as granting — you may only take away a role you
    // could have given.
    await this.delegation.assertCanGrant(actor, id, await this.delegation.rolePermissionCodes(roleId));
    await this.prisma.userRole.deleteMany({ where: { userId: id, roleId } });
    await this.auditService.record({
      eventType: 'identity.user.updated',
      sourceService: 'identity-service',
      userId: actor.id,
      entityType: 'user',
      entityId: id,
      action: 'update',
      newValue: { roleRemoved: roleId },
    });
    return this.get(id);
  }

  // POST /identity/users/{id}/permissions — FR-USER-06 direct grant, on top
  // of whatever the user's roles already carry.
  async addPermission(actor: AuthenticatedUser, id: string, dto: AssignPermissionDto) {
    await this.ensureExists(id);
    const permission = await this.prisma.permission.findUnique({ where: { id: dto.permissionId } });
    if (!permission) throw new NotFoundAppException('Permission not found.');
    // Delegated-administration model (27 August 2026): the actor may only
    // grant a permission inside their delegation authority (domain + scope).
    await this.delegation.assertCanGrant(actor, id, [permission.code]);
    await this.prisma.userPermission.upsert({
      where: { userId_permissionId: { userId: id, permissionId: dto.permissionId } },
      create: { userId: id, permissionId: dto.permissionId },
      update: {},
    });
    await this.auditService.record({
      eventType: 'identity.user.updated',
      sourceService: 'identity-service',
      userId: actor.id,
      entityType: 'user',
      entityId: id,
      action: 'approve',
      newValue: { permissionGranted: permission.code },
    });
    return this.get(id);
  }

  // DELETE /identity/users/{id}/permissions/{permissionId}
  async removePermission(actor: AuthenticatedUser, id: string, permissionId: string) {
    await this.ensureExists(id);
    const permission = await this.prisma.permission.findUnique({ where: { id: permissionId } });
    if (!permission) throw new NotFoundAppException('Permission not found.');
    // Same authority gate as granting.
    await this.delegation.assertCanGrant(actor, id, [permission.code]);
    await this.prisma.userPermission.deleteMany({ where: { userId: id, permissionId } });
    await this.auditService.record({
      eventType: 'identity.user.updated',
      sourceService: 'identity-service',
      userId: actor.id,
      entityType: 'user',
      entityId: id,
      action: 'update',
      newValue: { permissionRevoked: permission.code },
    });
    return this.get(id);
  }

  private async ensureExists(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundAppException('User not found.');
    return user;
  }
}
