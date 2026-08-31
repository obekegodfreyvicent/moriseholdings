import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundAppException } from '../common/app-exception';
import { AuthenticatedUser } from '../common/strategies/jwt.strategy';
import { AuditService } from '../common/audit/audit.service';
import { ContentTranslationService } from '../common/translation/content-translation.service';
import { CreateDisclaimerItemDto, UpdateDisclaimerItemDto } from './dto/disclaimer.dto';

// How long (seconds) the disclaimer gate is shown before the "I Understand,
// Continue" button becomes active. Returned by the public endpoint so the
// storefront never hard-codes it.
export const DISCLAIMER_HOLD_SECONDS = 10;

function itemResource(r: any) {
  return {
    id: r.id,
    body: r.body,
    sortOrder: r.sortOrder,
    isVisible: r.isVisible,
    createdBy: r.createdBy,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

// Site disclaimer (30 August 2026). The statements a signed-out visitor must
// acknowledge on the full-page disclaimer gate before the corporate landing
// page appears. Managed in Admin » CMS / Site Builder (cms.viewAll to read,
// cms.manage to change), site-wide — the same scope model as ContentBlock /
// FaqItem / SocialLink.
@Injectable()
export class DisclaimerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly translation: ContentTranslationService,
  ) {}

  private order() {
    return [{ sortOrder: 'asc' as const }, { createdAt: 'asc' as const }];
  }

  // -------- admin --------

  async list() {
    const rows = await this.prisma.disclaimerItem.findMany({ orderBy: this.order() });
    return rows.map(itemResource);
  }

  async create(user: AuthenticatedUser, dto: CreateDisclaimerItemDto) {
    const created = await this.prisma.disclaimerItem.create({
      data: {
        body: dto.body.trim(),
        sortOrder: dto.sortOrder ?? 0,
        isVisible: dto.isVisible ?? true,
        createdBy: user.id,
      },
    });
    await this.audit(user, 'cms.disclaimer_item.created', created.id, null, itemResource(created));
    return itemResource(created);
  }

  async update(user: AuthenticatedUser, id: string, dto: UpdateDisclaimerItemDto) {
    const row = await this.prisma.disclaimerItem.findUnique({ where: { id } });
    if (!row) throw new NotFoundAppException('Disclaimer statement not found.');

    const data: any = {};
    if (dto.body !== undefined) data.body = dto.body.trim();
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
    if (dto.isVisible !== undefined) data.isVisible = dto.isVisible;

    const updated = await this.prisma.disclaimerItem.update({ where: { id }, data });
    await this.audit(user, 'cms.disclaimer_item.updated', id, itemResource(row), itemResource(updated));
    return itemResource(updated);
  }

  async remove(user: AuthenticatedUser, id: string) {
    const row = await this.prisma.disclaimerItem.findUnique({ where: { id } });
    if (!row) throw new NotFoundAppException('Disclaimer statement not found.');
    await this.prisma.disclaimerItem.delete({ where: { id } });
    await this.audit(user, 'cms.disclaimer_item.deleted', id, itemResource(row), null);
    return { deleted: true };
  }

  // -------- storefront (visible only) --------

  async listPublic(lang = 'en') {
    const rows = await this.prisma.disclaimerItem.findMany({
      where: { isVisible: true },
      orderBy: this.order(),
      select: { id: true, body: true },
    });
    return {
      holdSeconds: DISCLAIMER_HOLD_SECONDS,
      items: rows.map((r) => ({ id: r.id, body: this.translation.toLocale(r.body, lang) })),
    };
  }

  private audit(
    user: AuthenticatedUser,
    eventType: string,
    entityId: string,
    previousValue: unknown,
    newValue: unknown,
  ) {
    return this.auditService.record({
      eventType,
      sourceService: 'cms-service',
      userId: user.id,
      companyId: null,
      entityType: 'disclaimer_item',
      entityId,
      action: eventType.endsWith('deleted')
        ? 'delete'
        : eventType.endsWith('created')
          ? 'create'
          : 'update',
      previousValue,
      newValue,
    });
  }
}
