import { Module } from '@nestjs/common';
import { AccountsController } from './accounts/accounts.controller';
import { AccountsService } from './accounts/accounts.service';
import { FinancialPeriodsController } from './financial-periods/financial-periods.controller';
import { FinancialPeriodsService } from './financial-periods/financial-periods.service';
import { JournalEntriesController } from './journal-entries/journal-entries.controller';
import { JournalEntriesService } from './journal-entries/journal-entries.service';
import { ReportsController } from './reports/reports.controller';
import { RecurringEntriesController } from './recurring-entries/recurring-entries.controller';
import { RecurringEntriesService } from './recurring-entries/recurring-entries.service';
import { ReconciliationController } from './reconciliation/reconciliation.controller';
import { ReconciliationService } from './reconciliation/reconciliation.service';
import { BudgetsController } from './budgets/budgets.controller';
import { BudgetsService } from './budgets/budgets.service';

@Module({
  controllers: [
    AccountsController,
    FinancialPeriodsController,
    JournalEntriesController,
    ReportsController,
    RecurringEntriesController,
    ReconciliationController,
    BudgetsController,
  ],
  providers: [AccountsService, FinancialPeriodsService, JournalEntriesService, RecurringEntriesService, ReconciliationService, BudgetsService],
})
export class AccountingModule {}
