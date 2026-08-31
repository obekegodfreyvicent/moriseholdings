import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DashboardService } from '../dashboard/dashboard.service';

// Financial & Accounting overview (28 August 2026) — the read-only landing
// tile for the finance area. It reuses the group financial position the
// dashboard already computes and adds the working-capital / operational
// figures and the period-close status that the finance sub-screens act on.
// No permission logic here — the controller gates it.

@Injectable()
export class FinanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dashboard: DashboardService,
  ) {}

  async overview() {
    const [financials, operations, periods] = await Promise.all([
      this.dashboard.financials(),
      this.operations(),
      this.periods(),
    ]);
    return { generatedAt: new Date().toISOString(), financials, operations, periods };
  }

  private async operations() {
    const [
      apOutstanding,
      apPendingApproval,
      arInvoices,
      expenseAwaitingFinance,
      expenseFinanceApproved,
      assetsActive,
      assetDisposalRequested,
      projectsByStatus,
      interCompanyDraft,
    ] = await Promise.all([
      this.prisma.supplierInvoice.findMany({
        where: { status: { in: ['approved', 'partially_paid', 'overdue'] } },
        select: { totalAmount: true, amountPaid: true, dueDate: true },
      }),
      this.prisma.supplierInvoice.count({ where: { status: 'pending_approval' } }),
      this.prisma.invoice.findMany({ where: { paidAt: null }, select: { amount: true, dueDate: true } }),
      this.prisma.expense.findMany({ where: { status: 'manager_approved' }, select: { amount: true } }),
      this.prisma.expense.count({ where: { status: 'finance_approved' } }),
      this.prisma.asset.findMany({ where: { status: 'active' }, select: { purchaseCost: true, accumulatedDepreciation: true } }),
      this.prisma.asset.count({ where: { status: 'disposal_requested' } }),
      this.prisma.project.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.interCompanyTransaction.count({ where: { status: 'draft' } }),
    ]);

    const now = new Date();
    const apOutstandingAmount = apOutstanding.reduce((s, i) => s + (Number(i.totalAmount) - Number(i.amountPaid)), 0);
    const apOverdueCount = apOutstanding.filter((i) => i.dueDate < now).length;
    const arOutstandingAmount = arInvoices.reduce((s, i) => s + Number(i.amount), 0);
    const arOverdueCount = arInvoices.filter((i) => i.dueDate < now).length;
    const expenseAwaitingAmount = expenseAwaitingFinance.reduce((s, e) => s + Number(e.amount), 0);
    const assetsNbv = assetsActive.reduce((s, a) => s + (Number(a.purchaseCost) - Number(a.accumulatedDepreciation)), 0);
    const projectStatus: Record<string, number> = { planned: 0, active: 0, on_hold: 0, completed: 0, closed: 0 };
    for (const r of projectsByStatus) projectStatus[r.status] = r._count._all;

    return {
      accountsPayable: {
        outstandingCount: apOutstanding.length,
        outstandingAmount: apOutstandingAmount.toFixed(2),
        overdueCount: apOverdueCount,
        pendingApprovalCount: apPendingApproval,
      },
      accountsReceivable: {
        outstandingCount: arInvoices.length,
        outstandingAmount: arOutstandingAmount.toFixed(2),
        overdueCount: arOverdueCount,
      },
      expenses: {
        awaitingFinanceCount: expenseAwaitingFinance.length,
        awaitingFinanceAmount: expenseAwaitingAmount.toFixed(2),
        approvedAwaitingPaymentCount: expenseFinanceApproved,
      },
      assets: {
        activeCount: assetsActive.length,
        netBookValue: assetsNbv.toFixed(2),
        disposalRequestedCount: assetDisposalRequested,
      },
      projects: {
        active: projectStatus.active,
        onHold: projectStatus.on_hold,
        planned: projectStatus.planned,
      },
      interCompany: { draftCount: interCompanyDraft },
    };
  }

  private async periods() {
    const companies = await this.prisma.company.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } });
    const rows = await Promise.all(
      companies.map(async (c) => {
        const [current, openCount, closedCount] = await Promise.all([
          this.prisma.financialPeriod.findFirst({ where: { companyId: c.id }, orderBy: { startDate: 'desc' } }),
          this.prisma.financialPeriod.count({ where: { companyId: c.id, status: 'open' } }),
          this.prisma.financialPeriod.count({ where: { companyId: c.id, status: 'closed' } }),
        ]);
        return {
          companyId: c.id,
          companyName: c.name,
          currentPeriod: current
            ? { name: current.periodName, startDate: current.startDate, endDate: current.endDate, status: current.status }
            : null,
          openCount,
          closedCount,
        };
      }),
    );
    const companiesWithPeriods = rows.filter((r) => r.currentPeriod);
    return {
      companies: companiesWithPeriods,
      totalOpenPeriods: companiesWithPeriods.reduce((s, r) => s + r.openCount, 0),
      totalClosedPeriods: companiesWithPeriods.reduce((s, r) => s + r.closedCount, 0),
    };
  }
}
