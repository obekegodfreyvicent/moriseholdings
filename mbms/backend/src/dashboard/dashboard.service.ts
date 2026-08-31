import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundAppException } from '../common/app-exception';
import { AuthenticatedUser } from '../common/strategies/jwt.strategy';
import { isCompanyInScope } from '../common/scope.util';

// A "not built here" block for a KPI this dashboard was asked for but has
// no underlying module to compute it from. Same honest pattern
// FR-CUST-03's empty customer statement already established — the tile
// exists and says why it's empty, rather than being silently omitted or
// faked with a zero.
const NOT_BUILT = (reason: string) => ({ available: false, reason });

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  // GET /dashboard/summary — FR-DASH-01 ("counts of total companies,
  // branches, employees, customers and suppliers"), Group-level roles only
  // (guarded by organization.company.viewAll at the controller)
  async summary() {
    const [companies, branches, employees, customers, suppliers, users, assets, activeProjects] = await this.prisma.$transaction([
      this.prisma.company.count(),
      this.prisma.branch.count(),
      this.prisma.employee.count({ where: { status: 'active' } }),
      this.prisma.customer.count({ where: { status: 'active' } }),
      this.prisma.supplier.count({ where: { status: { not: 'blacklisted' } } }),
      this.prisma.user.count({ where: { status: 'active' } }),
      // Sprint 14: round out group summary coverage for the two Phase 2
      // modules built since FR-DASH-01 was last checked (Sprint 6).
      this.prisma.asset.count({ where: { status: { not: 'disposed' } } }),
      this.prisma.project.count({ where: { status: 'active' } }),
    ]);

    // Dashboard deepening (19 August 2026): the holding-company KPI list —
    // current projects (all statuses, not just active), group-wide pending
    // approvals, outstanding inter-company loans, and employee statistics
    // — plus the three tiles this codebase genuinely cannot compute
    // (Inventory, Sales, Procurement all remain unbuilt).
    const [projectsByStatus, pendingApprovals, outstandingLoans, employeeStats] = await Promise.all([
      this.projectsByStatus(),
      this.groupPendingApprovals(),
      this.outstandingLoans(),
      this.employeeStatistics(),
    ]);

    return {
      companies,
      branches,
      employees,
      customers,
      suppliers,
      users,
      assets,
      activeProjects,
      currentProjects: projectsByStatus,
      pendingApprovals,
      outstandingLoans,
      employeeStatistics: employeeStats,
      inventoryValue: NOT_BUILT('No Inventory/warehouse module exists in this codebase — deliberately deferred since Sprint 8.'),
      salesPerformance: NOT_BUILT('No Sales/Invoicing module exists in this codebase — deliberately deferred since Sprint 7.'),
      procurementPerformance: NOT_BUILT('No Procurement module exists in this codebase — deliberately deferred since Sprint 6.'),
    };
  }

  // GET /dashboard/accounting-summary — FR-DASH-02
  // (guarded by accounting.viewAll at the controller)
  async accountingSummary() {
    const companies = await this.prisma.company.findMany({ select: { id: true, name: true } });
    const results: {
      companyId: string;
      companyName: string;
      totalDebits: string;
      totalCredits: string;
      balanced: boolean;
      lastJournalEntryAt: Date | null;
    }[] = [];
    for (const company of companies) {
      const items = await this.prisma.journalEntryItem.findMany({
        where: { journalEntry: { companyId: company.id, status: 'posted' } },
      });
      if (items.length === 0) continue;
      const debit = items.reduce((s, i) => s + Number(i.debitAmount), 0);
      const credit = items.reduce((s, i) => s + Number(i.creditAmount), 0);
      const lastEntry = await this.prisma.journalEntry.findFirst({
        where: { companyId: company.id, status: 'posted' },
        orderBy: { postedAt: 'desc' },
      });
      results.push({
        companyId: company.id,
        companyName: company.name,
        totalDebits: debit.toFixed(2),
        totalCredits: credit.toFixed(2),
        balanced: Math.abs(debit - credit) < 0.001,
        lastJournalEntryAt: lastEntry?.postedAt ?? null,
      });
    }
    return results;
  }

  // GET /dashboard/financials — Dashboard deepening (19 August 2026),
  // guarded by accounting.viewAll at the controller. Group-wide: total
  // asset/liability/equity value (point-in-time, "as of now", the same
  // semantics the Balance Sheet report already uses), cash position, bank
  // balances, outstanding receivables/payables (all summed from
  // Account.accountSubType — see schema migration
  // sprint15_account_subtype_dashboard), and current-period revenue/
  // expense/net profit, each company using its OWN currently-open (or, if
  // none open, most recently closed) financial period rather than one
  // shared period name — unlike the Reports module's ?consolidated=true
  // (which matches periods by name across a company tree for an
  // apples-to-apples comparison), a single "current position" snapshot
  // does not need every company on the same named period.
  async financials() {
    const companies = await this.prisma.company.findMany({ select: { id: true, name: true } });
    let totalAssets = 0,
      totalLiabilities = 0,
      totalEquity = 0,
      cash = 0,
      bank = 0,
      receivable = 0,
      payable = 0,
      totalRevenue = 0,
      totalExpense = 0;
    const byCompany: any[] = [];

    for (const company of companies) {
      const balance = await this.balanceSheetSnapshot(company.id, new Date());
      const income = await this.currentPeriodIncome(company.id);
      totalAssets += balance.totalAssets;
      totalLiabilities += balance.totalLiabilities;
      totalEquity += balance.totalEquity;
      cash += balance.cash;
      bank += balance.bank;
      receivable += balance.receivable;
      payable += balance.payable;
      totalRevenue += income.revenue;
      totalExpense += income.expense;
      byCompany.push({
        companyId: company.id,
        companyName: company.name,
        totalAssets: balance.totalAssets.toFixed(2),
        totalLiabilities: balance.totalLiabilities.toFixed(2),
        totalEquity: balance.totalEquity.toFixed(2),
        cashPosition: (balance.cash + balance.bank).toFixed(2),
        bankBalances: balance.bank.toFixed(2),
        outstandingReceivables: balance.receivable.toFixed(2),
        outstandingPayables: balance.payable.toFixed(2),
        periodName: income.periodName,
        revenue: income.revenue.toFixed(2),
        expense: income.expense.toFixed(2),
        netProfit: (income.revenue - income.expense).toFixed(2),
      });
    }

    return {
      totalAssets: totalAssets.toFixed(2),
      totalLiabilities: totalLiabilities.toFixed(2),
      totalEquity: totalEquity.toFixed(2),
      cashPosition: (cash + bank).toFixed(2),
      bankBalances: bank.toFixed(2),
      outstandingReceivables: receivable.toFixed(2),
      outstandingPayables: payable.toFixed(2),
      totalRevenue: totalRevenue.toFixed(2),
      totalExpense: totalExpense.toFixed(2),
      netProfit: (totalRevenue - totalExpense).toFixed(2),
      byCompany,
    };
  }

  // GET /dashboard/charts — Dashboard deepening, guarded by
  // accounting.viewAll. Four monthly series across the trailing 6 months
  // (a dashboard chart, not a formal report — 6 months keeps the payload
  // and the rendered chart small; this codebase's seed data doesn't have
  // enough history for 12 to show anything more anyway), group-wide (all
  // companies combined, not one company — matches the group Financials
  // block above). Cash-flow is a simplified operating-cash proxy — the net
  // monthly debit-minus-credit movement through `cash`/`bank`-subtype
  // accounts — not a full statement of cash flows with financing/investing
  // sections; this codebase has no such report anywhere and building one
  // is out of scope for a dashboard chart.
  async charts(months = 6) {
    const since = startOfMonthsAgo(months - 1);
    const items = await this.prisma.journalEntryItem.findMany({
      where: { journalEntry: { status: 'posted', entryDate: { gte: since } } },
      include: { journalEntry: { select: { entryDate: true } }, account: { select: { accountType: true, accountSubType: true } } },
    });

    const buckets = monthLabels(months);
    const revenue = new Map(buckets.map((m) => [m, 0]));
    const expense = new Map(buckets.map((m) => [m, 0]));
    const cashFlow = new Map(buckets.map((m) => [m, 0]));

    for (const item of items) {
      const label = monthLabel(item.journalEntry.entryDate);
      if (!revenue.has(label)) continue; // outside the requested window
      const debit = Number(item.debitAmount);
      const credit = Number(item.creditAmount);
      if (item.account.accountType === 'revenue') revenue.set(label, revenue.get(label)! + (credit - debit));
      if (item.account.accountType === 'expense') expense.set(label, expense.get(label)! + (debit - credit));
      if (item.account.accountSubType === 'cash' || item.account.accountSubType === 'bank') {
        cashFlow.set(label, cashFlow.get(label)! + (debit - credit));
      }
    }

    const series = (m: Map<string, number>) => buckets.map((label) => ({ month: label, value: Number(m.get(label)!.toFixed(2)) }));
    const revenueSeries = series(revenue);
    const expenseSeries = series(expense);
    const profitLossSeries = buckets.map((label, i) => ({ month: label, value: Number((revenueSeries[i].value - expenseSeries[i].value).toFixed(2)) }));

    return {
      monthlyRevenue: revenueSeries,
      monthlyExpense: expenseSeries,
      profitAndLoss: profitLossSeries,
      cashFlow: series(cashFlow),
    };
  }

  // GET /dashboard/alerts — Dashboard deepening, guarded by
  // organization.company.viewAll. Financial alerts require the caller to
  // also hold accounting.viewAll (nested check, same pattern as
  // companyDashboard's per-block gating below) since they expose ledger
  // data an Auditor-only or pure-organization role shouldn't necessarily
  // see just for holding company.viewAll. Thresholds are deliberately
  // simple, fixed constants — this codebase has no configurable alert-rule
  // engine, and none was asked for.
  async alerts(user: AuthenticatedUser) {
    const operational: { severity: 'warning' | 'error'; message: string }[] = [];
    const financial: { severity: 'warning' | 'error'; message: string }[] = [];

    const pending = await this.groupPendingApprovals();
    if (pending.total > 5) {
      operational.push({ severity: 'warning', message: `${pending.total} approvals are pending group-wide (expenses: ${pending.expenses}, asset disposals: ${pending.assetDisposals}).` });
    }

    const agingDisposals = await this.prisma.asset.findMany({
      where: { status: 'disposal_requested', disposalRequestedAt: { lt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) } },
      select: { id: true, name: true, companyId: true, disposalRequestedAt: true },
    });
    for (const a of agingDisposals) {
      operational.push({ severity: 'error', message: `Asset "${a.name}" disposal request has been awaiting approval for over 14 days.` });
    }

    if (user.permissions.includes('accounting.viewAll')) {
      const companies = await this.prisma.company.findMany({ select: { id: true, name: true } });
      for (const company of companies) {
        const openPeriodsPastEnd = await this.prisma.financialPeriod.findMany({
          where: { companyId: company.id, status: 'open', endDate: { lt: new Date() } },
        });
        for (const p of openPeriodsPastEnd) {
          financial.push({ severity: 'warning', message: `${company.name}: financial period "${p.periodName}" is past its end date but still open.` });
        }
        const income = await this.currentPeriodIncome(company.id);
        if (income.periodName && income.revenue - income.expense < 0) {
          financial.push({ severity: 'warning', message: `${company.name}: net loss of ${(income.expense - income.revenue).toFixed(2)} in "${income.periodName}".` });
        }
        const balance = await this.balanceSheetSnapshot(company.id, new Date());
        if (Math.abs(balance.totalAssets - (balance.totalLiabilities + balance.totalEquity)) >= 0.01) {
          financial.push({ severity: 'error', message: `${company.name}: balance sheet does not balance (sanity check — should never fire given BR-03).` });
        }
      }
    }

    return { financial, operational };
  }

  // GET /dashboard/companies/{id} — FR-DASH-03, subsidiary-scoped
  async companyDashboard(user: AuthenticatedUser, companyId: string) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company || !isCompanyInScope(user, companyId)) {
      throw new NotFoundAppException('Company not found.');
    }
    const [branches, departments, employees, customers, suppliers] = await this.prisma.$transaction([
      this.prisma.branch.count({ where: { companyId } }),
      this.prisma.department.count({ where: { companyId } }),
      this.prisma.employee.count({ where: { companyId, status: 'active' } }),
      this.prisma.customer.count({ where: { companyId, status: 'active' } }),
      this.prisma.supplier.count({ where: { companyId, status: { not: 'blacklisted' } } }),
    ]);

    // FR-DASH-02: "a summary of the chart of accounts and current trial
    // balance status to authorized finance users" — not just Group-level
    // roles. Before this fix, accounting-summary was only reachable via
    // accounting.viewAll (Group-level), so a subsidiary-scoped Finance
    // Manager (accounting.manage only) could never see it on their own
    // company's dashboard. Included here for anyone who holds either
    // accounting permission for this company.
    let accounting: {
      totalDebits: string;
      totalCredits: string;
      balanced: boolean;
      lastJournalEntryAt: Date | null;
    } | null = null;
    const hasAccounting = user.permissions.includes('accounting.manage') || user.permissions.includes('accounting.viewAll');
    if (hasAccounting) {
      const items = await this.prisma.journalEntryItem.findMany({
        where: { journalEntry: { companyId, status: 'posted' } },
      });
      const debit = items.reduce((s, i) => s + Number(i.debitAmount), 0);
      const credit = items.reduce((s, i) => s + Number(i.creditAmount), 0);
      const lastEntry = await this.prisma.journalEntry.findFirst({
        where: { companyId, status: 'posted' },
        orderBy: { postedAt: 'desc' },
      });
      accounting = {
        totalDebits: debit.toFixed(2),
        totalCredits: credit.toFixed(2),
        balanced: Math.abs(debit - credit) < 0.001,
        lastJournalEntryAt: lastEntry?.postedAt ?? null,
      };
    }

    // Dashboard deepening: total asset/liability/equity value, cash/bank/
    // receivable/payable, and this company's current-period revenue/
    // expense/net profit — same authorized-users-only gate as `accounting`
    // above (FR-DASH-02's own wording), not a separate permission.
    let financials: {
      totalAssets: string;
      totalLiabilities: string;
      totalEquity: string;
      cashPosition: string;
      bankBalances: string;
      outstandingReceivables: string;
      outstandingPayables: string;
      periodName: string | null;
      revenue: string;
      expense: string;
      netProfit: string;
    } | null = null;
    let charts: Awaited<ReturnType<DashboardService['companyCharts']>> | null = null;
    if (hasAccounting) {
      const balance = await this.balanceSheetSnapshot(companyId, new Date());
      const income = await this.currentPeriodIncome(companyId);
      financials = {
        totalAssets: balance.totalAssets.toFixed(2),
        totalLiabilities: balance.totalLiabilities.toFixed(2),
        totalEquity: balance.totalEquity.toFixed(2),
        cashPosition: (balance.cash + balance.bank).toFixed(2),
        bankBalances: balance.bank.toFixed(2),
        outstandingReceivables: balance.receivable.toFixed(2),
        outstandingPayables: balance.payable.toFixed(2),
        periodName: income.periodName,
        revenue: income.revenue.toFixed(2),
        expense: income.expense.toFixed(2),
        netProfit: (income.revenue - income.expense).toFixed(2),
      };
      charts = await this.companyCharts(companyId);
    }

    // Sprint 14: same "authorized users for this company, not just
    // Group-level roles" fix FR-DASH-02 already got in Sprint 6, applied to
    // the two Phase 2 modules built since — assets/projects only appear if
    // the caller actually holds a permission for them in this company.
    let assets: { total: number; active: number; pendingDisposalApproval: number } | null = null;
    if (user.permissions.includes('asset.manage') || user.permissions.includes('asset.viewAll')) {
      const [total, active, pendingDisposalApproval] = await this.prisma.$transaction([
        this.prisma.asset.count({ where: { companyId, status: { not: 'disposed' } } }),
        this.prisma.asset.count({ where: { companyId, status: 'active' } }),
        this.prisma.asset.count({ where: { companyId, status: 'disposal_requested' } }),
      ]);
      assets = { total, active, pendingDisposalApproval };
    }

    let projects: { total: number; active: number } | null = null;
    if (user.permissions.includes('project.manage') || user.permissions.includes('project.viewAll')) {
      const [total, active] = await this.prisma.$transaction([
        this.prisma.project.count({ where: { companyId } }),
        this.prisma.project.count({ where: { companyId, status: 'active' } }),
      ]);
      projects = { total, active };
    }

    // Dashboard deepening: outstanding inter-company loans this company is
    // party to, gated the same way the Inter-Company module itself gates
    // read access — organization.intercompany.manage or .viewAll for a
    // scoped user. This system has no loan repayment/settlement tracking
    // at all (InterCompanyTransactionStatus is only draft/posted), so
    // "outstanding" here means every posted loan-type transaction this
    // company is a party to — documented, not silently assumed.
    let outstandingLoans: { owedToUs: string; owedByUs: string } | null = null;
    if (user.permissions.includes('organization.intercompany.manage') || user.permissions.includes('organization.intercompany.viewAll')) {
      const [asLender, asBorrower] = await Promise.all([
        this.prisma.interCompanyTransaction.aggregate({
          where: { fromCompanyId: companyId, transactionType: 'loan', status: 'posted' },
          _sum: { amount: true },
        }),
        this.prisma.interCompanyTransaction.aggregate({
          where: { toCompanyId: companyId, transactionType: 'loan', status: 'posted' },
          _sum: { amount: true },
        }),
      ]);
      outstandingLoans = {
        owedToUs: Number(asLender._sum.amount ?? 0).toFixed(2),
        owedByUs: Number(asBorrower._sum.amount ?? 0).toFixed(2),
      };
    }

    // "Which of MY approvals are outstanding right now" — the same
    // pending-count concept notifications already push proactively,
    // surfaced here too so it's visible without waiting for a
    // notification to have arrived.
    const myPendingApprovals: { expensesAwaitingMe: number; assetDisposalsAwaitingMe: number } = {
      expensesAwaitingMe: 0,
      assetDisposalsAwaitingMe: 0,
    };
    if (user.permissions.includes('expense.approve.manager')) {
      myPendingApprovals.expensesAwaitingMe += await this.prisma.expense.count({ where: { companyId, status: 'submitted' } });
    }
    if (user.permissions.includes('expense.approve.finance')) {
      myPendingApprovals.expensesAwaitingMe += await this.prisma.expense.count({ where: { companyId, status: 'manager_approved' } });
    }
    if (user.permissions.includes('asset.approve.disposal')) {
      myPendingApprovals.assetDisposalsAwaitingMe = await this.prisma.asset.count({ where: { companyId, status: 'disposal_requested' } });
    }

    const unreadNotifications = await this.prisma.notification.count({ where: { userId: user.id, isRead: false } });

    return {
      companyId,
      companyName: company.name,
      branches,
      departments,
      employees,
      customers,
      suppliers,
      accounting,
      financials,
      charts,
      assets,
      projects,
      outstandingLoans,
      myPendingApprovals,
      unreadNotifications,
      inventoryValue: NOT_BUILT('No Inventory/warehouse module exists in this codebase — deliberately deferred since Sprint 8.'),
      salesPerformance: NOT_BUILT('No Sales/Invoicing module exists in this codebase — deliberately deferred since Sprint 7.'),
      procurementPerformance: NOT_BUILT('No Procurement module exists in this codebase — deliberately deferred since Sprint 6.'),
    };
  }

  // GET /dashboard/recent-activity — FR-DASH-04
  // (guarded by audit.view at the controller)
  async recentActivity(limit = 10) {
    const rows = await this.prisma.auditLog.findMany({
      orderBy: { occurredAt: 'desc' },
      take: limit,
    });
    const userIds = [...new Set(rows.map((r) => r.userId).filter((id): id is string => !!id))];
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, firstName: true, lastName: true },
    });
    const userNameById = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));

    return rows.map((r) => ({
      id: r.id,
      eventType: r.eventType,
      userId: r.userId,
      userName: r.userId ? (userNameById.get(r.userId) ?? 'Unknown user') : 'System',
      companyId: r.companyId,
      entityType: r.entityType,
      entityId: r.entityId,
      action: r.action,
      occurredAt: r.occurredAt,
    }));
  }

  // ---------------------------------------------------------------------
  // Private helpers, added in the dashboard deepening pass (19 August
  // 2026). Deliberately duplicated rather than imported from
  // accounting/reports/reports.controller.ts's own private aggregation
  // helpers — that controller doesn't export a service, matching the
  // pattern this file already had (it already duplicates a mini trial-
  // balance calc in accountingSummary()/companyDashboard() rather than
  // calling into Reports).
  // ---------------------------------------------------------------------

  // Point-in-time balance-sheet-style snapshot (same semantics as
  // accounting/reports' balanceSheet — cumulative since inception, not
  // period-bound), plus the four Account.accountSubType sums this pass
  // added the schema for. totalEquity includes the same synthetic "Net
  // Income (Current Period, Unposted)" line the real Balance Sheet report
  // adds (revenue minus expense to date) — this system has no formal
  // period-close/retained-earnings-rollover process, so omitting it would
  // make Assets != Liabilities + Equity for any company with posted
  // revenue/expense activity, which is exactly what a first cut of this
  // method did before this note was added (caught by the alerts()
  // balance-sanity-check itself firing incorrectly during verification).
  private async balanceSheetSnapshot(companyId: string, asOfDate: Date) {
    const items = await this.prisma.journalEntryItem.findMany({
      where: { journalEntry: { companyId, status: 'posted', entryDate: { lte: asOfDate } } },
      include: { account: true },
    });
    let totalAssets = 0,
      totalLiabilities = 0,
      totalEquity = 0,
      netIncomeToDate = 0,
      cash = 0,
      bank = 0,
      receivable = 0,
      payable = 0;
    for (const item of items) {
      const debit = Number(item.debitAmount);
      const credit = Number(item.creditAmount);
      const debitNormal = item.account.accountType === 'asset' || item.account.accountType === 'expense';
      const signedBalance = debitNormal ? debit - credit : credit - debit;
      if (item.account.accountType === 'asset') totalAssets += signedBalance;
      if (item.account.accountType === 'liability') totalLiabilities += signedBalance;
      if (item.account.accountType === 'equity') totalEquity += signedBalance;
      if (item.account.accountType === 'revenue') netIncomeToDate += credit - debit;
      if (item.account.accountType === 'expense') netIncomeToDate -= debit - credit;
      if (item.account.accountSubType === 'cash') cash += signedBalance;
      if (item.account.accountSubType === 'bank') bank += signedBalance;
      if (item.account.accountSubType === 'receivable') receivable += signedBalance;
      if (item.account.accountSubType === 'payable') payable += signedBalance;
    }
    return { totalAssets, totalLiabilities, totalEquity: totalEquity + netIncomeToDate, cash, bank, receivable, payable };
  }

  // This company's current period: the one open FinancialPeriod, or if
  // none is open, the most recently closed one — a reasonable "what's the
  // current position" default for a dashboard tile, not a report where the
  // caller picks the period explicitly.
  private async currentPeriod(companyId: string) {
    const open = await this.prisma.financialPeriod.findFirst({ where: { companyId, status: 'open' }, orderBy: { startDate: 'desc' } });
    if (open) return open;
    return this.prisma.financialPeriod.findFirst({ where: { companyId, status: 'closed' }, orderBy: { closedAt: 'desc' } });
  }

  private async currentPeriodIncome(companyId: string) {
    const period = await this.currentPeriod(companyId);
    if (!period) return { periodName: null as string | null, revenue: 0, expense: 0 };
    const items = await this.prisma.journalEntryItem.findMany({
      where: { journalEntry: { companyId, financialPeriodId: period.id, status: 'posted' } },
      include: { account: { select: { accountType: true } } },
    });
    let revenue = 0,
      expense = 0;
    for (const item of items) {
      const debit = Number(item.debitAmount);
      const credit = Number(item.creditAmount);
      if (item.account.accountType === 'revenue') revenue += credit - debit;
      if (item.account.accountType === 'expense') expense += debit - credit;
    }
    return { periodName: period.periodName, revenue, expense };
  }

  private async companyCharts(companyId: string, months = 6) {
    const since = startOfMonthsAgo(months - 1);
    const items = await this.prisma.journalEntryItem.findMany({
      where: { journalEntry: { companyId, status: 'posted', entryDate: { gte: since } } },
      include: { journalEntry: { select: { entryDate: true } }, account: { select: { accountType: true, accountSubType: true } } },
    });
    const buckets = monthLabels(months);
    const revenue = new Map(buckets.map((m) => [m, 0]));
    const expense = new Map(buckets.map((m) => [m, 0]));
    const cashFlow = new Map(buckets.map((m) => [m, 0]));
    for (const item of items) {
      const label = monthLabel(item.journalEntry.entryDate);
      if (!revenue.has(label)) continue;
      const debit = Number(item.debitAmount);
      const credit = Number(item.creditAmount);
      if (item.account.accountType === 'revenue') revenue.set(label, revenue.get(label)! + (credit - debit));
      if (item.account.accountType === 'expense') expense.set(label, expense.get(label)! + (debit - credit));
      if (item.account.accountSubType === 'cash' || item.account.accountSubType === 'bank') {
        cashFlow.set(label, cashFlow.get(label)! + (debit - credit));
      }
    }
    const series = (m: Map<string, number>) => buckets.map((label) => ({ month: label, value: Number(m.get(label)!.toFixed(2)) }));
    const revenueSeries = series(revenue);
    const expenseSeries = series(expense);
    const profitLossSeries = buckets.map((label, i) => ({ month: label, value: Number((revenueSeries[i].value - expenseSeries[i].value).toFixed(2)) }));
    return { monthlyRevenue: revenueSeries, monthlyExpense: expenseSeries, profitAndLoss: profitLossSeries, cashFlow: series(cashFlow) };
  }

  private async projectsByStatus() {
    const rows = await this.prisma.project.groupBy({ by: ['status'], _count: { _all: true } });
    const byStatus: Record<string, number> = {};
    for (const r of rows) byStatus[r.status] = r._count._all;
    return { total: rows.reduce((s, r) => s + r._count._all, 0), byStatus };
  }

  private async groupPendingApprovals() {
    const [expenses, assetDisposals] = await Promise.all([
      this.prisma.expense.count({ where: { status: { in: ['submitted', 'manager_approved'] } } }),
      this.prisma.asset.count({ where: { status: 'disposal_requested' } }),
    ]);
    return { expenses, assetDisposals, total: expenses + assetDisposals };
  }

  // See the note on companyDashboard's outstandingLoans block above — no
  // repayment/settlement tracking exists, so "outstanding" means every
  // posted loan-type inter-company transaction, group-wide.
  private async outstandingLoans() {
    const agg = await this.prisma.interCompanyTransaction.aggregate({
      where: { transactionType: 'loan', status: 'posted' },
      _sum: { amount: true },
      _count: true,
    });
    return { total: Number(agg._sum.amount ?? 0).toFixed(2), count: agg._count };
  }

  private async employeeStatistics() {
    const [total, active, byCompany] = await Promise.all([
      this.prisma.employee.count(),
      this.prisma.employee.count({ where: { status: 'active' } }),
      this.prisma.employee.groupBy({ by: ['companyId'], where: { status: 'active' }, _count: { _all: true } }),
    ]);
    const companies = await this.prisma.company.findMany({ select: { id: true, name: true } });
    const nameById = new Map(companies.map((c) => [c.id, c.name]));
    return {
      total,
      active,
      inactive: total - active,
      byCompany: byCompany.map((r) => ({ companyId: r.companyId, companyName: nameById.get(r.companyId) ?? r.companyId, activeEmployees: r._count._all })),
    };
  }
}

function startOfMonthsAgo(n: number) {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCMonth(d.getUTCMonth() - n);
  return d;
}

function monthLabel(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function monthLabels(n: number) {
  const labels: string[] = [];
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  for (let i = n - 1; i >= 0; i--) {
    const m = new Date(d);
    m.setUTCMonth(m.getUTCMonth() - i);
    labels.push(monthLabel(m));
  }
  return labels;
}
