import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../common/strategies/jwt.strategy';
import { hasGroupVisibility } from '../common/scope.util';
import { DashboardService } from '../dashboard/dashboard.service';

// Final System Objective — one place that answers the group-management
// questions the specification closes with ("How much money does the group
// have?", "Which subsidiary is making the most profit?", …). Read-only.
// Filtered to the caller's company scope per BR-01: a Group role gets the
// whole group; a subsidiary-scoped user gets only their companies.

type Status = 'answered' | 'partial' | 'planned';

interface Answer {
  key: string;
  question: string;
  answer: string;
  value: number | null;
  unit: 'money' | 'count' | null;
  status: Status;
  breakdown?: any[];
}

const money = (n: number) => `UGX ${Math.round(n).toLocaleString()}`;

@Injectable()
export class ExecutiveService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dashboard: DashboardService,
  ) {}

  private scopeIds(user: AuthenticatedUser): string[] | null {
    if (hasGroupVisibility(user, 'organization.company.viewAll')) return null;
    return user.scopes.map((s) => s.companyId);
  }

  async questions(user: AuthenticatedUser): Promise<{ scope: string; asOf: string; answers: Answer[] }> {
    const scoped = this.scopeIds(user);
    const fin = await this.dashboard.financials();

    let rows = fin.byCompany as any[];
    if (scoped) rows = rows.filter((r) => scoped.includes(r.companyId));
    const companyIds = rows.map((r) => r.companyId);
    const cw = { companyId: { in: companyIds.length ? companyIds : ['__none__'] } };

    const sum = (k: string) => rows.reduce((s, r) => s + Number(r[k] ?? 0), 0);
    const g = {
      cash: sum('cashPosition'),
      bank: sum('bankBalances'),
      assets: sum('totalAssets'),
      liabilities: sum('totalLiabilities'),
      receivables: sum('outstandingReceivables'),
      payables: sum('outstandingPayables'),
      revenue: sum('revenue'),
      expense: sum('expense'),
      netProfit: sum('netProfit'),
    };

    const ranked = [...rows].sort((a, b) => Number(b.netProfit) - Number(a.netProfit));
    const best = ranked[0];
    const worst = ranked[ranked.length - 1];

    // ---- data queries ----
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const in60 = new Date(today);
    in60.setDate(in60.getDate() + 60);
    in60.setHours(23, 59, 59, 999);

    const [assetGroups, empGroups, contractsSoon, expSubmitted, expMgr, apPending] = await Promise.all([
      this.prisma.asset.groupBy({
        by: ['companyId'],
        where: { ...cw, status: { not: 'disposed' } },
        _count: { _all: true },
        _sum: { purchaseCost: true, accumulatedDepreciation: true },
      }),
      this.prisma.employee.groupBy({
        by: ['companyId'],
        where: { ...cw, status: 'active' },
        _count: { _all: true },
        _sum: { grossSalary: true },
      }),
      this.prisma.supplier.findMany({
        where: { ...cw, contractExpiryDate: { not: null, lte: in60 } },
        select: { name: true, contractReference: true, contractExpiryDate: true },
        orderBy: { contractExpiryDate: 'asc' },
        take: 10,
      }),
      this.prisma.expense.count({ where: { ...cw, status: 'submitted' } }),
      this.prisma.expense.count({ where: { ...cw, status: 'manager_approved' } }),
      this.prisma.supplierInvoice.count({ where: { ...cw, status: 'pending_approval' } }),
    ]);

    const companyName = new Map(rows.map((r) => [r.companyId, r.companyName]));
    const nbvByCompany = assetGroups.map((a) => ({
      companyId: a.companyId,
      companyName: companyName.get(a.companyId) ?? a.companyId,
      count: a._count._all,
      netBookValue: (Number(a._sum.purchaseCost ?? 0) - Number(a._sum.accumulatedDepreciation ?? 0)).toFixed(2),
    }));
    const totalAssetCount = assetGroups.reduce((s, a) => s + a._count._all, 0);
    const totalNbv = nbvByCompany.reduce((s, a) => s + Number(a.netBookValue), 0);

    const headcountByCompany = empGroups.map((e) => ({
      companyId: e.companyId,
      companyName: companyName.get(e.companyId) ?? e.companyId,
      employees: e._count._all,
      monthlySalaryBill: Number(e._sum.grossSalary ?? 0).toFixed(2),
    }));
    const totalHeadcount = empGroups.reduce((s, e) => s + e._count._all, 0);
    const totalSalaryBill = empGroups.reduce((s, e) => s + Number(e._sum.grossSalary ?? 0), 0);

    // projects: profit = recorded revenue - paid expenses attributed to it
    const projects = await this.prisma.project.findMany({
      where: { ...cw, status: { in: ['planned', 'active', 'on_hold', 'completed'] } },
      select: { id: true, projectCode: true, name: true, budget: true, revenueAmount: true, companyId: true },
    });
    const paidByProject = await this.prisma.expense.groupBy({
      by: ['projectId'],
      where: { projectId: { in: projects.map((p) => p.id) }, status: 'paid' },
      _sum: { amount: true },
    });
    const spentMap = new Map(paidByProject.map((x) => [x.projectId, Number(x._sum.amount ?? 0)]));
    const projectProfit = projects
      .map((p) => {
        const rev = Number(p.revenueAmount);
        const cost = spentMap.get(p.id) ?? 0;
        return {
          projectCode: p.projectCode,
          name: p.name,
          revenue: rev.toFixed(2),
          actualCost: cost.toFixed(2),
          profit: (rev - cost).toFixed(2),
        };
      })
      .sort((a, b) => Number(b.profit) - Number(a.profit));
    const profitableCount = projectProfit.filter((p) => Number(p.profit) > 0).length;

    // vehicles requiring service
    const vehicles = await this.prisma.vehicle.findMany({
      where: cw,
      select: { id: true, registrationNumber: true, currentOdometer: true },
    });
    const vById = new Map(vehicles.map((v) => [v.id, v]));
    const schedules = vehicles.length
      ? await this.prisma.serviceSchedule.findMany({
          where: { vehicleId: { in: vehicles.map((v) => v.id) }, isActive: true },
        })
      : [];
    const serviceDue = schedules
      .filter((s) => {
        const v = vById.get(s.vehicleId);
        const byDate = s.nextDueDate ? new Date(s.nextDueDate) <= today : false;
        const byKm = s.nextDueOdometer != null && v ? v.currentOdometer >= s.nextDueOdometer : false;
        return byDate || byKm;
      })
      .map((s) => ({ registrationNumber: vById.get(s.vehicleId)?.registrationNumber ?? null, schedule: s.name }));

    // stock below minimum
    const lowProducts = await this.prisma.product.findMany({
      where: {
        ...cw,
        status: 'active',
        OR: [{ minStockLevel: { not: null } }, { reorderPoint: { not: null } }],
      },
      select: { productCode: true, name: true, stockQuantity: true, minStockLevel: true, reorderPoint: true },
    });
    const lowStock = lowProducts
      .filter((p) => {
        const t = p.minStockLevel ?? p.reorderPoint ?? null;
        return t !== null && (p.stockQuantity ?? 0) < t;
      })
      .map((p) => ({ productCode: p.productCode, name: p.name, onHand: p.stockQuantity ?? 0 }));

    // department spend (from paid expenses only)
    const deptSpend = await this.prisma.expense.groupBy({
      by: ['departmentId'],
      where: { ...cw, status: 'paid', departmentId: { not: null } },
      _sum: { amount: true },
    });
    const deptIds = deptSpend.map((d) => d.departmentId!).filter(Boolean);
    const depts = deptIds.length
      ? await this.prisma.department.findMany({ where: { id: { in: deptIds } }, select: { id: true, name: true } })
      : [];
    const deptName = new Map(depts.map((d) => [d.id, d.name]));
    const departmentSpend = deptSpend
      .map((d) => ({ department: deptName.get(d.departmentId!) ?? d.departmentId, spent: Number(d._sum.amount ?? 0).toFixed(2) }))
      .sort((a, b) => Number(b.spent) - Number(a.spent));

    const pendingApprovals = expSubmitted + expMgr + apPending;

    const answers: Answer[] = [
      {
        key: 'group_cash',
        question: 'How much money does the group have?',
        answer: `${money(g.cash)} in cash and bank (of which ${money(g.bank)} in bank accounts).`,
        value: g.cash,
        unit: 'money',
        status: 'answered',
        breakdown: rows.map((r) => ({ companyName: r.companyName, cashPosition: r.cashPosition })),
      },
      {
        key: 'top_subsidiary',
        question: 'Which subsidiary is making the most profit?',
        answer: best ? `${best.companyName} — ${money(Number(best.netProfit))} net this period.` : 'No company data in scope.',
        value: best ? Number(best.netProfit) : null,
        unit: 'money',
        status: 'answered',
        breakdown: ranked.map((r) => ({ companyName: r.companyName, netProfit: r.netProfit })),
      },
      {
        key: 'underperforming_subsidiary',
        question: 'Which subsidiary is underperforming?',
        answer: worst ? `${worst.companyName} — ${money(Number(worst.netProfit))} net this period.` : 'No company data in scope.',
        value: worst ? Number(worst.netProfit) : null,
        unit: 'money',
        status: 'answered',
      },
      {
        key: 'owed_to_suppliers',
        question: 'How much does each company owe suppliers?',
        answer: `${money(g.payables)} outstanding to suppliers across the group.`,
        value: g.payables,
        unit: 'money',
        status: 'answered',
        breakdown: rows.map((r) => ({ companyName: r.companyName, outstandingPayables: r.outstandingPayables })),
      },
      {
        key: 'owed_by_customers',
        question: 'How much do customers owe the group?',
        answer: `${money(g.receivables)} outstanding from customers across the group.`,
        value: g.receivables,
        unit: 'money',
        status: 'answered',
        breakdown: rows.map((r) => ({ companyName: r.companyName, outstandingReceivables: r.outstandingReceivables })),
      },
      {
        key: 'assets_owned',
        question: 'What assets does each company own?',
        answer: `${totalAssetCount} asset(s) with a net book value of ${money(totalNbv)}.`,
        value: totalNbv,
        unit: 'money',
        status: 'answered',
        breakdown: nbvByCompany,
      },
      {
        key: 'headcount',
        question: 'How many employees does the group have?',
        answer: `${totalHeadcount} active employee(s).`,
        value: totalHeadcount,
        unit: 'count',
        status: 'answered',
        breakdown: headcountByCompany.map((h) => ({ companyName: h.companyName, employees: h.employees })),
      },
      {
        key: 'salary_bill',
        question: 'How much is spent on salaries?',
        answer: `${money(totalSalaryBill)} per month in gross salaries (PAYE / NSSF computed on top at each payroll run).`,
        value: totalSalaryBill,
        unit: 'money',
        status: 'answered',
        breakdown: headcountByCompany.map((h) => ({ companyName: h.companyName, monthlySalaryBill: h.monthlySalaryBill })),
      },
      {
        key: 'profitable_projects',
        question: 'Which projects are profitable?',
        answer: `${profitableCount} of ${projectProfit.length} project(s) show a positive margin (recorded revenue less attributed paid expenses).`,
        value: profitableCount,
        unit: 'count',
        status: 'answered',
        breakdown: projectProfit,
      },
      {
        key: 'contracts_expiring',
        question: 'Which contracts are about to expire?',
        answer: `${contractsSoon.length} supplier contract(s) expire within 60 days.`,
        value: contractsSoon.length,
        unit: 'count',
        status: 'partial',
        breakdown: contractsSoon.map((c) => ({
          supplier: c.name,
          reference: c.contractReference,
          expiryDate: c.contractExpiryDate,
        })),
      },
      {
        key: 'vehicles_servicing',
        question: 'Which vehicles require servicing?',
        answer: `${serviceDue.length} vehicle service schedule(s) are due by date or odometer.`,
        value: serviceDue.length,
        unit: 'count',
        status: 'answered',
        breakdown: serviceDue,
      },
      {
        key: 'low_stock',
        question: 'Which stock items are running low?',
        answer: `${lowStock.length} product(s) are below their minimum or reorder point.`,
        value: lowStock.length,
        unit: 'count',
        status: 'answered',
        breakdown: lowStock,
      },
      {
        key: 'pending_approvals',
        question: 'Which payments require approval?',
        answer: `${pendingApprovals} item(s) await approval — ${expSubmitted} expense claim(s) at the manager step, ${expMgr} at finance, ${apPending} supplier invoice(s).`,
        value: pendingApprovals,
        unit: 'count',
        status: 'answered',
      },
      {
        key: 'department_spend',
        question: 'How much has each department spent?',
        answer:
          departmentSpend.length > 0
            ? `Paid expenses by department (top: ${departmentSpend[0].department}, ${money(Number(departmentSpend[0].spent))}).`
            : 'No departmental expenses recorded yet.',
        value: null,
        unit: null,
        status: 'partial',
        breakdown: departmentSpend,
      },
      {
        key: 'investments',
        question: 'How are group investments performing?',
        answer:
          'The holding structure (subsidiary / associate, ownership %) is modelled, but a first-class Investment register with valuation, dividends and returns is on the roadmap.',
        value: null,
        unit: null,
        status: 'planned',
      },
      {
        key: 'current_liabilities',
        question: "What are the company's current liabilities?",
        answer: `${money(g.liabilities)} in total liabilities across the group (payables ${money(g.payables)} plus other liability accounts).`,
        value: g.liabilities,
        unit: 'money',
        status: 'answered',
        breakdown: rows.map((r) => ({ companyName: r.companyName, totalLiabilities: r.totalLiabilities })),
      },
      {
        key: 'consolidated_position',
        question: 'What is the consolidated financial position of the entire group?',
        answer: `Assets ${money(g.assets)} · Liabilities ${money(g.liabilities)} · Revenue ${money(g.revenue)} · Expense ${money(g.expense)} · Net profit ${money(g.netProfit)} · Cash ${money(g.cash)}.`,
        value: g.netProfit,
        unit: 'money',
        status: 'answered',
        breakdown: rows,
      },
    ];

    return {
      scope: scoped ? `${companyIds.length} company(ies) in your scope` : 'the whole group',
      asOf: new Date().toISOString(),
      answers,
    };
  }

  async overview(user: AuthenticatedUser) {
    const q = await this.questions(user);
    const by = new Map(q.answers.map((a) => [a.key, a]));
    const n = (k: string) => by.get(k)?.value ?? null;
    return {
      scope: q.scope,
      asOf: q.asOf,
      groupCash: n('group_cash'),
      netProfit: n('consolidated_position'),
      totalAssets: (by.get('consolidated_position')?.breakdown ?? []).reduce(
        (s: number, r: any) => s + Number(r.totalAssets ?? 0),
        0,
      ),
      totalLiabilities: n('current_liabilities'),
      receivables: n('owed_by_customers'),
      payables: n('owed_to_suppliers'),
      headcount: n('headcount'),
      monthlySalaryBill: n('salary_bill'),
      profitableProjects: n('profitable_projects'),
      pendingApprovals: n('pending_approvals'),
      lowStockItems: n('low_stock'),
      vehiclesDueService: n('vehicles_servicing'),
      contractsExpiring60d: n('contracts_expiring'),
      topSubsidiary: by.get('top_subsidiary')?.answer ?? null,
      underperformingSubsidiary: by.get('underperforming_subsidiary')?.answer ?? null,
    };
  }
}
