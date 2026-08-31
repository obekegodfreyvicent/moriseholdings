import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConflictAppException, NotFoundAppException } from '../common/app-exception';
import { AuthenticatedUser } from '../common/strategies/jwt.strategy';
import { AuditService } from '../common/audit/audit.service';
import { ContentTranslationService } from '../common/translation/content-translation.service';
import { CreateContentBlockDto, UpdateContentBlockDto } from './dto/cms.dto';

function blockResource(b: any) {
  return {
    id: b.id,
    slug: b.slug,
    title: b.title,
    body: b.body,
    publishedBody: b.publishedBody,
    status: b.status,
    hasUnpublishedChanges: b.status === 'published' && b.publishedBody !== b.body,
    publishedAt: b.publishedAt,
    updatedBy: b.updatedBy,
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
  };
}

@Injectable()
export class CmsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly translation: ContentTranslationService,
  ) {}

  async list(_user: AuthenticatedUser) {
    const rows = await this.prisma.contentBlock.findMany({ orderBy: { slug: 'asc' } });
    return rows.map(blockResource);
  }

  async get(_user: AuthenticatedUser, id: string) {
    const row = await this.prisma.contentBlock.findUnique({ where: { id } });
    if (!row) throw new NotFoundAppException('Content block not found.');
    return blockResource(row);
  }

  async create(user: AuthenticatedUser, dto: CreateContentBlockDto) {
    const slug = dto.slug.trim().toLowerCase();
    const existing = await this.prisma.contentBlock.findUnique({ where: { slug } });
    if (existing) throw new ConflictAppException(`A content block with slug "${slug}" already exists.`);
    const created = await this.prisma.contentBlock.create({
      data: { slug, title: dto.title, body: dto.body, status: 'draft', updatedBy: user.id },
    });
    await this.audit(user, 'cms.content_block.created', created.id, null, blockResource(created));
    return blockResource(created);
  }

  async update(user: AuthenticatedUser, id: string, dto: UpdateContentBlockDto) {
    const row = await this.prisma.contentBlock.findUnique({ where: { id } });
    if (!row) throw new NotFoundAppException('Content block not found.');
    const data: any = { updatedBy: user.id };
    if (dto.slug !== undefined) {
      const slug = dto.slug.trim().toLowerCase();
      if (slug !== row.slug) {
        const clash = await this.prisma.contentBlock.findUnique({ where: { slug } });
        if (clash) throw new ConflictAppException(`A content block with slug "${slug}" already exists.`);
      }
      data.slug = slug;
    }
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.body !== undefined) data.body = dto.body;
    const updated = await this.prisma.contentBlock.update({ where: { id }, data });
    await this.audit(user, 'cms.content_block.updated', id, blockResource(row), blockResource(updated));
    return blockResource(updated);
  }

  async publish(user: AuthenticatedUser, id: string) {
    const row = await this.prisma.contentBlock.findUnique({ where: { id } });
    if (!row) throw new NotFoundAppException('Content block not found.');
    const updated = await this.prisma.contentBlock.update({
      where: { id },
      data: { publishedBody: row.body, status: 'published', publishedAt: new Date(), updatedBy: user.id },
    });
    await this.audit(user, 'cms.content_block.published', id, { status: row.status }, { status: 'published' });
    return blockResource(updated);
  }

  async unpublish(user: AuthenticatedUser, id: string) {
    const row = await this.prisma.contentBlock.findUnique({ where: { id } });
    if (!row) throw new NotFoundAppException('Content block not found.');
    const updated = await this.prisma.contentBlock.update({
      where: { id },
      data: { status: 'draft', updatedBy: user.id },
    });
    await this.audit(user, 'cms.content_block.unpublished', id, { status: row.status }, { status: 'draft' });
    return blockResource(updated);
  }

  async remove(user: AuthenticatedUser, id: string) {
    const row = await this.prisma.contentBlock.findUnique({ where: { id } });
    if (!row) throw new NotFoundAppException('Content block not found.');
    await this.prisma.contentBlock.delete({ where: { id } });
    await this.audit(user, 'cms.content_block.deleted', id, blockResource(row), null);
    return { deleted: true };
  }

  // -------- storefront (published only) --------

  // Storefront reads render title / body in the customer's language (`lang`)
  // as far as the content-translation glossary reaches — long body prose
  // beyond the glossary falls through to the translation provider (a no-op
  // until a real machine-translation service is configured).
  async listPublished(lang = 'en') {
    const rows = await this.prisma.contentBlock.findMany({
      where: { status: 'published' },
      orderBy: { slug: 'asc' },
      select: { slug: true, title: true },
    });
    return rows.map((r) => ({ slug: r.slug, title: this.translation.toLocale(r.title, lang) }));
  }

  async getPublished(slug: string, lang = 'en') {
    const row = await this.prisma.contentBlock.findFirst({
      where: { slug: slug.trim().toLowerCase(), status: 'published' },
    });
    if (!row) throw new NotFoundAppException('Page not found.');
    return {
      slug: row.slug,
      title: this.translation.toLocale(row.title, lang),
      body: this.translation.toLocale(row.publishedBody ?? row.body, lang),
      publishedAt: row.publishedAt,
    };
  }

  private audit(user: AuthenticatedUser, eventType: string, entityId: string, previousValue: unknown, newValue: unknown) {
    return this.auditService.record({
      eventType,
      sourceService: 'cms-service',
      userId: user.id,
      companyId: null,
      entityType: 'content_block',
      entityId,
      action: eventType.endsWith('deleted') ? 'delete' : eventType.endsWith('created') ? 'create' : 'update',
      previousValue,
      newValue,
    });
  }
}
