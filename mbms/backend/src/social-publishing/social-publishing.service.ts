import { Injectable, Logger } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { ConflictAppException, NotFoundAppException } from '../common/app-exception';
import { AuthenticatedUser } from '../common/strategies/jwt.strategy';
import { SOCIAL_PLATFORMS } from '../cms/dto/social-link.dto';
import {
  ConnectPlatformDto,
  CreateSocialPostDto,
  UpdateSocialPostDto,
} from './dto/social-publishing.dto';

// Social Media Publishing (3 September 2026) — a mini Buffer / Hootsuite.
// docx/24 has the full specification. Three layers: content creation (the
// composer), a publishing engine (dispatchOne, per platform), and
// orchestration (publishPost — the single button that fans one post out to
// many destinations).
//
// SIMULATED: dispatchOne() does NOT call a real platform API. In the
// approved architecture publishPost() enqueues one BullMQ job per target
// and returns immediately; here dispatchOne() runs inline and computes a
// deterministic success / failure from the platform's own rules (char
// limit, media requirement, connection state). A genuine per-platform
// integration slots in behind dispatchOne() without changing anything
// above it.

// Per-platform publishing rules — the character limits and media specs the
// composer previews against and the engine enforces. `truncates` = the
// platform silently trims an over-length caption (still a success) rather
// than rejecting it.
export const PLATFORM_RULES: Record<
  string,
  { name: string; charLimit: number; media: 'required' | 'optional' | 'none'; truncates: boolean; note: string; base: string }
> = {
  facebook: { name: 'Facebook', charLimit: 63206, media: 'optional', truncates: false, note: '', base: 'https://facebook.com' },
  x: { name: 'X', charLimit: 280, media: 'optional', truncates: true, note: 'Captions over 280 characters are trimmed with an ellipsis.', base: 'https://x.com' },
  instagram: { name: 'Instagram', charLimit: 2200, media: 'required', truncates: false, note: 'Instagram requires an image or a video.', base: 'https://instagram.com' },
  linkedin: { name: 'LinkedIn', charLimit: 3000, media: 'optional', truncates: false, note: '', base: 'https://linkedin.com' },
  youtube: { name: 'YouTube', charLimit: 5000, media: 'required', truncates: false, note: 'YouTube requires a video.', base: 'https://youtube.com' },
  tiktok: { name: 'TikTok', charLimit: 2200, media: 'required', truncates: false, note: 'TikTok requires a video.', base: 'https://tiktok.com' },
  whatsapp: { name: 'WhatsApp', charLimit: 65536, media: 'optional', truncates: false, note: 'Publishes to the linked WhatsApp Channel.', base: 'https://whatsapp.com/channel' },
  telegram: { name: 'Telegram', charLimit: 4096, media: 'optional', truncates: false, note: '', base: 'https://t.me' },
  other: { name: 'Other', charLimit: 5000, media: 'optional', truncates: false, note: '', base: 'https://example.com' },
};

const TOKEN_TTL_DAYS = 60; // real platforms expire tokens in ~60 days

type PostStatus = 'draft' | 'scheduled' | 'publishing' | 'published' | 'partially_failed' | 'failed';
type TargetStatus = 'pending' | 'publishing' | 'success' | 'failed' | 'skipped';

@Injectable()
export class SocialPublishingService {
  private readonly logger = new Logger('SocialPublishingService');

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  // ------------------------------------------------------- connections

  async listPlatforms() {
    const connections = await this.prisma.socialConnection.findMany();
    const byPlatform = new Map(connections.map((c) => [c.platform as string, c]));
    const now = Date.now();
    return SOCIAL_PLATFORMS.map((platform) => {
      const rule = PLATFORM_RULES[platform];
      const c = byPlatform.get(platform);
      const expiresInDays = c?.tokenExpiresAt
        ? Math.round((new Date(c.tokenExpiresAt).getTime() - now) / 86_400_000)
        : null;
      const connected = !!c && c.status === 'connected' && (expiresInDays === null || expiresInDays > 0);
      return {
        platform,
        name: rule.name,
        charLimit: rule.charLimit,
        mediaRule: rule.media,
        note: rule.note,
        connected,
        connectionStatus: !c ? 'disconnected' : expiresInDays !== null && expiresInDays <= 0 ? 'expired' : c.status,
        accountLabel: c?.accountLabel ?? null,
        connectedAt: c?.connectedAt ?? null,
        tokenExpiresAt: c?.tokenExpiresAt ?? null,
        expiresInDays,
        expiringSoon: connected && expiresInDays !== null && expiresInDays <= 7,
      };
    });
  }

