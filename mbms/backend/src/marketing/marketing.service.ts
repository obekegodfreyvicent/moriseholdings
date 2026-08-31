import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConflictAppException, NotFoundAppException } from '../common/app-exception';
import { AuthenticatedUser } from '../common/strategies/jwt.strategy';
import { hasGroupVisibility, isCompanyInScope } from '../common/scope.util';
import { AuditService } from '../common/audit/audit.service';
import { ContentTranslationService } from '../common/translation/content-translation.service';
import { evaluateDiscountCode } from './discount.util';
import {
  CreateBannerDto,
  CreateDiscountCodeDto,
  UpdateBannerDto,
  UpdateDiscountCodeDto,
} from './dto/marketing.dto';

const GROUP_PERM = 'marketing.viewAll';

function codeResource(c: any) {
  return {
    id: c.id,
    companyId: c.companyId,
    code: c.code,
    description: c.description,
    discountType: c.discountType,
    value: c.value?.toString() ?? '0',
    minOrderValue: c.minOrderValue?.toString() ?? null,
    maxRedemptions: c.maxRedemptions ?? null,
    timesRedeemed: c.timesRedeemed,
    startsAt: c.startsAt,
    endsAt: c.endsAt,
    status: c.status,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

function bannerResource(b: any) {
  return {
    id: b.id,
    companyId: b.companyId,
    heading: b.heading,
    body: b.body,
    linkUrl: b.linkUrl,
    linkLabel: b.linkLabel,
    placement: b.placement,
    sortOrder: b.sortOrder,
    startsAt: b.startsAt,
    endsAt: b.endsAt,
    active: b.active,
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
  };
}

const dateOrNull = (v?: string | null) => (v === undefined || v === null || v === '' ? null : new Date(v));

@Injectable()
export class MarketingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly translation: ContentTranslationService,
  ) {}

  private companyFilter(user: AuthenticatedUser, companyId?: string) {
    if (hasGroupVisibility(user, GROUP_PERM)) return companyId ? { companyId } : {};
    const scoped = user.scopes.map((s) => s.companyId);
    return {
      companyId:
        companyId && scoped.includes(companyId)
          ? companyId
          : { in: scoped.length > 0 ? scoped : ['__none__'] },
    };
  }

  // ------------------------------- discount codes -------------------------------

  async listDiscountCodes(user: AuthenticatedUser, companyId?: string) {
    const rows = await this.prisma.discountCode.findMany({
      where: this.companyFilter(user, companyId),
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(codeResource);
  }

  async createDiscountCode(user: AuthenticatedUser, dto: CreateDiscountCodeDto) {
    if (!isCompanyInScope(user, dto.companyId, GROUP_PERM)) throw new NotFoundAppException('Company not found.');
    const code = dto.code.trim().toUpperCase();
    const existing = await this.prisma.discountCode.findFirst({ where: { companyId: dto.companyId, code } });
    if (existing) throw new ConflictAppException(`Discount code "${code}" already exists for this company.`);

    if (dto.discountType === 'percentage' && Number(dto.value) > 100) {
      throw new ConflictAppException('A percentage discount cannot be greater than 100.');
    }

    const created = await this.prisma.discountCode.create({
      data: {
        companyId: dto.companyId,
        code,
        description: dto.description ?? null,
        discountType: dto.discountType,
        value: dto.value,
        minOrderValue: dto.minOrderValue ?? null,
        maxRedemptions: dto.maxRedemptions ?? null,
        startsAt: dateOrNull(dto.startsAt),
        endsAt: dateOrNull(dto.endsAt),
        createdBy: user.id,
      },
    });
    await this.audit(user, 'marketing.discount_code.created', created.companyId, created.id, null, codeResource(created));
    return codeResource(created);
  }

  async updateDiscountCode(user: AuthenticatedUser, id: string, dto: UpdateDiscountCodeDto) {
    const row = await this.prisma.discountCode.findUnique({ where: { id } });
    if (!row || !isCompanyInScope(user, row.companyId, GROUP_PERM)) throw new NotFoundAppException('Discount code not found.');

    const data: any = {};
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.discountType !== undefined) data.discountType = dto.discountType;
    if (dto.value !== undefined) data.value = dto.value;
    if (dto.minOrderValue !== undefined) data.minOrderValue = dto.minOrderValue;
    if (dto.maxRedemptions !== undefined) data.maxRedemptions = dto.maxRedemptions;
    if (dto.startsAt !== undefined) data.startsAt = dateOrNull(dto.startsAt);
    if (dto.endsAt !== undefined) data.endsAt = dateOrNull(dto.endsAt);

    const effectiveType = data.discountType ?? row.discountType;
    const effectiveValue = data.value ?? row.value;
    if (effectiveType === 'percentage' && Number(effectiveValue) > 100) {
      throw new ConflictAppException('A percentage discount cannot be greater than 100.');
    }

    const updated = await this.prisma.discountCode.update({ where: { id }, data });
    await this.audit(user, 'marketing.discount_code.updated', row.companyId, id, codeResource(row), codeResource(updated));
    return codeResource(updated);
  }

  async setDiscountStatus(user: AuthenticatedUser, id: string, status: 'active' | 'inactive') {
    const row = await this.prisma.discountCode.findUnique({ where: { id } });
    if (!row || !isCompanyInScope(user, row.companyId, GROUP_PERM)) throw new NotFoundAppException('Discount code not found.');
    const updated = await this.prisma.discountCode.update({ where: { id }, data: { status } });
    await this.audit(
      user,
      `marketing.discount_code.${status === 'active' ? 'activated' : 'deactivated'}`,
      row.companyId,
      id,
      { status: row.status },
      { status: updated.status },
    );
    return codeResource(updated);
  }

  async removeDiscountCode(user: AuthenticatedUser, id: string) {
    const row = await this.prisma.discountCode.findUnique({ where: { id } });
    if (!row || !isCompanyInScope(user, row.companyId, GROUP_PERM)) throw new NotFoundAppException('Discount code not found.');
    // orders.discount_code stores the code as text (not a foreign key), so an
    // order placed with this code keeps its record after the code is deleted.
    await this.prisma.discountCode.delete({ where: { id } });
    await this.audit(user, 'marketing.discount_code.deleted', row.companyId, id, codeResource(row), null);
    return { deleted: true };
  }

  // ---------------------------------- banners ----------------------------------

  async listBanners(user: AuthenticatedUser, companyId?: string) {
    const rows = await this.prisma.promoBanner.findMany({
      where: this.companyFilter(user, companyId),
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
    return rows.map(bannerResource);
  }

  async createBanner(user: AuthenticatedUser, dto: CreateBannerDto) {
    if (!isCompanyInScope(user, dto.companyId, GROUP_PERM)) throw new NotFoundAppException('Company not found.');
    const created = await this.prisma.promoBanner.create({
      data: {
        companyId: dto.companyId,
        heading: dto.heading,
        body: dto.body ?? null,
        linkUrl: dto.linkUrl ?? null,
        linkLabel: dto.linkLabel ?? null,
        placement: dto.placement ?? 'storefront_home',
        sortOrder: dto.sortOrder ?? 0,
        startsAt: dateOrNull(dto.startsAt),
        endsAt: dateOrNull(dto.endsAt),
        active: dto.active ?? true,
        createdBy: user.id,
      },
    });
    await this.audit(user, 'marketing.banner.created', created.companyId, created.id, null, bannerResource(created));
    return bannerResource(created);
  }

  async updateBanner(user: AuthenticatedUser, id: string, dto: UpdateBannerDto) {
    const row = await this.prisma.promoBanner.findUnique({ where: { id } });
    if (!row || !isCompanyInScope(user, row.companyId, GROUP_PERM)) throw new NotFoundAppException('Banner not found.');
    const data: any = {};
    for (const k of ['heading', 'body', 'linkUrl', 'linkLabel', 'placement', 'sortOrder', 'active'] as const) {
      if (dto[k] !== undefined) data[k] = dto[k];
    }
    if (dto.startsAt !== undefined) data.startsAt = dateOrNull(dto.startsAt);
    if (dto.endsAt !== undefined) data.endsAt = dateOrNull(dto.endsAt);
    const updated = await this.prisma.promoBanner.update({ where: { id }, data });
    await this.audit(user, 'marketing.banner.updated', row.companyId, id, bannerResource(row), bannerResource(updated));
    return bannerResource(updated);
  }

  async removeBanner(user: AuthenticatedUser, id: string) {
    const row = await this.prisma.promoBanner.findUnique({ where: { id } });
    if (!row || !isCompanyInScope(user, row.companyId, GROUP_PERM)) throw new NotFoundAppException('Banner not found.');
    await this.prisma.promoBanner.delete({ where: { id } });
    await this.audit(user, 'marketing.banner.deleted', row.companyId, id, bannerResource(row), null);
    return { deleted: true };
  }

  // ------------------------------- storefront use -------------------------------

  /**
   * Storefront: validate a code against a subtotal without redeeming it.
   * `messageKey` (+ `messageParams`) let the storefront show the outcome in
   * the customer's language; `message` is the English fallback.
   */
  async validateForStorefront(companyId: string, rawCode: string, subtotal: number) {
    // Match in canonical form: digits a customer typed in another numeral
    // script are normalised to 0-9 before the look-up (content localisation,
    // 30 August 2026), then upper-cased.
    const code = this.translation.toEnglish((rawCode || '').trim(), 'en').english.toUpperCase();
    if (!code) return { valid: false, messageKey: 'discount.enter', message: 'Enter a code.' };
    const row = await this.prisma.discountCode.findFirst({ where: { companyId, code } });
    const result = evaluateDiscountCode(row as any, subtotal);
    if (!result.ok) {
      return { valid: false, messageKey: result.messageKey, messageParams: result.messageParams ?? null, message: result.reason };
    }
    return {
      valid: true,
      code,
      discountType: row!.discountType,
      value: row!.value.toString(),
      discountAmount: result.discountAmount,
      messageKey: 'discount.applied',
      message: 'Code applied.',
    };
  }

  /**
   * Storefront home: currently-live banners for a company, with heading /
   * body / link label rendered in the customer's language (`lang`) as far as
   * the content-translation glossary reaches — consistent with the catalogue
   * and support screens.
   */
  async activeBannersForStorefront(companyId: string, lang = 'en') {
    const now = new Date();
    const rows = await this.prisma.promoBanner.findMany({
      where: {
        companyId,
        active: true,
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
        ],
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
    return rows.map((b) => ({
      id: b.id,
      heading: this.translation.toLocale(b.heading, lang),
      body: this.translation.toLocale(b.body, lang),
      linkUrl: b.linkUrl,
      linkLabel: this.translation.toLocale(b.linkLabel, lang),
    }));
  }

  private audit(
    user: AuthenticatedUser,
    eventType: string,
    companyId: string,
    entityId: string,
    previousValue: unknown,
    newValue: unknown,
  ) {
    return this.auditService.record({
      eventType,
      sourceService: 'marketing-service',
      userId: user.id,
      companyId,
      entityType: eventType.split('.')[1],
      entityId,
      action: eventType.endsWith('deleted') ? 'delete' : eventType.endsWith('created') ? 'create' : 'update',
      previousValue,
      newValue,
    });
  }
}
