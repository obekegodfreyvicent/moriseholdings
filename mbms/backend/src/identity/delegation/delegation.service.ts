import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ForbiddenAppException, NotFoundAppException } from '../../common/app-exception';
import { AuthenticatedUser } from '../../common/strategies/jwt.strategy';
import { DelegationDomain, EffectiveAuthority, effectiveAuthority } from './delegation.rules';

type ScopeRow = { companyId: string; branchId: string | null };

/**
 * Enforces the delegated-administration model (see delegation.rules.ts):
 * who may grant/revoke which roles and permissions, to which users.
 */
@Injectable()
export class DelegationService {
  constructor(private readonly prisma: PrismaService) {}

  authorityFor(actor: AuthenticatedUser): EffectiveAuthority | null {
    return effectiveAuthority(actor.roles ?? [], actor.permissions ?? []);
  }

  /**
   * True when every one of the target user's scope rows is covered by one of
   * the actor's scope rows. A company-wide actor row (branchId null) covers
   * any branch of that company. A target with no scope rows is never covered
   * by a bounded ('own-scope') grantor.
   */
  private scopeCovers(actorScopes: ScopeRow[], targetScopes: ScopeRow[]): boolean {
    if (targetScopes.length === 0) return false;
    return targetScopes.every((t) =>
      actorScopes.some(
        (a) => a.companyId === t.companyId && (a.branchId === null || a.branchId === t.branchId),
      ),
    );
  }

  private domainLabel(authority: EffectiveAuthority): string {
    return authority.allDomains ? 'all' : [...authority.domains].join(' / ');
  }

  private async permissionsByCode(codes: string[]) {
    if (codes.length === 0) return [];
    return this.prisma.permission.findMany({ where: { code: { in: codes } } });
  }

  private assertDomainsAllowed(authority: EffectiveAuthority, perms: { code: string; domain: string }[]) {
    if (authority.allDomains) return;
    for (const p of perms) {
      if (!authority.domains.has(p.domain as DelegationDomain)) {
        throw new ForbiddenAppException(
          `As ${authority.sources.join(' / ')} you may only delegate ${this.domainLabel(authority)} ` +
            `permissions — "${p.code}" is a "${p.domain}" permission.`,
        );
      }
    }
  }

  private async assertTargetInScope(
    authority: EffectiveAuthority,
    actorScopes: ScopeRow[],
    targetUserId: string,
  ) {
    if (authority.scope === 'group') return;
    const target = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      include: { scopes: true },
    });
    if (!target) throw new NotFoundAppException('User not found.');
    const covered = this.scopeCovers(
      actorScopes,
      target.scopes.map((s) => ({ companyId: s.companyId, branchId: s.branchId })),
    );
    if (!covered) {
      throw new ForbiddenAppException(
        'You may only delegate roles and permissions to users within your own branch / company scope.',
      );
    }
  }

  /**
   * Throw unless `actor` may grant OR revoke every permission in `permissionCodes`
   * (already expanded from a role where relevant) on `targetUserId`.
   */
  async assertCanGrant(actor: AuthenticatedUser, targetUserId: string, permissionCodes: string[]): Promise<void> {
    const authority = this.authorityFor(actor);
    if (!authority) {
      throw new ForbiddenAppException(
        'You are not authorised to grant or revoke roles or permissions. This is limited to the ' +
          'Managing Director, Branch Managers (operational permissions, own branch) and HR Managers (HR permissions).',
      );
    }
    const actorScopes = (actor.scopes ?? []).map((s) => ({ companyId: s.companyId, branchId: s.branchId }));
    const perms = await this.permissionsByCode(permissionCodes);
    this.assertDomainsAllowed(authority, perms);
    await this.assertTargetInScope(authority, actorScopes, targetUserId);
  }

  /** Expand a role to its permission codes (for the grant check on role assignment). */
  async rolePermissionCodes(roleId: string): Promise<string[]> {
    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
      include: { rolePermissions: { include: { permission: true } } },
    });
    if (!role) throw new NotFoundAppException('Role not found.');
    return role.rolePermissions.map((rp) => rp.permission.code);
  }

  /**
   * The roles and permissions `actor` is allowed to delegate, plus whether the
   * given target user is inside the actor's delegation scope. Powers the admin
   * Users & Settings screen so it only offers what the signed-in admin may grant.
   */
  async listDelegatable(actor: AuthenticatedUser, targetUserId?: string) {
    const authority = this.authorityFor(actor);
    if (!authority) {
      return {
        canDelegate: false,
        reason:
          'Only the Managing Director, Branch Managers and HR Managers may grant or revoke roles and permissions.',
        scope: null,
        domains: [] as string[],
        canDelegateToTarget: false,
        roles: [] as { id: string; name: string }[],
        permissions: [] as { id: string; code: string; domain: string; description: string | null }[],
      };
    }

    const [allPerms, allRoles] = await Promise.all([
      this.prisma.permission.findMany({ orderBy: { code: 'asc' } }),
      this.prisma.role.findMany({
        orderBy: { name: 'asc' },
        include: { rolePermissions: { include: { permission: true } } },
      }),
    ]);

    const permAllowed = (domain: string) => authority.allDomains || authority.domains.has(domain as DelegationDomain);

    const permissions = allPerms
      .filter((p) => permAllowed(p.domain))
      .map((p) => ({ id: p.id, code: p.code, domain: p.domain, description: p.description }));

    const roles = allRoles
      .filter((r) => r.rolePermissions.every((rp) => permAllowed(rp.permission.domain)))
      .map((r) => ({ id: r.id, name: r.name }));

    let canDelegateToTarget = authority.scope === 'group';
    if (!canDelegateToTarget && targetUserId) {
      const target = await this.prisma.user.findUnique({
        where: { id: targetUserId },
        include: { scopes: true },
      });
      canDelegateToTarget = !!target && this.scopeCovers(
        (actor.scopes ?? []).map((s) => ({ companyId: s.companyId, branchId: s.branchId })),
        target.scopes.map((s) => ({ companyId: s.companyId, branchId: s.branchId })),
      );
    }

    return {
      canDelegate: true,
      reason: null,
      scope: authority.scope,
      domains: authority.allDomains ? ['*'] : [...authority.domains],
      canDelegateToTarget,
      roles,
      permissions,
    };
  }
}
