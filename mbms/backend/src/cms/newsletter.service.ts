import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundAppException } from '../common/app-exception';
import { AuthenticatedUser } from '../common/strategies/jwt.strategy';
import { AuditService } from '../common/audit/audit.service';
import { NewsletterSubscribeDto } from './dto/newsletter.dto';

function subscriberResource(r: any) {
  return {
    id: r.id,
    email: r.email,
    status: r.status,
    source: r.source,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

// Newsletter sign-ups (29 August 2026). Captured from the landing page's
// newsletter section (public, no account); admins view the list in
// Admin » CMS / Site Builder (cms.viewAll to read, cms.manage to delete).
@Injectable()
export class NewsletterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  // -------- public --------

  // Idempotent and non-enumerating: whether the address was new, already
  // subscribed, or previously unsubscribed, the caller gets the same
  // { subscribed: true } — the landing page must not become an "is this
  // email registered?" oracle.
  async subscribe(dto: NewsletterSubscribeDto) {
    const email = dto.email.trim().toLowerCase();
    await this.prisma.newsletterSubscriber.upsert({
      where: { email },
      update: { status: 'subscribed' },
      create: { email, status: 'subscribed', source: dto.source?.trim() || 'landing' },
    });
    return { subscribed: true };
  }

  // -------- admin --------

  async list() {
    const rows = await this.prisma.newsletterSubscriber.findMany({
      orderBy: { createdAt: 'desc' },
    });
    const subscribed = rows.filter((r) => r.status === 'subscribed').length;
    return {
      total: rows.length,
      subscribed,
      unsubscribed: rows.length - subscribed,
      subscribers: rows.map(subscriberResource),
    };
  }

  async remove(user: AuthenticatedUser, id: string) {
    const row = await this.prisma.newsletterSubscriber.findUnique({ where: { id } });
    if (!row) throw new NotFoundAppException('Newsletter subscriber not found.');
    await this.prisma.newsletterSubscriber.delete({ where: { id } });
    await this.auditService.record({
      eventType: 'cms.newsletter_subscriber.deleted',
      sourceService: 'cms-service',
      userId: user.id,
      companyId: null,
      entityType: 'newsletter_subscriber',
      entityId: id,
      action: 'delete',
      previousValue: subscriberResource(row),
      newValue: null,
    });
    return { deleted: true };
  }
}
