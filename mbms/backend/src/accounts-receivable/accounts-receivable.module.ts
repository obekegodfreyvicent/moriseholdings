import { Module } from '@nestjs/common';
import { AccountsReceivableController } from './accounts-receivable.controller';
import { AccountsReceivableService } from './accounts-receivable.service';

@Module({
  controllers: [AccountsReceivableController],
  providers: [AccountsReceivableService],
})
export class AccountsReceivableModule {}
