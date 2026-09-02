import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/strategies/jwt.strategy';
import { CmsService } from './cms.service';
import { SocialLinksService } from './social-links.service';
import { FaqService } from './faq.service';
import { NewsletterService } from './newsletter.service';
import { DisclaimerService } from './disclaimer.service';
import { CreateContentBlockDto, UpdateContentBlockDto } from './dto/cms.dto';
import {
  CreateSocialLinkDto,
  UpdateSocialLinkDto,
  UpsertPlatformLinkDto,
} from './dto/social-link.dto';
import { ApplySocialContentDto, UpdateSocialContentDto } from './dto/social-content.dto';
import { CreateFaqItemDto, UpdateFaqItemDto } from './dto/faq.dto';
import { CreateDisclaimerItemDto, UpdateDisclaimerItemDto } from './dto/disclaimer.dto';

// Base path /api/v1/cms — the Admin "CMS / Site Builder" section
// (28 August 2026). Reads need cms.viewAll or cms.manage; writes and
// publish/unpublish need cms.manage. Site-wide content, not per-company.
@Controller('cms')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('cms.manage', 'cms.viewAll')
export class CmsController {
  constructor(
    private readonly cmsService: CmsService,
    private readonly socialLinksService: SocialLinksService,
    private readonly faqService: FaqService,
    private readonly newsletterService: NewsletterService,
    private readonly disclaimerService: DisclaimerService,
  ) {}

  @Get('blocks')
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.cmsService.list(user);
  }

  @Get('blocks/:id')
  get(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.cmsService.get(user, id);
  }

  @Post('blocks')
  @RequirePermission('cms.manage')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateContentBlockDto) {
    return this.cmsService.create(user, dto);
  }

  @Patch('blocks/:id')
  @RequirePermission('cms.manage')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateContentBlockDto,
  ) {
    return this.cmsService.update(user, id, dto);
  }

  @Post('blocks/:id/publish')
  @RequirePermission('cms.manage')
  publish(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.cmsService.publish(user, id);
  }

  @Post('blocks/:id/unpublish')
  @RequirePermission('cms.manage')
  unpublish(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.cmsService.unpublish(user, id);
  }

  @Delete('blocks/:id')
  @RequirePermission('cms.manage')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.cmsService.remove(user, id);
  }

  // ---- Social media channels (29 August 2026) ----
  // Managed here, displayed in the storefront footer. Reads: cms.viewAll or
  // cms.manage (controller-level); writes: cms.manage.

  @Get('social-links')
  listSocial() {
    return this.socialLinksService.list();
  }

  // The fixed roster — every supported platform, whether or not a channel row
  // exists yet. This is what the CMS / Site Builder panel renders so that
  // "all social media channels" are managed from one place.
  @Get('social-links/roster')
  listSocialRoster() {
    return this.socialLinksService.listRoster();
  }

  @Post('social-links')
  @RequirePermission('cms.manage')
  createSocial(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateSocialLinkDto) {
    return this.socialLinksService.create(user, dto);
  }

  // Roster save: create / update / (on an explicit empty url) delete the one
  // channel row for a platform.
  @Put('social-links/platform/:platform')
  @RequirePermission('cms.manage')
  upsertSocialPlatform(
    @CurrentUser() user: AuthenticatedUser,
    @Param('platform') platform: string,
    @Body() dto: UpsertPlatformLinkDto,
  ) {
    return this.socialLinksService.upsertPlatform(user, platform, dto);
  }

  @Patch('social-links/:id')
  @RequirePermission('cms.manage')
  updateSocial(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSocialLinkDto,
  ) {
    return this.socialLinksService.update(user, id, dto);
  }

  @Delete('social-links/:id')
  @RequirePermission('cms.manage')
  removeSocial(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.socialLinksService.remove(user, id);
  }

  // ---- Shared social content (2 September 2026) ----
  // One canonical record (handle / display name / tagline / visibility). The
  // three actions below each apply it to *every* social channel in a single
  // click, so all channels carry the same information. Reads: cms.viewAll or
  // cms.manage (controller-level); writes: cms.manage.

  @Get('social-content')
  getSocialContent() {
    return this.socialLinksService.getContent();
  }

  @Put('social-content')
  @RequirePermission('cms.manage')
  saveSocialContent(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateSocialContentDto,
  ) {
    return this.socialLinksService.saveContent(user, dto);
  }

  // Single click: push the shared content onto every channel. With
  // { createMissing: true } it also adds a channel for every supported
  // platform first; with { overwriteUrls: true } it rebuilds each URL from
  // the shared handle.
  @Post('social-content/apply')
  @RequirePermission('cms.manage')
  applySocialContent(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ApplySocialContentDto,
  ) {
    return this.socialLinksService.applyContentToAll(user, dto);
  }

  // Single click: delete every social channel.
  @Delete('social-content/channels')
  @RequirePermission('cms.manage')
  clearSocialChannels(@CurrentUser() user: AuthenticatedUser) {
    return this.socialLinksService.clearAllChannels(user);
  }

  // ---- Landing-page FAQ (29 August 2026) ----

  @Get('faqs')
  listFaqs() {
    return this.faqService.list();
  }

  @Post('faqs')
  @RequirePermission('cms.manage')
  createFaq(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateFaqItemDto) {
    return this.faqService.create(user, dto);
  }

  @Patch('faqs/:id')
  @RequirePermission('cms.manage')
  updateFaq(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFaqItemDto,
  ) {
    return this.faqService.update(user, id, dto);
  }

  @Delete('faqs/:id')
  @RequirePermission('cms.manage')
  removeFaq(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.faqService.remove(user, id);
  }

  // ---- Newsletter sign-ups (29 August 2026) ----
  // The list is read-only for cms.viewAll; deleting a subscriber needs
  // cms.manage. Sign-up itself happens on the public storefront endpoint.

  @Get('newsletter-subscribers')
  listNewsletter() {
    return this.newsletterService.list();
  }

  @Delete('newsletter-subscribers/:id')
  @RequirePermission('cms.manage')
  removeNewsletter(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.newsletterService.remove(user, id);
  }

  // ---- Site disclaimer (30 August 2026) ----
  // The statements shown on the full-page disclaimer gate a signed-out
  // visitor acknowledges before the landing page. Reads: cms.viewAll or
  // cms.manage (controller-level); writes: cms.manage.

  @Get('disclaimer-items')
  listDisclaimer() {
    return this.disclaimerService.list();
  }

  @Post('disclaimer-items')
  @RequirePermission('cms.manage')
  createDisclaimer(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateDisclaimerItemDto) {
    return this.disclaimerService.create(user, dto);
  }

  @Patch('disclaimer-items/:id')
  @RequirePermission('cms.manage')
  updateDisclaimer(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDisclaimerItemDto,
  ) {
    return this.disclaimerService.update(user, id, dto);
  }

  @Delete('disclaimer-items/:id')
  @RequirePermission('cms.manage')
  removeDisclaimer(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.disclaimerService.remove(user, id);
  }
}
