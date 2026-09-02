import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundAppException } from '../app-exception';
import { Paginated } from '../interceptors/response.interceptor';

export interface NotifyInput {
  companyId?: string | null;
  type: string; // e.g. "expense.approval_needed" — mirrors the AuditService eventType convention
  title: string;
  message?: string | null;
  entityType?: string | null;
  entityId?: string | null;
}

/**
 * morise.docx, Section 39 ("Notifications and Alerts") — "Workflow
 * notifications" specifically, per Sprint 14. An in-app feed only: a row
 * per recipient, written synchronously in-process, the same fire-and-
 * forget/never-block-the-caller discipline AuditService already uses (a
 * broken notification write must not fail the business operation that
 * triggered it). Email/push/SMS channels the same source section also
 * lists remain deliberately deferred — no SMTP or push provider exists in
 * this proof-of-concept, the same class of gap already noted for object
 * storage and a job scheduler.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger('NotificationsService');

  constructor(private readonly prisma: PrismaService) {}

  // Called by other services (Expenses, Assets, ...) to notify a specific
  // set of already-resolved recipient user IDs — see
  // findUsersWithPermissionInCompany() below for how callers typically get
  // that list.
  async notifyUsers(userIds: string[], input: NotifyInput): Promise<void> {
    if (userIds.length === 0) return;
    try {
      await this.prisma.notification.createMany({
        data: userIds.map((userId) => ({
          userId,
          companyId: input.companyId ?? null,
          type: input.type,
          title: input.title,
          message: input.message ?? null,
          entityType: input.entityType ?? null,
          entityId: input.entityId ?? null,
        })),
      });
    } catch (err) {
      this.logger.error(`Failed to write notifications of type "${input.type}"`, err as Error);
    }
  }

  // Every user who holds permissionCode (via a role or a direct grant — the
  // same two grant paths JwtStrategy already unions into AuthenticatedUser.
  // permissions) AND can actually see companyId — either because they hold
  // a UserScope row for it, or because groupVisibilityPermissionCode is
  // supplied and they hold that too (group-wide visibility, the same
  // override isCompanyInScope/hasGroupVisibility already apply for a single
  // logged-in caller — this is the equivalent lookup across every user in
  // the system, not just one). Without the group-visibility branch, a
  // Managing Director holding asset.approve.disposal but no explicit
  // UserScope row for a specific subsidiary (group-wide access is granted
  // by asset.viewAll instead, not a scope row) would silently never be
  // notified — found and fixed during this sprint's own verification.
  async findUsersWithPermissionInCompany(companyId: string, permissionCode: string, groupVisibilityPermissionCode?: string): Promise<string[]> {
    const hasPermission = (u: any) =>
      u.userRoles.some((ur: any) => ur.role.rolePermissions.some((rp: any) => rp.permission.code === permissionCode)) ||
      u.userPermissions.some((up: any) => up.permission.code === permissionCode);
    const hasGroupVisibility = (u: any) =>
      !!groupVisibilityPermissionCode &&
      (u.userRoles.some((ur: any) => ur.role.rolePermissions.some((rp: any) => rp.permission.code === groupVisibilityPermissionCode)) ||
        u.userPermissions.some((up: any) => up.permission.code === groupVisibilityPermissionCode));
    const scopedUserIds = new Set(
      (await this.prisma.userScope.findMany({ where: { companyId }, select: { userId: true } })).map((s) => s.userId),
    );

    const candidates = await this.prisma.user.findMany({
      where: { status: 'active' },
      include: {
        userRoles: { include: { role: { include: { rolePermissions: { include: { permission: true } } } } } },
        userPermissions: { include: { permission: true } },
      },
    });
    return candidates.filter((u) => hasPermission(u) && (scopedUserIds.has(u.id) || hasGroupVisibility(u))).map((u) => u.id);
  }

  // GET /notifications — a user's own feed only; there is no
  // notification.viewAll — a notification is inherently personal, the same
  // reasoning that already gives Expenses a narrower-than-usual default
  // list view.
  async list(userId: string, page: number, pageSize: number, unreadOnly: boolean): Promise<Paginated<unknown>> {
    const where: any = { userId };
    if (unreadOnly) where.isRead = false;
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
      this.prisma.notification.count({ where }),
    ]);
    // Resolve department names for the page in one query so the bell can show
    // which department an alert notification was routed to.
    const deptIds = [...new Set(rows.map((r) => r.departmentId).filter((d): d is string => !!d))];
    const deptNames = deptIds.length
      ? new Map(
          (await this.prisma.department.findMany({ where: { id: { in: deptIds } }, select: { id: true, name: true } })).map((d) => [
            d.id,
            d.name,
          ]),
        )
      : new Map<string, string>();
    return {
      items: rows.map((r) => ({ ...toResource(r), department: r.departmentId ? deptNames.get(r.departmentId) ?? null : null })),
      page,
      pageSize,
      total,
    };
  }

  async unreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({ where: { userId, isRead: false } });
  }

  async markRead(userId: string, id: string) {
    const notification = await this.prisma.notification.findUnique({ where: { id } });
    if (!notification || notification.userId !== userId) {
      throw new NotFoundAppException('Notification not found.');
    }
    const updated = await this.prisma.notification.update({ where: { id }, data: { isRead: true, readAt: new Date() } });
    return toResource(updated);
  }

  async markAllRead(userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
    return { updated: result.count };
  }
}

function toResource(n: any) {
  return {
    id: n.id,
    companyId: n.companyId,
    type: n.type,
    title: n.title,
    message: n.message,
    entityType: n.entityType,
    entityId: n.entityId,
    departmentId: n.departmentId ?? null,
    isRead: n.isRead,
    readAt: n.readAt,
    createdAt: n.createdAt,
  };
}