  async connect(user: AuthenticatedUser, platform: string, dto: ConnectPlatformDto) {
    this.assertPlatform(platform);
    const expires = new Date(Date.now() + TOKEN_TTL_DAYS * 86_400_000);
    const row = await this.prisma.socialConnection.upsert({
      where: { platform: platform as any },
      update: {
        status: 'connected',
        accountLabel: dto.accountLabel?.trim() || undefined,
        connectedBy: user.id,
        connectedAt: new Date(),
        tokenExpiresAt: expires,
        accessTokenRef: `sim_${platform}_${randomBytes(6).toString('hex')}`,
      },
      create: {
        platform: platform as any,
        status: 'connected',
        accountLabel: dto.accountLabel?.trim() || null,
        connectedBy: user.id,
        tokenExpiresAt: expires,
        accessTokenRef: `sim_${platform}_${randomBytes(6).toString('hex')}`,
      },
    });
    await this.audit(user, 'social.connection.connected', platform, null, { accountLabel: row.accountLabel });
    return this.listPlatforms();
  }

  async disconnect(user: AuthenticatedUser, platform: string) {
    this.assertPlatform(platform);
    await this.prisma.socialConnection.deleteMany({ where: { platform: platform as any } });
    await this.audit(user, 'social.connection.disconnected', platform, null, null);
    return this.listPlatforms();
  }

  // ------------------------------------------------------- posts (composer)

  async createPost(user: AuthenticatedUser, dto: CreateSocialPostDto) {
    const platforms = this.uniquePlatforms(dto.targets.map((t) => t.platform));
    const scheduledFor = dto.scheduledFor ? new Date(dto.scheduledFor) : null;
    const status: PostStatus = scheduledFor && scheduledFor.getTime() > Date.now() ? 'scheduled' : 'draft';

    const post = await this.prisma.socialPost.create({
      data: {
        title: dto.title?.trim() || null,
        bodyMaster: dto.bodyMaster,
        mediaType: (dto.mediaType ?? 'none') as any,
        mediaUrl: dto.mediaUrl?.trim() || null,
        linkUrl: dto.linkUrl?.trim() || null,
        status: status as any,
        scheduledFor,
        createdBy: user.id,
        targets: {
          create: platforms.map((platform) => ({
            platform: platform as any,
            caption: dto.targets.find((t) => t.platform === platform)?.caption?.trim() || null,
          })),
        },
      },
      include: { targets: true },
    });
    await this.audit(user, 'social.post.created', null, post.id, { title: post.title, platforms, status });
    return this.getPost(post.id);
  }

  async listPosts(filters: { status?: string }) {
    const where: any = {};
    if (filters.status && this.isPostStatus(filters.status)) where.status = filters.status;
    const posts = await this.prisma.socialPost.findMany({
      where,
      include: { targets: true },
      orderBy: [{ createdAt: 'desc' }],
      take: 200,
    });
    return posts.map((p) => this.postSummary(p));
  }

