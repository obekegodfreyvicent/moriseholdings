import { Module } from '@nestjs/common';
import { SalesModule } from '../../sales/sales.module';
import { SupportModule } from '../../support/support.module';
import { CustomerAccountController } from './customer-account.controller';
import { CustomerAccountService } from './customer-account.service';

@Module({
  imports: [SalesModule, SupportModule],
  controllers: [CustomerAccountController],
  providers: [CustomerAccountService],
})
export class CustomerAccountModule {}
