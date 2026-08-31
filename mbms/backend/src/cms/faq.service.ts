import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundAppException } from '../common/app-exception';
import { AuthenticatedUser } from '../common/strategies/jwt.strategy';
import { AuditService } from '../common/audit/audit.service';
import { ContentTranslationService } from '../common/translation/content-translation.service';
import { CreateFaqItemDto, UpdateFaqItemDto } from './dto/faq.dto';

function faqResource(r: any) {
  return {
    id: r.id,
    question: r.question,
    answer: r.answer,
    sortOrder: r.sortOrder,
    isVisible: r.isVisible,
    createdBy: r.createdBy,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

// Landing-page FAQ (29 August 2026). Managed in Admin » CMS / Site Builder
// (cms.viewAll to read, cms.manage to change), shown in the FAQ section of
// the corporate landing page. Site-wide — the same scope model as
// ContentBlock / SocialLink.
@Injectable()
export class FaqService {
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
    const rows = await this.prisma.faqItem.findMany({ orderBy: this.order() });
    return rows.map(faqResource);
  }

  async create(user: AuthenticatedUser, dto: CreateFaqItemDto) {
    const created = await this.prisma.faqItem.create({
      data: {
        question: dto.question.trim(),
        answer: dto.answer.trim(),
        sortOrder: dto.sortOrder ?? 0,
        isVisible: dto.isVisible ?? true,
        createdBy: user.id,
      },
    });
    await this.audit(user, 'cms.faq_item.created', created.id, null, faqResource(created));
    return faqResource(created);
  }

  async update(user: AuthenticatedUser, id: string, dto: UpdateFaqItemDto) {
    const row = await this.prisma.faqItem.findUnique({ where: { id } });
    if (!row) throw new NotFoundAppException('FAQ item not found.');

    const data: any = {};
    if (dto.question !== undefined) data.question = dto.question.trim();
    if (dto.answer !== undefined) data.answer = dto.answer.trim();
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
    if (dto.isVisible !== undefined) data.isVisible = dto.isVisible;

    const updated = await this.prisma.faqItem.update({ where: { id }, data });
    await this.audit(user, 'cms.faq_item.updated', id, faqResource(row), faqResource(updated));
    return faqResource(updated);
  }

  async remove(user: AuthenticatedUser, id: string) {
    const row = await this.prisma.faqItem.findUnique({ where: { id } });
    if (!row) throw new NotFoundAppException('FAQ item not found.');
    await this.prisma.faqItem.delete({ where: { id } });
    await this.audit(user, 'cms.faq_item.deleted', id, faqResource(row), null);
    return { deleted: true };
  }

  // -------- storefront (visible only) --------

  async listPublic(lang = 'en') {
    const rows = await this.prisma.faqItem.findMany({
      where: { isVisible: true },
      orderBy: this.order(),
      select: { id: true, question: true, answer: true },
    });
    return rows.map((r) => ({
      id: r.id,
      question: this.translation.toLocale(r.question, lang),
      answer: this.translation.toLocale(r.answer, lang),
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
      entityType: 'faq_item',
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