  async getPost(id: string) {
    const post = await this.prisma.socialPost.findUnique({ where: { id }, include: { targets: true } });
    if (!post) throw new NotFoundAppException('Post not found.');
    const platforms = await this.listPlatforms();
    const connByPlatform = new Map(platforms.map((p) => [p.platform, p]));
    const targets = post.targets
      .slice()
      .sort((a, b) => SOCIAL_PLATFORMS.indexOf(a.platform as any) - SOCIAL_PLATFORMS.indexOf(b.platform as any))
      .map((t) => {
        const rule = PLATFORM_RULES[t.platform];
        const effectiveCaption = (t.caption ?? post.bodyMaster) || '';
        const charCount = effectiveCaption.length;
        const conn = connByPlatform.get(t.platform as any);
        const warnings: string[] = [];
        const overLimit = charCount > rule.charLimit;
        if (overLimit && rule.truncates) warnings.push(`Over ${rule.charLimit} characters — will be trimmed on ${rule.name}.`);
        if (overLimit && !rule.truncates) warnings.push(`Over the ${rule.charLimit}-character ${rule.name} limit — this platform will reject it.`);
        if (rule.media === 'required' && post.mediaType === 'none') warnings.push(rule.note || `${rule.name} requires media.`);
        if (!conn?.connected) warnings.push(`${rule.name} is not connected — connect it before publishing.`);
        return {
          id: t.id,
          platform: t.platform,
          platformName: rule.name,
          caption: t.caption,
          effectiveCaption,
          charCount,
          charLimit: rule.charLimit,
          overLimit,
          willTruncate: overLimit && rule.truncates,
          mediaRule: rule.media,
          connected: !!conn?.connected,
          status: t.status,
          externalId: t.externalId,
          externalUrl: t.externalUrl,
          error: t.error,
          attempts: t.attempts,
          lastAttemptAt: t.lastAttemptAt,
          publishedAt: t.publishedAt,
          warnings,
        };
      });
    return {
      id: post.id,
      title: post.title,
      bodyMaster: post.bodyMaster,
      mediaType: post.mediaType,
      mediaUrl: post.mediaUrl,
      linkUrl: post.linkUrl,
      status: post.status,
      scheduledFor: post.scheduledFor,
      publishedAt: post.publishedAt,
      createdBy: post.createdBy,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      targets,
      canEdit: ['draft', 'scheduled', 'failed', 'partially_failed'].includes(post.status),
      canPublish: ['draft', 'scheduled', 'failed', 'partially_failed'].includes(post.status) && targets.length > 0,
      canRetry: targets.some((t) => t.status === 'failed'),
    };
  }

  async updatePost(user: AuthenticatedUser, id: string, dto: UpdateSocialPostDto) {
    const post = await this.prisma.socialPost.findUnique({ where: { id }, include: { targets: true } });
    if (!post) throw new NotFoundAppException('Post not found.');
    if (!['draft', 'scheduled', 'failed', 'partially_failed'].includes(post.status)) {
      throw new ConflictAppException(`A "${post.status}" post cannot be edited.`);
    }

    const data: any = {};
    if (dto.title !== undefined) data.title = dto.title.trim() || null;
    if (dto.bodyMaster !== undefined) data.bodyMaster = dto.bodyMaster;
    if (dto.mediaType !== undefined) data.mediaType = dto.mediaType;
    if (dto.mediaUrl !== undefined) data.mediaUrl = dto.mediaUrl.trim() || null;
    if (dto.linkUrl !== undefined) data.linkUrl = dto.linkUrl.trim() || null;
    if (dto.scheduledFor !== undefined) {
      const when = dto.scheduledFor ? new Date(dto.scheduledFor) : null;
      data.scheduledFor = when;
      if (post.status === 'draft' || post.status === 'scheduled') {
        data.status = when && when.getTime() > Date.now() ? 'scheduled' : 'draft';
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.socialPost.update({ where: { id }, data });
      if (dto.targets) {
        const wanted = this.uniquePlatforms(dto.targets.map((t) => t.platform));
        const existing = new Map(post.targets.map((t) => [t.platform as string, t]));
        // remove de-selected (only if not already published successfully)
        for (const t of post.targets) {
          if (!wanted.includes(t.platform as string) && t.status !== 'success') {
            await tx.socialPostTarget.delete({ where: { id: t.id } });
          }
        }
        for (const platform of wanted) {
          const caption = dto.targets.find((t) => t.platform === platform)?.caption?.trim() || null;
          const row = existing.get(platform);
          if (row) {
            if (row.status !== 'success') await tx.socialPostTarget.update({ where: { id: row.id }, data: { caption } });
          } else {
            await tx.socialPostTarget.create({ data: { postId: id, platform: platform as any, caption } });
          }
        }
      }
    });
    await this.audit(user, 'social.post.updated', null, id, { fields: Object.keys(data) });
    return this.getPost(id);
  }

  async deletePost(user: AuthenticatedUser, id: string) {
    const post = await this.prisma.socialPost.findUnique({ where: { id } });
    if (!post) throw new NotFoundAppException('Post not found.');
    if (post.status === 'published') {
      throw new ConflictAppException('A published post cannot be deleted — it is a record of what went out.');
    }
    await this.prisma.socialPost.delete({ where: { id } });
    await this.audit(user, 'social.post.deleted', null, id, { title: post.title });
    return { deleted: true };
  }

