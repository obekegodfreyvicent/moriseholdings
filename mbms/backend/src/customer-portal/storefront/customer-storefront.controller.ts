import { Body, Controller, Get, Headers, Param, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CustomerJwtAuthGuard } from '../common/customer-jwt-auth.guard';
import { CurrentCustomer } from '../common/current-customer.decorator';
import { AuthenticatedCustomer } from '../common/customer-auth.types';
import { MarketingService } from '../../marketing/marketing.service';
import { CmsService } from '../../cms/cms.service';
import { SocialLinksService } from '../../cms/social-links.service';
import { FaqService } from '../../cms/faq.service';
import { NewsletterService } from '../../cms/newsletter.service';
import { DisclaimerService } from '../../cms/disclaimer.service';
import { NewsletterSubscribeDto } from '../../cms/dto/newsletter.dto';
import { CustomerCatalogService } from '../catalog/customer-catalog.service';
import { ContentTranslationService } from '../../common/translation/content-translation.service';
import { ValidateDiscountCodeDto } from '../../marketing/dto/marketing.dto';

// Storefront-facing reads for Marketing & Promos and CMS content
// (28 August 2026).
//
// Content is PUBLIC (no customer token) so the pre-login Landing page can
// render published pages too. Promo banners and discount-code validation
// sit inside the authenticated shopping flow.
//
// All three honour Accept-Language: banner and content text is returned in
// the customer's chosen language (glossary + provider seam), the same way
// the catalogue and support screens already do.

@Controller('customer-portal/content')
export class CustomerContentController {
  constructor(
    private readonly cmsService: CmsService,
    private readonly translation: ContentTranslationService,
  ) {}

  @Get()
  list(@Headers('accept-language') acceptLanguage?: string) {
    return this.cmsService.listPublished(this.translation.resolveLang(acceptLanguage));
  }

  @Get(':slug')
  get(@Param('slug') slug: string, @Headers('accept-language') acceptLanguage?: string) {
    return this.cmsService.getPublished(slug, this.translation.resolveLang(acceptLanguage));
  }
}

// Public, pre-login corporate site (29 August 2026) — the holding-company
// landing page, the Companies directory and the Group Overview page are
// rendered before a customer signs in, so this endpoint carries NO customer
// token. It returns only already-public facts: the holding company, its
// active subsidiaries with branches and ownership, and roll-up group
// figures. Honours Accept-Language like the rest of the storefront.
@Controller('customer-portal/public')
export class CustomerPublicController {
  constructor(
    private readonly catalogService: CustomerCatalogService,
    private readonly socialLinksService: SocialLinksService,
    private readonly faqService: FaqService,
    private readonly newsletterService: NewsletterService,
    private readonly disclaimerService: DisclaimerService,
    private readonly translation: ContentTranslationService,
  ) {}

  @Get('overview')
  overview(@Headers('accept-language') acceptLanguage?: string) {
    return this.catalogService.listGroupOverview(this.translation.resolveLang(acceptLanguage));
  }

  // Social media channels for the storefront / corporate-site footer —
  // visible ones only, in the order set in Admin » CMS / Site Builder.
  @Get('social-links')
  socialLinks(@Headers('accept-language') acceptLanguage?: string) {
    return this.socialLinksService.listPublic(this.translation.resolveLang(acceptLanguage));
  }

  // The shared social content (display name + tagline) the footer shows
  // above the channel row — only when the shared record is marked visible.
  @Get('social-content')
  socialContent(@Headers('accept-language') acceptLanguage?: string) {
    return this.socialLinksService.getPublicContent(this.translation.resolveLang(acceptLanguage));
  }

  // Landing-page FAQ — visible items only, in the admin-set order.
  @Get('faqs')
  faqs(@Headers('accept-language') acceptLanguage?: string) {
    return this.faqService.listPublic(this.translation.resolveLang(acceptLanguage));
  }

  // Site disclaimer gate — the statements a signed-out visitor acknowledges
  // before the landing page, plus how many seconds the "continue" button is
  // held. Visible items only, admin order, Accept-Language on the text.
  @Get('disclaimer')
  disclaimer(@Headers('accept-language') acceptLanguage?: string) {
    return this.disclaimerService.listPublic(this.translation.resolveLang(acceptLanguage));
  }

  // Landing-page newsletter sign-up. Public, rate-limited (SEC-05 style),
  // idempotent and non-enumerating.
  @Post('newsletter')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  subscribe(@Body() dto: NewsletterSubscribeDto) {
    return this.newsletterService.subscribe(dto);
  }
}

@Controller('customer-portal')
@UseGuards(CustomerJwtAuthGuard)
export class CustomerPromoController {
  constructor(
    private readonly marketingService: MarketingService,
    private readonly translation: ContentTranslationService,
  ) {}

  @Get('promo-banners')
  banners(@CurrentCustomer() customer: AuthenticatedCustomer, @Headers('accept-language') acceptLanguage?: string) {
    return this.marketingService.activeBannersForStorefront(
      customer.companyId,
      this.translation.resolveLang(acceptLanguage),
    );
  }

  @Post('discount-codes/validate')
  validate(@CurrentCustomer() customer: AuthenticatedCustomer, @Body() dto: ValidateDiscountCodeDto) {
    return this.marketingService.validateForStorefront(customer.companyId, dto.code, Number(dto.subtotal));
  }
}
