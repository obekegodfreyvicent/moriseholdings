import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundAppException } from '../common/app-exception';
import { AuthenticatedUser } from '../common/strategies/jwt.strategy';
import { AuditService } from '../common/audit/audit.service';
import { ContentTranslationService } from '../common/translation/content-translation.service';
import { CreateSocialLinkDto, UpdateSocialLinkDto } from './dto/social-link.dto';

function linkResource(r: any) {
  return {
    id: r.id,
    platform: r.platform,
    label: r.label,
    url: r.url,
    sortOrder: r.sortOrder,
    isVisible: r.isVisible,
    createdBy: r.createdBy,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

// Social media channels (29 August 2026). Managed in Admin » CMS / Site
// Builder (cms.viewAll to see, cms.manage to change), displayed in the
// storefront / corporate-site footer. Site-wide, not per-company — the same
// scope model as ContentBlock.
@Injectable()
export class SocialLinksService {
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
    const rows = await this.prisma.socialLink.findMany({ orderBy: this.order() });
    return rows.map(linkResource);
  }

  async create(user: AuthenticatedUser, dto: CreateSocialLinkDto) {
    const created = await this.prisma.socialLink.create({
      data: {
        platform: dto.platform,
        url: dto.url.trim(),
        label: dto.label?.trim() || null,
        sortOrder: dto.sortOrder ?? 0,
        isVisible: dto.isVisible ?? true,
        createdBy: user.id,
      },
    });
    await this.audit(user, 'cms.social_link.created', created.id, null, linkResource(created));
    return linkResource(created);
  }

  async update(user: AuthenticatedUser, id: string, dto: UpdateSocialLinkDto) {
    const row = await this.prisma.socialLink.findUnique({ where: { id } });
    if (!row) throw new NotFoundAppException('Social media channel not found.');

    const data: any = {};
    if (dto.platform !== undefined) data.platform = dto.platform;
    if (dto.url !== undefined) data.url = dto.url.trim();
    if (dto.label !== undefined) data.label = dto.label?.trim() || null;
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
    if (dto.isVisible !== undefined) data.isVisible = dto.isVisible;

    const updated = await this.prisma.socialLink.update({ where: { id }, data });
    await this.audit(user, 'cms.social_link.updated', id, linkResource(row), linkResource(updated));
    return linkResource(updated);
  }

  async remove(user: AuthenticatedUser, id: string) {
    const row = await this.prisma.socialLink.findUnique({ where: { id } });
    if (!row) throw new NotFoundAppException('Social media channel not found.');
    await this.prisma.socialLink.delete({ where: { id } });
    await this.audit(user, 'cms.social_link.deleted', id, linkResource(row), null);
    return { deleted: true };
  }

  // -------- storefront (visible only) --------

  async listPublic(lang = 'en') {
    const rows = await this.prisma.socialLink.findMany({
      where: { isVisible: true },
      orderBy: this.order(),
      select: { platform: true, label: true, url: true },
    });
    return rows.map((r) => ({
      platform: r.platform,
      label: r.label ? this.translation.toLocale(r.label, lang) : null,
      url: r.url,
    }));
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
      entityType: 'social_link',
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
