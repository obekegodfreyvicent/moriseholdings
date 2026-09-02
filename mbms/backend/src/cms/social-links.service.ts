import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundAppException } from '../common/app-exception';
import { AuthenticatedUser } from '../common/strategies/jwt.strategy';
import { AuditService } from '../common/audit/audit.service';
import { ContentTranslationService } from '../common/translation/content-translation.service';
import { CreateSocialLinkDto, UpdateSocialLinkDto, SOCIAL_PLATFORMS } from './dto/social-link.dto';
import { ApplySocialContentDto, UpdateSocialContentDto } from './dto/social-content.dto';

// How each platform's public URL is built from a bare handle (no @, no URL).
// "other" has no shape — it is only ever label/visibility-synced, never
// created or URL-rewritten from the shared handle.
const PLATFORM_URL: Record<string, (handle: string) => string> = {
  facebook: (h) => `https://facebook.com/${h}`,
  x: (h) => `https://x.com/${h}`,
  instagram: (h) => `https://instagram.com/${h}`,
  linkedin: (h) => `https://www.linkedin.com/company/${h}`,
  youtube: (h) => `https://www.youtube.com/@${h}`,
  tiktok: (h) => `https://www.tiktok.com/@${h}`,
  whatsapp: (h) => `https://wa.me/${h}`,
  telegram: (h) => `https://t.me/${h}`,
};

const SOCIAL_CONTENT_ID = 'default';

function contentResource(r: any) {
  return {
    handle: r?.handle ?? null,
    displayName: r?.displayName ?? null,
    tagline: r?.tagline ?? null,
    isVisible: r?.isVisible ?? true,
    updatedBy: r?.updatedBy ?? null,
    updatedAt: r?.updatedAt ?? null,
  };
}

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

  // -------- shared social content (2 September 2026) --------
  // One canonical record (handle / display name / tagline / visibility) that
  // the CMS pushes to every channel in a single click, so all channels carry
  // the same information.

  async getContent() {
    const row = await this.prisma.socialContent.findUnique({ where: { id: SOCIAL_CONTENT_ID } });
    return contentResource(row);
  }

  async saveContent(user: AuthenticatedUser, dto: UpdateSocialContentDto) {
    const before = await this.prisma.socialContent.findUnique({ where: { id: SOCIAL_CONTENT_ID } });

    const norm = (v: string | null | undefined) =>
      v === undefined ? undefined : v === null ? null : v.trim() || null;

    const data: any = {};
    if (dto.handle !== undefined) data.handle = norm(dto.handle);
    if (dto.displayName !== undefined) data.displayName = norm(dto.displayName);
    if (dto.tagline !== undefined) data.tagline = norm(dto.tagline);
    if (dto.isVisible !== undefined) data.isVisible = dto.isVisible;

    const saved = await this.prisma.socialContent.upsert({
      where: { id: SOCIAL_CONTENT_ID },
      update: { ...data, updatedBy: user.id },
      create: {
        id: SOCIAL_CONTENT_ID,
        handle: data.handle ?? null,
        displayName: data.displayName ?? null,
        tagline: data.tagline ?? null,
        isVisible: data.isVisible ?? true,
        updatedBy: user.id,
      },
    });

    await this.auditService.record({
      eventType: 'cms.social_content.updated',
      sourceService: 'cms-service',
      userId: user.id,
      companyId: null,
      entityType: 'social_content',
      entityId: SOCIAL_CONTENT_ID,
      action: 'update',
      previousValue: contentResource(before),
      newValue: contentResource(saved),
    });

    return contentResource(saved);
  }

  // Single-click engine: apply the shared content to every social channel,
  // optionally creating any missing platforms first and/or rewriting URLs
  // from the shared handle. Returns how many rows were created and updated.
  async applyContentToAll(user: AuthenticatedUser, opts: ApplySocialContentDto) {
    const content = await this.prisma.socialContent.findUnique({ where: { id: SOCIAL_CONTENT_ID } });
    if (!content) {
      throw new NotFoundAppException('Save the shared social content first, then apply it.');
    }

    const handle = content.handle?.trim() || null;
    const label = content.displayName?.trim() || null;
    const createMissing = opts.createMissing === true;
    const overwriteUrls = opts.overwriteUrls === true;

    let created = 0;
    let updated = 0;

    if (createMissing) {
      const existing = await this.prisma.socialLink.findMany({ select: { platform: true } });
      const have = new Set(existing.map((r) => r.platform));
      let sortOrder = (
        await this.prisma.socialLink.aggregate({ _max: { sortOrder: true } })
      )._max.sortOrder ?? 0;

      for (const platform of SOCIAL_PLATFORMS) {
        if (have.has(platform)) continue;
        const builder = PLATFORM_URL[platform];
        // "other", and any platform we can't build a URL for without a
        // handle, is skipped on create — it needs an explicit URL.
        if (!builder || !handle) continue;
        sortOrder += 1;
        await this.prisma.socialLink.create({
          data: {
            platform: platform as any,
            url: builder(handle),
            label,
            sortOrder,
            isVisible: content.isVisible,
            createdBy: user.id,
          },
        });
        created += 1;
      }
    }

    const rows = await this.prisma.socialLink.findMany({ orderBy: this.order() });
    for (const row of rows) {
      const data: any = { label, isVisible: content.isVisible };
      if (overwriteUrls && handle && PLATFORM_URL[row.platform]) {
        data.url = PLATFORM_URL[row.platform](handle);
      }
      await this.prisma.socialLink.update({ where: { id: row.id }, data });
      updated += 1;
    }

    await this.auditService.record({
      eventType: 'cms.social_content.applied',
      sourceService: 'cms-service',
      userId: user.id,
      companyId: null,
      entityType: 'social_content',
      entityId: SOCIAL_CONTENT_ID,
      action: 'update',
      previousValue: null,
      newValue: { created, updated, createMissing, overwriteUrls },
    });

    return { created, updated, channels: await this.list() };
  }

  // Single-click engine: delete every social channel row.
  async clearAllChannels(user: AuthenticatedUser) {
    const rows = await this.prisma.socialLink.findMany({ select: { id: true } });
    const { count } = await this.prisma.socialLink.deleteMany({});
    await this.auditService.record({
      eventType: 'cms.social_content.cleared',
      sourceService: 'cms-service',
      userId: user.id,
      companyId: null,
      entityType: 'social_content',
      entityId: SOCIAL_CONTENT_ID,
      action: 'delete',
      previousValue: { ids: rows.map((r) => r.id) },
      newValue: null,
    });
    return { deleted: count };
  }

  // -------- storefront (visible only) --------

  // The shared social content for the storefront footer — only when the
  // shared record is marked visible.
  async getPublicContent(lang = 'en') {
    const row = await this.prisma.socialContent.findUnique({ where: { id: SOCIAL_CONTENT_ID } });
    if (!row || !row.isVisible) return { displayName: null, tagline: null };
    return {
      displayName: row.displayName ? this.translation.toLocale(row.displayName, lang) : null,
      tagline: row.tagline ? this.translation.toLocale(row.tagline, lang) : null,
    };
  }

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