  // ------------------------------------------------------- publish (orchestration)

  async publishPost(user: AuthenticatedUser, id: string, onlyFailed = false) {
    const post = await this.prisma.socialPost.findUnique({ where: { id }, include: { targets: true } });
    if (!post) throw new NotFoundAppException('Post not found.');
    if (!['draft', 'scheduled', 'failed', 'partially_failed'].includes(post.status)) {
      throw new ConflictAppException(`A "${post.status}" post cannot be published.`);
    }
    if (post.targets.length === 0) throw new ConflictAppException('Add at least one platform before publishing.');

    const platforms = await this.listPlatforms();
    const connByPlatform = new Map(platforms.map((p) => [p.platform, p]));

    await this.prisma.socialPost.update({ where: { id }, data: { status: 'publishing' as any } });

    const toRun = post.targets.filter((t) =>
      onlyFailed ? t.status === 'failed' : t.status !== 'success',
    );
    for (const target of toRun) {
      const outcome = this.dispatchOne(post, target, connByPlatform.get(target.platform as any));
      await this.prisma.socialPostTarget.update({
        where: { id: target.id },
        data: {
          status: outcome.status as any,
          externalId: outcome.externalId ?? null,
          externalUrl: outcome.externalUrl ?? null,
          error: outcome.error ?? null,
          attempts: { increment: 1 },
          lastAttemptAt: new Date(),
          publishedAt: outcome.status === 'success' ? new Date() : target.publishedAt,
        },
      });
    }

    const fresh = await this.prisma.socialPostTarget.findMany({ where: { postId: id } });
    const successCount = fresh.filter((t) => t.status === 'success').length;
    const failedCount = fresh.filter((t) => t.status === 'failed').length;
    const newStatus: PostStatus =
      successCount === fresh.length ? 'published' : successCount === 0 ? 'failed' : 'partially_failed';
    await this.prisma.socialPost.update({
      where: { id },
      data: {
        status: newStatus as any,
        publishedAt: newStatus === 'published' ? new Date() : post.publishedAt,
      },
    });

    await this.audit(user, onlyFailed ? 'social.post.retried' : 'social.post.published', null, id, {
      success: successCount,
      failed: failedCount,
      total: fresh.length,
      status: newStatus,
      simulated: true,
    });
    return this.getPost(id);
  }

  // Fire every scheduled post whose time has come. A stand-in for the cron /
  // worker of the approved architecture (there is no job scheduler in this
  // build); an administrator with social.post.publish can call it, and the
  // storefront's own scheduling relies on this too.
  async runScheduled(user: AuthenticatedUser) {
    const due = await this.prisma.socialPost.findMany({
      where: { status: 'scheduled' as any, scheduledFor: { lte: new Date() } },
      select: { id: true },
    });
    const results: { id: string; status: string }[] = [];
    for (const p of due) {
      const r = await this.publishPost(user, p.id);
      results.push({ id: p.id, status: r.status });
    }
    return { fired: results.length, results };
  }

  // The simulated per-platform publish. A genuine integration replaces the
  // body of this method (call the platform API with the stored token) and
  // nothing above it changes.
  private dispatchOne(
    post: { bodyMaster: string; mediaType: string; linkUrl: string | null },
    target: { platform: string; caption: string | null },
    conn: { connected: boolean } | undefined,
  ): { status: TargetStatus; externalId?: string; externalUrl?: string; error?: string } {
    const rule = PLATFORM_RULES[target.platform];
    if (!conn?.connected) {
      return { status: 'failed', error: `${rule.name} is not connected. Connect the channel and retry.` };
    }
    const caption = (target.caption ?? post.bodyMaster) || '';
    if (caption.trim().length === 0 && post.mediaType === 'none' && !post.linkUrl) {
      return { status: 'failed', error: 'Nothing to publish — add a caption, media or a link.' };
    }
    if (caption.length > rule.charLimit && !rule.truncates) {
      return { status: 'failed', error: `Caption is ${caption.length} characters; the ${rule.name} limit is ${rule.charLimit}.` };
    }
    if (rule.media === 'required' && post.mediaType === 'none') {
      return { status: 'failed', error: rule.note || `${rule.name} requires an image or a video.` };
    }
    // Success — mint a fake permalink the dashboard can link to.
    const externalId = `sim-${target.platform}-${randomBytes(5).toString('hex')}`;
    return { status: 'success', externalId, externalUrl: `${rule.base}/p/${externalId}` };
  }

