import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';

export interface JwtPayload {
  sub: string;
  email: string;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
  permissions: string[];
  scopes: { companyId: string; branchId: string | null }[];
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_ACCESS_SECRET'),
    });
  }

  // Re-validated against the database on every request (not just trusted from
  // the token) so a role/permission/status change takes effect immediately —
  // each service independently re-validates scope/permission claims per
  // 09_API Specification, Section 2.2.
  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        userRoles: { include: { role: { include: { rolePermissions: { include: { permission: true } } } } } },
        // FR-USER-06: permissions granted directly to the user, additive to
        // whatever their roles already carry.
        userPermissions: { include: { permission: true } },
        scopes: true,
      },
    });

    if (!user || user.status !== 'active') {
      throw new UnauthorizedException('Account is not active.');
    }

    const roles = user.userRoles.map((ur) => ur.role.name);
    const permissions = Array.from(
      new Set([
        ...user.userRoles.flatMap((ur) => ur.role.rolePermissions.map((rp) => rp.permission.code)),
        ...user.userPermissions.map((up) => up.permission.code),
      ]),
    );

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      roles,
      permissions,
      scopes: user.scopes.map((s) => ({ companyId: s.companyId, branchId: s.branchId })),
    };
  }
}
