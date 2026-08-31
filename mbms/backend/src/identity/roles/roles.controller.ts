import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PrismaService } from '../../prisma/prisma.service';

// Base path /api/v1/identity — GET /roles, GET /permissions — FR-USER-05.
@Controller('identity')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RolesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('roles')
  @RequirePermission('identity.role.view')
  async listRoles() {
    const roles = await this.prisma.role.findMany({
      orderBy: { name: 'asc' },
      include: { rolePermissions: { include: { permission: true } } },
    });
    return roles.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      isSystemRole: r.isSystemRole,
      permissions: r.rolePermissions.map((rp) => rp.permission.code),
    }));
  }

  @Get('permissions')
  @RequirePermission('identity.role.view')
  async listPermissions() {
    const permissions = await this.prisma.permission.findMany({ orderBy: { code: 'asc' } });
    return permissions.map((p) => ({ id: p.id, code: p.code, description: p.description }));
  }
}
