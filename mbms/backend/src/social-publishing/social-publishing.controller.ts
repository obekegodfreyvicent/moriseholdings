import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/strategies/jwt.strategy';
import { SocialPublishingService } from './social-publishing.service';
import { ConnectPlatformDto, CreateSocialPostDto, UpdateSocialPostDto } from './dto/social-publishing.dto';

// Base path /api/v1/social — the Admin "Social Publishing" section
// (3 September 2026): a mini Buffer / Hootsuite. Reads need
// social.post.viewAll, social.post.manage or social.post.publish; drafting /
// editing / connecting need social.post.manage; publishing / retrying /
// running the schedule need social.post.publish. Site-wide, not
// per-company. See docx/24.
@Controller('social')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SocialPublishingController {
  constructor(private readonly social: SocialPublishingService) {}

  // ---- platforms / connections ----

  @Get('platforms')
  @RequirePermission('social.post.manage', 'social.post.publish', 'social.post.viewAll')
  platforms() {
    return this.social.listPlatforms();
  }

  @Post('platforms/:platform/connect')
  @RequirePermission('social.post.manage')
  connect(
    @CurrentUser() user: AuthenticatedUser,
    @Param('platform') platform: string,
    @Body() dto: ConnectPlatformDto,
  ) {
    return this.social.connect(user, platform, dto);
  }

  @Post('platforms/:platform/disconnect')
  @RequirePermission('social.post.manage')
  disconnect(@CurrentUser() user: AuthenticatedUser, @Param('platform') platform: string) {
    return this.social.disconnect(user, platform);
  }

  // ---- dashboard ----

  @Get('dashboard')
  @RequirePermission('social.post.manage', 'social.post.publish', 'social.post.viewAll')
  dashboard() {
    return this.social.dashboard();
  }

  // ---- posts ----

  @Get('posts')
  @RequirePermission('social.post.manage', 'social.post.publish', 'social.post.viewAll')
  list(@Query('filter[status]') status?: string) {
    return this.social.listPosts({ status });
  }

  @Post('posts')
  @RequirePermission('social.post.manage')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateSocialPostDto) {
    return this.social.createPost(user, dto);
  }

  @Post('run-scheduled')
  @RequirePermission('social.post.publish')
  runScheduled(@CurrentUser() user: AuthenticatedUser) {
    return this.social.runScheduled(user);
  }

  @Get('posts/:id')
  @RequirePermission('social.post.manage', 'social.post.publish', 'social.post.viewAll')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.social.getPost(id);
  }

  @Patch('posts/:id')
  @RequirePermission('social.post.manage')
  update(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateSocialPostDto) {
    return this.social.updatePost(user, id, dto);
  }

  @Delete('posts/:id')
  @RequirePermission('social.post.manage')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.social.deletePost(user, id);
  }

  @Post('posts/:id/publish')
  @RequirePermission('social.post.publish')
  publish(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.social.publishPost(user, id, false);
  }

  @Post('posts/:id/retry')
  @RequirePermission('social.post.publish')
  retry(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.social.publishPost(user, id, true);
  }
}
