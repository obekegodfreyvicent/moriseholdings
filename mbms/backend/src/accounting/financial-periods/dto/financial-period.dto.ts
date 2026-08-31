import { IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateFinancialPeriodDto {
  @IsUUID()
  companyId: string;

  @IsString()
  periodName: string;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;
}

// "Closing entries" (General Ledger bullet, 19 August 2026): a real closing
// journal entry — zeroing revenue/expense into Retained Earnings — has been
// a long-standing, repeatedly-flagged gap in this codebase (the Balance
// Sheet report and the Dashboard's financials block have both carried a
// synthetic "Net Income (Current Period, Unposted)" equity line as a
// workaround since Sprint 10, precisely because no closing process existed
// to roll net income into equity for real). retainedEarningsAccountId is
// optional — the caller chooses the account, the same "let the caller pick
// the account" convention every other system-generated posting in this
// codebase already uses (Expense.pay(), Asset.dispose()); omitting it
// closes the period without generating a closing entry, preserving the
// exact behavior this endpoint always had before this pass.
export class CloseFinancialPeriodDto {
  @IsOptional()
  @IsUUID()
  retainedEarningsAccountId?: string;
}
