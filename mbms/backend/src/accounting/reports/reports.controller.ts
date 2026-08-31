import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ParseUUIDPipe } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/strategies/jwt.strategy';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundAppException } from '../../common/app-exception';
import { isCompanyInScope } from '../../common/scope.util';

// GET /api/v1/accounting/reports/trial-balance — 09_API Specification, Section 9.
@Controller('accounting/reports')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ReportsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('trial-balance')
  async trialBalance(
    @CurrentUser() user: AuthenticatedUser,
    @Query('companyId', ParseUUIDPipe) companyId: string,
    @Query('periodId', ParseUUIDPipe) periodId: string,
  ) {
    if (!isCompanyInScope(user, companyId, 'accounting.viewAll')) {
      throw new NotFoundAppException('Company not found.');
    }
    const period = await this.prisma.financialPeriod.findUnique({ where: { id: periodId } });
    if (!period || period.companyId !== companyId) {
      throw new NotFoundAppException('Financial period not found for this company.');
    }

    // FR-ACC-04 / AC-09: only posted entries feed the trial balance.
    const items = await this.prisma.journalEntryItem.findMany({
      where: { journalEntry: { companyId, financialPeriodId: periodId, status: 'posted' } },
      include: { account: true },
    });

    const byAccount = new Map<string, { account_code: string; account_name: string; debit: number; credit: number }>();
    for (const item of items) {
      const key = item.accountId;
      if (!byAccount.has(key)) {
        byAccount.set(key, {
          account_code: item.account.accountCode,
          account_name: item.account.accountName,
          debit: 0,
          credit: 0,
        });
      }
      const row = byAccount.get(key)!;
      row.debit += Number(item.debitAmount);
      row.credit += Number(item.creditAmount);
    }

    const lines = Array.from(byAccount.values())
      .sort((a, b) => a.account_code.localeCompare(b.account_code))
      .map((l) => ({
        account_code: l.account_code,
        account_name: l.account_name,
        debit: l.debit.toFixed(2),
        credit: l.credit.toFixed(2),
      }));

    const total_debits = lines.reduce((s, l) => s + Number(l.debit), 0);
    const total_credits = lines.reduce((s, l) => s + Number(l.credit), 0);

    return {
      company_id: companyId,
      period_id: periodId,
      lines,
      total_debits: total_debits.toFixed(2),
      total_credits: total_credits.toFixed(2),
      balanced: Math.abs(total_debits - total_credits) < 0.001,
    };
  }

  // GET /api/v1/accounting/reports/general-ledger — FR-ACC-03: "a general
  // ledger reflecting all posted journal entries." Distinct from the trial
  // balance above (an account-level summary) — this lists every individual
  // posted line for one account, in date order, with a running balance,
  // which the trial balance's aggregated totals can't show.
  @Get('general-ledger')
  async generalLedger(
    @CurrentUser() user: AuthenticatedUser,
    @Query('companyId', ParseUUIDPipe) companyId: string,
    @Query('accountId', ParseUUIDPipe) accountId: string,
    @Query('periodId') periodId?: string,
  ) {
    if (!isCompanyInScope(user, companyId, 'accounting.viewAll')) {
      throw new NotFoundAppException('Company not found.');
    }
    const account = await this.prisma.account.findUnique({ where: { id: accountId } });
    if (!account || account.companyId !== companyId) {
      throw new NotFoundAppException('Account not found for this company.');
    }

    const items = await this.prisma.journalEntryItem.findMany({
      where: {
        accountId,
        journalEntry: {
          companyId,
          status: 'posted',
          ...(periodId ? { financialPeriodId: periodId } : {}),
        },
      },
      include: { journalEntry: true },
      orderBy: [{ journalEntry: { entryDate: 'asc' } }, { journalEntry: { postedAt: 'asc' } }],
    });

    let runningBalance = 0;
    const debitNormal = account.accountType === 'asset' || account.accountType === 'expense';
    const lines = items.map((item) => {
      const debit = Number(item.debitAmount);
      const credit = Number(item.creditAmount);
      runningBalance += debitNormal ? debit - credit : credit - debit;
      return {
        journal_entry_id: item.journalEntry.id,
        entry_number: item.journalEntry.entryNumber,
        entry_date: item.journalEntry.entryDate,
        description: item.description,
        debit: debit.toFixed(2),
        credit: credit.toFixed(2),
        running_balance: runningBalance.toFixed(2),
      };
    });

    return {
      company_id: companyId,
      account_id: accountId,
      account_code: account.accountCode,
      account_name: account.accountName,
      account_type: account.accountType,
      lines,
      closing_balance: runningBalance.toFixed(2),
    };
  }

  // GET /api/v1/accounting/reports/income-statement — Sprint 10 ("full
  // accounting"). Period-bound, like the trial balance: revenue/expense
  // accounts only, posted entries within the one selected financial period.
  // ?consolidated=true sums the same report across companyId and every
  // subsidiary beneath it (see summarizeAcrossCompanies below for what that
  // does and doesn't do).
  @Get('income-statement')
  async incomeStatement(
    @CurrentUser() user: AuthenticatedUser,
    @Query('companyId', ParseUUIDPipe) companyId: string,
    @Query('periodId', ParseUUIDPipe) periodId: string,
    @Query('consolidated') consolidated?: string,
  ) {
    if (!isCompanyInScope(user, companyId, 'accounting.viewAll')) {
      throw new NotFoundAppException('Company not found.');
    }
    const period = await this.prisma.financialPeriod.findUnique({ where: { id: periodId } });
    if (!period) {
      throw new NotFoundAppException('Financial period not found.');
    }
    // Non-consolidated: periodId must belong to companyId, same as every
    // other report. Consolidated: a pure holding company frequently has no
    // financial periods of its own (nothing is ever booked directly against
    // it) — only isCompanyInScope on whichever company the period actually
    // belongs to is required, and its periodName is what gets matched
    // against every subsidiary in buildConsolidated below, not the ID
    // itself (period IDs are per-company and can't be shared across
    // companies).
    if (consolidated !== 'true' && period.companyId !== companyId) {
      throw new NotFoundAppException('Financial period not found for this company.');
    }
    if (consolidated === 'true' && !isCompanyInScope(user, period.companyId, 'accounting.viewAll')) {
      throw new NotFoundAppException('Financial period not found.');
    }

    const buildOne = async (cid: string, pid: string) => {
      const byAccount = await this.aggregateAccountBalances(cid, { financialPeriodId: pid }, ['revenue', 'expense']);
      const revenueLines = byAccount.filter((a) => a.account_type === 'revenue');
      const expenseLines = byAccount.filter((a) => a.account_type === 'expense');
      const total_revenue = revenueLines.reduce((s, l) => s + l.balance, 0);
      const total_expense = expenseLines.reduce((s, l) => s + l.balance, 0);
      return { revenueLines, expenseLines, total_revenue, total_expense, net_income: total_revenue - total_expense };
    };

    if (consolidated === 'true') {
      return this.buildConsolidated(companyId, period.periodName, (cid, pid) => buildOne(cid, pid), (acc) => ({
        total_revenue: acc.reduce((s: number, r: any) => s + r.total_revenue, 0),
        total_expense: acc.reduce((s: number, r: any) => s + r.total_expense, 0),
        net_income: acc.reduce((s: number, r: any) => s + r.net_income, 0),
      }));
    }

    const one = await buildOne(companyId, periodId);
    return {
      company_id: companyId,
      period_id: periodId,
      revenue: one.revenueLines.map(fmtLine),
      expense: one.expenseLines.map(fmtLine),
      total_revenue: one.total_revenue.toFixed(2),
      total_expense: one.total_expense.toFixed(2),
      net_income: one.net_income.toFixed(2),
    };
  }

  // GET /api/v1/accounting/reports/balance-sheet — Sprint 10. Point-in-time
  // (asOfDate), not period-bound: asset/liability/equity balances are
  // cumulative since company inception, matching real balance-sheet
  // semantics, unlike the period-bound trial balance/income statement
  // above. "Net Income (Current Period, Unposted)" is a synthetic equity
  // line — the running total of revenue minus expense up to asOfDate — not
  // a real ledger account, because this system has no formal period-close/
  // retained-earnings-rollover process (BR-04 only closes a period against
  // further posting, it doesn't roll net income into equity). Without that
  // line, Assets would not equal Liabilities + Equity for any company that
  // has posted revenue/expense activity but never manually journaled it
  // into retained earnings.
  @Get('balance-sheet')
  async balanceSheet(
    @CurrentUser() user: AuthenticatedUser,
    @Query('companyId', ParseUUIDPipe) companyId: string,
    @Query('asOfDate') asOfDate: string,
    @Query('consolidated') consolidated?: string,
  ) {
    if (!isCompanyInScope(user, companyId, 'accounting.viewAll')) {
      throw new NotFoundAppException('Company not found.');
    }
    if (!asOfDate) {
      throw new NotFoundAppException('asOfDate query parameter is required.');
    }
    const upToDate = new Date(asOfDate);

    const buildOne = async (cid: string) => {
      const byAccount = await this.aggregateAccountBalances(cid, { upToDate }, ['asset', 'liability', 'equity']);
      const flow = await this.aggregateAccountBalances(cid, { upToDate }, ['revenue', 'expense']);
      const net_income_to_date = flow.reduce((s, l) => s + (l.account_type === 'revenue' ? l.balance : -l.balance), 0);
      const assetLines = byAccount.filter((a) => a.account_type === 'asset');
      const liabilityLines = byAccount.filter((a) => a.account_type === 'liability');
      const equityLines = byAccount.filter((a) => a.account_type === 'equity');
      const total_assets = assetLines.reduce((s, l) => s + l.balance, 0);
      const total_liabilities = liabilityLines.reduce((s, l) => s + l.balance, 0);
      const total_equity = equityLines.reduce((s, l) => s + l.balance, 0) + net_income_to_date;
      return { assetLines, liabilityLines, equityLines, net_income_to_date, total_assets, total_liabilities, total_equity };
    };

    if (consolidated === 'true') {
      return this.buildConsolidated(companyId, null, (cid) => buildOne(cid), (acc) => ({
        total_assets: acc.reduce((s: number, r: any) => s + r.total_assets, 0),
        total_liabilities: acc.reduce((s: number, r: any) => s + r.total_liabilities, 0),
        total_equity: acc.reduce((s: number, r: any) => s + r.total_equity, 0),
      }));
    }

    const one = await buildOne(companyId);
    return {
      company_id: companyId,
      as_of_date: asOfDate,
      assets: one.assetLines.map(fmtLine),
      liabilities: one.liabilityLines.map(fmtLine),
      equity: [
        ...one.equityLines.map(fmtLine),
        { account_code: null, account_name: 'Net Income (Current Period, Unposted)', balance: one.net_income_to_date.toFixed(2) },
      ],
      total_assets: one.total_assets.toFixed(2),
      total_liabilities: one.total_liabilities.toFixed(2),
      total_equity: one.total_equity.toFixed(2),
      balanced: Math.abs(one.total_assets - (one.total_liabilities + one.total_equity)) < 0.001,
    };
  }

  // Shared aggregation: posted JournalEntryItems for one company, filtered
  // either to one financial period (income statement) or cumulatively up to
  // a date (balance sheet), grouped by account with each account's own
  // natural-balance sign already applied (asset/expense debit-normal,
  // liability/equity/revenue credit-normal) — the same sign convention
  // general-ledger's running balance already uses.
  private async aggregateAccountBalances(
    companyId: string,
    scope: { financialPeriodId?: string; upToDate?: Date },
    accountTypes: string[],
  ) {
    const journalEntryWhere: any = { companyId, status: 'posted' };
    if (scope.financialPeriodId) journalEntryWhere.financialPeriodId = scope.financialPeriodId;
    if (scope.upToDate) journalEntryWhere.entryDate = { lte: scope.upToDate };

    const items = await this.prisma.journalEntryItem.findMany({
      where: { journalEntry: journalEntryWhere, account: { accountType: { in: accountTypes as any } } },
      include: { account: true },
    });

    const byAccount = new Map<string, { account_code: string; account_name: string; account_type: string; balance: number }>();
    for (const item of items) {
      const key = item.accountId;
      if (!byAccount.has(key)) {
        byAccount.set(key, {
          account_code: item.account.accountCode,
          account_name: item.account.accountName,
          account_type: item.account.accountType,
          balance: 0,
        });
      }
      const row = byAccount.get(key)!;
      const debitNormal = item.account.accountType === 'asset' || item.account.accountType === 'expense';
      row.balance += debitNormal
        ? Number(item.debitAmount) - Number(item.creditAmount)
        : Number(item.creditAmount) - Number(item.debitAmount);
    }
    return Array.from(byAccount.values()).sort((a, b) => a.account_code.localeCompare(b.account_code));
  }

  // Consolidation, Sprint 10: sums a per-company report across companyId
  // and every subsidiary beneath it (Company.parentCompanyId, walked
  // breadth-first — this codebase's hierarchy is only ever one level deep
  // in seed data, but this walks arbitrarily deep). Deliberately does NOT
  // merge each subsidiary's chart of accounts line-by-line into one shared
  // set of rows — each company's chart of accounts is its own, matching
  // 08_Database Design Document's per-service/no-shared-schema stance, so
  // "merge by account code" would silently conflate unrelated accounts that
  // happen to share a code. Instead this returns each included company's
  // own report untouched under by_company, plus one combined `consolidated`
  // totals object. No currency conversion is applied — if a subsidiary's
  // `currency` differs from the root company's, its figures are summed in
  // as-is, the same honest gap this report's caller must be aware of until
  // real multi-currency support (Phase 3 per 04_SRS, Section 12) exists.
  // For income-statement, a subsidiary is only included if it has a
  // financial period with the exact same periodName as the root company's
  // selected period — periodId is per-company, so periodName is the only
  // thing that can line two companies' periods up; excludedCompanyIds
  // reports which subsidiaries were left out and why.
  private async buildConsolidated(
    rootCompanyId: string,
    periodName: string | null,
    buildOne: (companyId: string, periodId: string) => Promise<any>,
    combine: (results: any[]) => any,
  ) {
    const companies = await this.getCompanyAndDescendants(rootCompanyId);
    const included: { company_id: string; company_name: string; report: any }[] = [];
    const excluded: { company_id: string; company_name: string; reason: string }[] = [];

    for (const company of companies) {
      if (periodName === null) {
        included.push({ company_id: company.id, company_name: company.name, report: await buildOne(company.id, '') });
        continue;
      }
      const period = await this.prisma.financialPeriod.findFirst({ where: { companyId: company.id, periodName } });
      if (!period) {
        excluded.push({ company_id: company.id, company_name: company.name, reason: `No "${periodName}" financial period for this company.` });
        continue;
      }
      included.push({ company_id: company.id, company_name: company.name, report: await buildOne(company.id, period.id) });
    }

    return {
      root_company_id: rootCompanyId,
      by_company: included.map((c) => ({ company_id: c.company_id, company_name: c.company_name, ...c.report })),
      excluded_companies: excluded,
      consolidated: combine(included.map((c) => c.report)),
    };
  }

  // GET /api/v1/accounting/reports/cash-flow-statement — Financial Module
  // deepening, 19 August 2026. Direct method: sums the net movement through
  // this company's `cash`/`bank`-subtype accounts (sprint15_account_
  // subtype_dashboard) for posted entries within the period, bucketed by
  // the OTHER account each journal entry also touches — revenue/expense/
  // receivable/payable -> operating, other asset accounts -> investing,
  // other liability/equity accounts -> financing. This is a real,
  // categorized cash flow statement, but a simplified one: no formal
  // current/non-current or fixed-vs-current-asset classification exists
  // anywhere in this schema, so the operating/investing/financing split is
  // inferred from account type/subtype at read time, not from a
  // rigorously IAS-7-compliant classification. Distinct from the
  // Dashboard's own "cash flow chart" (a single net-movement number per
  // month, explicitly documented there as not a full statement) — this is
  // the full three-section statement that chart deferred building.
  @Get('cash-flow-statement')
  async cashFlowStatement(
    @CurrentUser() user: AuthenticatedUser,
    @Query('companyId', ParseUUIDPipe) companyId: string,
    @Query('periodId', ParseUUIDPipe) periodId: string,
  ) {
    if (!isCompanyInScope(user, companyId, 'accounting.viewAll')) {
      throw new NotFoundAppException('Company not found.');
    }
    const period = await this.prisma.financialPeriod.findUnique({ where: { id: periodId } });
    if (!period || period.companyId !== companyId) {
      throw new NotFoundAppException('Financial period not found for this company.');
    }

    const cashAccounts = await this.prisma.account.findMany({
      where: { companyId, accountSubType: { in: ['cash', 'bank'] } },
      select: { id: true },
    });
    const cashAccountIds = new Set(cashAccounts.map((a) => a.id));

    const entries = await this.prisma.journalEntry.findMany({
      where: { companyId, financialPeriodId: periodId, status: 'posted' },
      include: { items: { include: { account: true } } },
    });

    let operating = 0,
      investing = 0,
      financing = 0;
    for (const entry of entries) {
      const cashItems = entry.items.filter((i) => cashAccountIds.has(i.accountId));
      if (cashItems.length === 0) continue;
      const cashNet = cashItems.reduce((s, i) => s + Number(i.debitAmount) - Number(i.creditAmount), 0);
      const other = entry.items.find((i) => !cashAccountIds.has(i.accountId));
      let bucket: 'operating' | 'investing' | 'financing' = 'operating';
      if (other) {
        if (other.account.accountType === 'asset' && other.account.accountSubType !== 'receivable') bucket = 'investing';
        else if (other.account.accountType === 'liability' && other.account.accountSubType !== 'payable') bucket = 'financing';
        else if (other.account.accountType === 'equity') bucket = 'financing';
      }
      if (bucket === 'investing') investing += cashNet;
      else if (bucket === 'financing') financing += cashNet;
      else operating += cashNet;
    }

    return {
      company_id: companyId,
      period_id: periodId,
      operating_activities: operating.toFixed(2),
      investing_activities: investing.toFixed(2),
      financing_activities: financing.toFixed(2),
      net_change_in_cash: (operating + investing + financing).toFixed(2),
    };
  }

  // GET /api/v1/accounting/reports/statement-of-changes-in-equity —
  // Financial Module deepening. openingBalance (equity balances up to the
  // day before the period starts) + netIncomeForPeriod (this period's
  // revenue - expense) + otherMovements (a residual: closingBalance minus
  // the first two — direct equity postings, e.g. a manual capital
  // injection journal entry, that aren't revenue/expense) = closingBalance
  // (equity balances up to the period's end date). A simplified statement
  // — no separate tracking of dividends/capital contributions as distinct
  // transaction types exists anywhere in this codebase, so those net out
  // into "other movements" rather than their own labeled line, the same
  // level of simplification the Balance Sheet's own synthetic "Net Income
  // (Current Period, Unposted)" line already carries.
  @Get('statement-of-changes-in-equity')
  async statementOfChangesInEquity(
    @CurrentUser() user: AuthenticatedUser,
    @Query('companyId', ParseUUIDPipe) companyId: string,
    @Query('periodId', ParseUUIDPipe) periodId: string,
  ) {
    if (!isCompanyInScope(user, companyId, 'accounting.viewAll')) {
      throw new NotFoundAppException('Company not found.');
    }
    const period = await this.prisma.financialPeriod.findUnique({ where: { id: periodId } });
    if (!period || period.companyId !== companyId) {
      throw new NotFoundAppException('Financial period not found for this company.');
    }

    const dayBeforeStart = new Date(period.startDate.getTime() - 24 * 60 * 60 * 1000);
    const openingEquity = await this.aggregateAccountBalances(companyId, { upToDate: dayBeforeStart }, ['equity']);
    const closingEquity = await this.aggregateAccountBalances(companyId, { upToDate: period.endDate }, ['equity']);
    const flow = await this.aggregateAccountBalances(companyId, { financialPeriodId: periodId }, ['revenue', 'expense']);

    const openingBalance = openingEquity.reduce((s, l) => s + l.balance, 0);
    const closingBalance = closingEquity.reduce((s, l) => s + l.balance, 0);
    const netIncomeForPeriod = flow.reduce((s, l) => s + (l.account_type === 'revenue' ? l.balance : -l.balance), 0);
    const otherMovements = closingBalance - openingBalance - netIncomeForPeriod;

    return {
      company_id: companyId,
      period_id: periodId,
      opening_balance: openingBalance.toFixed(2),
      net_income_for_period: netIncomeForPeriod.toFixed(2),
      other_movements: otherMovements.toFixed(2),
      closing_balance: closingBalance.toFixed(2),
    };
  }

  // GET /api/v1/accounting/reports/financial-ratios — Financial Module
  // deepening. Only ratios this schema can actually compute correctly are
  // returned — current ratio and quick ratio are deliberately NOT included,
  // since no current-vs-non-current account classification exists anywhere
  // in this chart of accounts; faking one by treating all assets as
  // "current" would silently produce a wrong number, not a simplified
  // right one, unlike every other simplification in this pass. Named here
  // rather than left implicit.
  @Get('financial-ratios')
  async financialRatios(
    @CurrentUser() user: AuthenticatedUser,
    @Query('companyId', ParseUUIDPipe) companyId: string,
    @Query('periodId', ParseUUIDPipe) periodId: string,
    @Query('asOfDate') asOfDate: string,
  ) {
    if (!isCompanyInScope(user, companyId, 'accounting.viewAll')) {
      throw new NotFoundAppException('Company not found.');
    }
    const period = await this.prisma.financialPeriod.findUnique({ where: { id: periodId } });
    if (!period || period.companyId !== companyId) {
      throw new NotFoundAppException('Financial period not found for this company.');
    }
    const upToDate = asOfDate ? new Date(asOfDate) : period.endDate;

    const balanceLines = await this.aggregateAccountBalances(companyId, { upToDate }, ['asset', 'liability', 'equity']);
    const flow = await this.aggregateAccountBalances(companyId, { financialPeriodId: periodId }, ['revenue', 'expense']);

    const totalAssets = balanceLines.filter((l) => l.account_type === 'asset').reduce((s, l) => s + l.balance, 0);
    const totalLiabilities = balanceLines.filter((l) => l.account_type === 'liability').reduce((s, l) => s + l.balance, 0);
    const totalEquityRaw = balanceLines.filter((l) => l.account_type === 'equity').reduce((s, l) => s + l.balance, 0);
    const netIncome = flow.reduce((s, l) => s + (l.account_type === 'revenue' ? l.balance : -l.balance), 0);
    const totalRevenue = flow.filter((l) => l.account_type === 'revenue').reduce((s, l) => s + l.balance, 0);
    // Same synthetic net-income-to-date line the Balance Sheet report adds,
    // needed here too so ROE/debt-to-equity divide by real total equity,
    // not an understated figure — see that report's own comment for why.
    const totalEquity = totalEquityRaw + netIncome;

    const ratio = (n: number, d: number) => (d === 0 ? null : Number((n / d).toFixed(4)));

    return {
      company_id: companyId,
      period_id: periodId,
      as_of_date: upToDate,
      net_profit_margin: ratio(netIncome, totalRevenue),
      return_on_assets: ratio(netIncome, totalAssets),
      return_on_equity: ratio(netIncome, totalEquity),
      debt_to_equity: ratio(totalLiabilities, totalEquity),
      asset_turnover: ratio(totalRevenue, totalAssets),
      not_computed: ['current_ratio', 'quick_ratio'],
      not_computed_reason: 'No current-vs-non-current account classification exists in this chart of accounts.',
    };
  }

  // GET /api/v1/accounting/reports/budget-vs-actual — Financial Module
  // deepening. Every budgeted account for the period, actual posted
  // activity compared against it, and the variance — accounts with a
  // budget but no posted activity still appear (100% unfavorable/favorable
  // variance, not silently dropped).
  @Get('budget-vs-actual')
  async budgetVsActual(
    @CurrentUser() user: AuthenticatedUser,
    @Query('companyId', ParseUUIDPipe) companyId: string,
    @Query('periodId', ParseUUIDPipe) periodId: string,
  ) {
    if (!isCompanyInScope(user, companyId, 'accounting.viewAll')) {
      throw new NotFoundAppException('Company not found.');
    }
    const budgets = await this.prisma.budget.findMany({ where: { financialPeriodId: periodId }, include: { account: true } });
    const items = await this.prisma.journalEntryItem.findMany({
      where: { journalEntry: { companyId, financialPeriodId: periodId, status: 'posted' } },
      include: { account: true },
    });
    const actualByAccount = new Map<string, number>();
    for (const item of items) {
      const debitNormal = item.account.accountType === 'asset' || item.account.accountType === 'expense';
      const signed = debitNormal ? Number(item.debitAmount) - Number(item.creditAmount) : Number(item.creditAmount) - Number(item.debitAmount);
      actualByAccount.set(item.accountId, (actualByAccount.get(item.accountId) ?? 0) + signed);
    }

    const lines = budgets.map((b) => {
      const actual = actualByAccount.get(b.accountId) ?? 0;
      const budgeted = Number(b.budgetedAmount);
      return {
        account_id: b.accountId,
        account_code: b.account.accountCode,
        account_name: b.account.accountName,
        budgeted_amount: budgeted.toFixed(2),
        actual_amount: actual.toFixed(2),
        variance: (actual - budgeted).toFixed(2),
        variance_percent: budgeted === 0 ? null : Number((((actual - budgeted) / Math.abs(budgeted)) * 100).toFixed(1)),
      };
    });
    return { company_id: companyId, period_id: periodId, lines };
  }

  // GET /api/v1/accounting/reports/management-accounts — Financial Module
  // deepening. A single internal-review bundle combining the Income
  // Statement, Balance Sheet, Financial Ratios and Budget vs Actual for
  // one period — the same real report data every other endpoint here
  // already computes, called directly as plain methods (not re-fetched
  // over HTTP) and assembled into one response, matching how "management
  // accounts" is normally understood: not a new financial concept, a
  // packaged view of the existing ones for management review.
  @Get('management-accounts')
  async managementAccounts(
    @CurrentUser() user: AuthenticatedUser,
    @Query('companyId', ParseUUIDPipe) companyId: string,
    @Query('periodId', ParseUUIDPipe) periodId: string,
    @Query('asOfDate') asOfDate: string,
  ) {
    const [income, balance, ratios, budget] = await Promise.all([
      this.incomeStatement(user, companyId, periodId, undefined),
      this.balanceSheet(user, companyId, asOfDate, undefined),
      this.financialRatios(user, companyId, periodId, asOfDate),
      this.budgetVsActual(user, companyId, periodId),
    ]);
    return { company_id: companyId, period_id: periodId, income_statement: income, balance_sheet: balance, financial_ratios: ratios, budget_vs_actual: budget };
  }

  private async getCompanyAndDescendants(rootId: string) {
    const all: { id: string; name: string }[] = [];
    let frontier = [rootId];
    while (frontier.length > 0) {
      const level = await this.prisma.company.findMany({ where: { id: { in: frontier } }, select: { id: true, name: true } });
      all.push(...level);
      const children = await this.prisma.company.findMany({
        where: { parentCompanyId: { in: frontier } },
        select: { id: true },
      });
      frontier = children.map((c) => c.id);
    }
    return all;
  }
}

function fmtLine(l: { account_code: string; account_name: string; balance: number }) {
  return { account_code: l.account_code, account_name: l.account_name, balance: l.balance.toFixed(2) };
}
