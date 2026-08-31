import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ForbiddenAppException } from '../app-exception';
import { PERMISSION_KEY } from '../decorators/require-permission.decorator';
import { AuthenticatedUser } from '../strategies/jwt.strategy';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auditService: AuditService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    // Method-level metadata wins outright over class-level metadata (rather
    // than being merged) so a GET handler can declare its own, looser set of
    // acceptable permissions than the class-level @RequirePermission used by
    // its sibling write handlers.
    const required =
      this.reflector.get<string[] | undefined>(PERMISSION_KEY, context.getHandler()) ??
      this.reflector.get<string[] | undefined>(PERMISSION_KEY, context.getClass());
    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const user: AuthenticatedUser = request.user;
    const granted = required.some((code) => user?.permissions?.includes(code));
    if (!granted) {
      // *.access.denied per 09_API Specification, Section 11 — captured here,
      // centrally, rather than in every individual controller, since this
      // guard is the one place every permission check already passes
      // through regardless of which module it protects.
      void this.auditService.record({
        eventType: `${context.getClass().name}.access.denied`,
        sourceService: context.getClass().name,
        userId: user?.id ?? null,
        companyId: null,
        entityType: context.getHandler().name,
        entityId: null,
        action: 'access_denied',
        newValue: { path: request.url, method: request.method, requiredPermissions: required },
        ipAddress: request.ip ?? null,
      });

      throw new ForbiddenAppException(
        required.length === 1
          ? `Your role does not include the "${required[0]}" permission required for this action.`
          : `Your role does not include any of the required permissions (${required.join(' / ')}).`,
      );
    }
    return true;
  }
}