  // ------------------------------------------------------- dashboard

  async dashboard() {
    const [posts, targets, platforms] = await Promise.all([
      this.prisma.socialPost.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.socialPostTarget.groupBy({ by: ['status'], _count: { _all: true } }),
      this.listPlatforms(),
    ]);
    const postCounts: Record<string, number> = {};
    for (const p of posts) postCounts[p.status] = p._count._all;
    const targetCounts: Record<string, number> = {};
    for (const t of targets) targetCounts[t.status] = t._count._all;

    const recentRows = await this.prisma.socialPost.findMany({
      include: { targets: true },
      orderBy: [{ updatedAt: 'desc' }],
      take: 8,
    });

    return {
      posts: {
        draft: postCounts.draft ?? 0,
        scheduled: postCounts.scheduled ?? 0,
        published: postCounts.published ?? 0,
        partiallyFailed: postCounts.partially_failed ?? 0,
        failed: postCounts.failed ?? 0,
      },
      targets: {
        success: targetCounts.success ?? 0,
        failed: targetCounts.failed ?? 0,
        pending: targetCounts.pending ?? 0,
      },
      connections: {
        connected: platforms.filter((p) => p.connected).length,
        expiringSoon: platforms.filter((p) => p.expiringSoon).length,
        disconnected: platforms.filter((p) => !p.connected).length,
      },
      recent: recentRows.map((p) => ({
        ...this.postSummary(p),
        outcomes: p.targets.map((t) => ({
          platform: t.platform,
          platformName: PLATFORM_RULES[t.platform].name,
          status: t.status,
          externalUrl: t.externalUrl,
          error: t.error,
        })),
      })),
    };
  }

  // ------------------------------------------------------- internals

  private postSummary(p: { id: string; title: string | null; bodyMaster: string; status: string; mediaType: string; scheduledFor: Date | null; publishedAt: Date | null; createdAt: Date; updatedAt: Date; targets: { status: string }[] }) {
    const byStatus: Record<string, number> = {};
    for (const t of p.targets) byStatus[t.status] = (byStatus[t.status] ?? 0) + 1;
    return {
      id: p.id,
      title: p.title,
      excerpt: p.bodyMaster.length > 140 ? `${p.bodyMaster.slice(0, 140)}…` : p.bodyMaster,
      status: p.status,
      mediaType: p.mediaType,
      scheduledFor: p.scheduledFor,
      publishedAt: p.publishedAt,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      targetCount: p.targets.length,
      targetsSucceeded: byStatus.success ?? 0,
      targetsFailed: byStatus.failed ?? 0,
      targetsPending: byStatus.pending ?? 0,
    };
  }

  private uniquePlatforms(list: string[]): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const p of list) {
      this.assertPlatform(p);
      if (!seen.has(p)) {
        seen.add(p);
        out.push(p);
      }
    }
    return out;
  }

  private assertPlatform(platform: string) {
    if (!(SOCIAL_PLATFORMS as readonly string[]).includes(platform)) {
      throw new NotFoundAppException(`Unknown platform "${platform}".`);
    }
  }

  private isPostStatus(s: string): s is PostStatus {
    return ['draft', 'scheduled', 'publishing', 'published', 'partially_failed', 'failed'].includes(s);
  }

  private audit(user: AuthenticatedUser, eventType: string, platform: string | null, entityId: string | null, newValue: unknown) {
    return this.auditService.record({
      eventType,
      sourceService: 'social-publishing-service',
      userId: user.id,
      companyId: null,
      entityType: eventType.includes('connection') ? 'social_connection' : 'social_post',
      entityId: entityId ?? platform,
      action: eventType.endsWith('created') || eventType.endsWith('connected') ? 'create' : eventType.endsWith('deleted') || eventType.endsWith('disconnected') ? 'delete' : 'update',
      newValue,
    });
  }
}
