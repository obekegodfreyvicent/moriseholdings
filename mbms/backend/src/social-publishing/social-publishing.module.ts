import { Module } from '@nestjs/common';
import { SocialPublishingController } from './social-publishing.controller';
import { SocialPublishingService } from './social-publishing.service';

// Social Media Publishing (3 September 2026) — the Admin "Social Publishing"
// section: composer + fan-out publishing engine + status dashboard. See
// docx/24.
@Module({
  controllers: [SocialPublishingController],
  providers: [SocialPublishingService],
  exports: [SocialPublishingService],
})
export class SocialPublishingModule {}
