import { Module } from '@nestjs/common';
import { CmsController } from './cms.controller';
import { CmsService } from './cms.service';
import { SocialLinksService } from './social-links.service';
import { FaqService } from './faq.service';
import { NewsletterService } from './newsletter.service';
import { DisclaimerService } from './disclaimer.service';

@Module({
  controllers: [CmsController],
  providers: [CmsService, SocialLinksService, FaqService, NewsletterService, DisclaimerService],
  exports: [CmsService, SocialLinksService, FaqService, NewsletterService, DisclaimerService],
})
export class CmsModule {}
