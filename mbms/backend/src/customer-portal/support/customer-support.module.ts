import { Module } from '@nestjs/common';
import { SupportModule } from '../../support/support.module';
import { CustomerSupportController } from './customer-support.controller';

@Module({
  imports: [SupportModule],
  controllers: [CustomerSupportController],
})
export class CustomerSupportPortalModule {}
