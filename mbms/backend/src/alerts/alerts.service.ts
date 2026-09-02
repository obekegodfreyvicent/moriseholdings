import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../common/strategies/jwt.strategy';
import { hasGroupVisibility } from '../common/scope.util';

// Notifications & Alerts (section 39) — a single cross-module feed of every
// time-sensitive thing that needs attention: overdue invoices, expiring
// contracts / licences / renewals, vehicle service due, stock below minimum,
// pending approvals, project deadlines. Read-only; each row is derived at
// request time from the module that owns it, filtered to the caller's
// company scope (BR-01). No schema, no new permission.

type Severity = 'critical' | 'warning' | 'info';
const SEV_RANK: Record<Severity, number> = { critical: 0, warning: 1, info: 2 };

interface Alert {
  id: string;
  category: string;
  severity: Severity;
  companyId: string | null;
  // Department responsible for acting on this alert (2 September 2026). Set by
  // routeDepartments() after every source has been collected: a real column
  // where the source row carries one (projects), otherwise a keyword match of
  // the owning function against the company's department names. Null = no
  // department dimension — every admin staff in company scope sees it.
  // Optional only at push time; routeDepartments() sets it on every alert
  // before collect() returns.
  departmentId?: string | null;
  title: string;
  detail: string;
  entityType: string;
  entityId: string | null;
  date: Date | null;
  amount: string | null;
}

// Which department name owns each alert category — matched case-insensitively
// as a substring against the company's own department names, so it survives
// the varied naming across subsidiaries ("Finance", "Finance & Administration",
// "Finance & Billing"). First matching department wins; no match => null.
const DEPT_KEYWORDS: Record<string, string[]> = {
  'invoice.overdue': ['financ', 'billing', 'account', 'revenue', 'credit control', 'client service', 'sales'],
  'supplier_invoice.overdue': ['financ', 'billing', 'account', 'payable', 'procure'],
  'contract.expiring': ['procure', 'purchas', 'supply', 'vendor', 'freight', 'client service', 'client & lender', 'legal', 'admin'],
  'vehicle.renewal': ['fleet', 'logistic', 'transport', 'distribution', 'yard', 'dock', 'field', 'operations'],
  'vehicle.service_due': ['fleet', 'logistic', 'transport', 'distribution', 'yard', 'dock', 'field', 'operations'],
  'asset.insurance_expiring': ['admin', 'financ', 'facilit', 'asset', 'compliance', 'security'],
  'asset.inspection_due': ['inspection', 'audit', 'compliance', 'admin', 'operations', 'facilit', 'field'],
  'stock.below_minimum': ['warehouse', 'inventory', 'stock', 'distribution', 'fulfil', 'putaway', 'receiving', 'collateral control', 'field'],
  'batch.expiring': ['warehouse', 'inventory', 'stock', 'distribution', 'fulfil', 'field'],
  'project.deadline': ['project', 'operations', 'field'],
};

// approval.pending alerts carry the queue name in entityType, not the category.
const APPROVAL_KEYWORDS: Record<string, string[]> = {
  'expense.manager': ['financ', 'account', 'admin'],
  'expense.finance': ['financ', 'account'],
  supplier_invoice: ['financ', 'procure', 'billing', 'account', 'payable'],
  'asset.disposal': ['financ', 'admin', 'asset'],
  leave: ['human resource', 'hr', 'people', 'workforce', 'rostering', 'personnel'],
};

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

@Injectable()
export class AlertsService {
  private readonly logger = new Logger('AlertsService');
  // Per-user throttle for syncToNotifications(): the bell polls the unread
  // count every 20s, but re-deriving the whole feed that often (per user) is
  // wasteful — one reconcile every two minutes is plenty for a POC.
  private readonly lastSync = new Map<string, number>();
  private static readonly SYNC_INTERVAL_MS = 120_000;

  constructor(private readonly prisma: PrismaService) {}

  private scope(user: AuthenticatedUser): { in: string[] } | null {
    if (hasGroupVisibility(user, 'organization.company.viewAll')) return null; // see all
    const ids = user.scopes.map((s) => s.companyId);
    return { in: ids.length ? ids : ['__none__'] };
  }

  private sev(date: Date | null, today: Date): Severity {
    if (!date) return 'info';
    return new Date(date) < today ? 'critical' : 'warning';
  }

  async collect(user: AuthenticatedUser, days = 30): Promise<Alert[]> {
    const window = Math.min(Math.max(days, 0), 365);
    const today = startOfToday();
    const cutoff = new Date(today);
    cutoff.setDate(cutoff.getDate() + window);
    cutoff.setHours(23, 59, 59, 999);

    const scoped = this.scope(user);
    const companyWhere = scoped ? { companyId: scoped } : {};
    const out: Alert[] = [];

    // ---- scoped id sets used by relation-less child tables ----
    const scopedCompanies = scoped
      ? scoped.in
      : (await this.prisma.company.findMany({ select: { id: true } })).map((c) => c.id);
    const vehicles = await this.prisma.vehicle.findMany({
      where: { companyId: { in: scopedCompanies } },
      select: { id: true, companyId: true, registrationNumber: true, currentOdometer: true },
    });
    const vById = new Map(vehicles.map((v) => [v.id, v]));
    const assets = await this.prisma.asset.findMany({
      where: { companyId: { in: scopedCompanies } },
      select: { id: true, companyId: true, assetNumber: true, name: true },
    });
    const aById = new Map(assets.map((a) => [a.id, a]));

    // Department directory for the scoped companies — used to route each
    // alert to the department responsible for acting on it (see below).
    const departments = await this.prisma.department.findMany({
      where: { companyId: { in: scopedCompanies } },
      select: { id: true, companyId: true, name: true },
    });
    const deptByCompany = new Map<string, { id: string; name: string }[]>();
    for (const d of departments) {
      const list = deptByCompany.get(d.companyId) ?? [];
      list.push({ id: d.id, name: d.name });
      deptByCompany.set(d.companyId, list);
    }

    // ---- 1. AR invoices overdue ----
    const arOverdue = await this.prisma.invoice.findMany({
      where: { ...companyWhere, paidAt: null, dueDate: { lt: today } },
      orderBy: { dueDate: 'asc' },
      take: 200,
    });
    for (const i of arOverdue) {
      out.push({
        id: `invoice.overdue:${i.id}`,
        category: 'invoice.overdue',
        severity: 'critical',
        companyId: i.companyId,
        title: `Invoice ${i.invoiceNumber} overdue`,
        detail: `Customer invoice past its due date of ${i.dueDate.toISOString().slice(0, 10)}.`,
        entityType: 'invoice',
        entityId: i.id,
        date: i.dueDate,
        amount: Number(i.amount).toFixed(2),
      });
    }

    // ---- 2. AP supplier invoices overdue ----
    const apOverdue = await this.prisma.supplierInvoice.findMany({
      where: {
        ...companyWhere,
        status: { in: ['approved', 'partially_paid', 'overdue', 'pending_approval'] },
        dueDate: { lt: today },
      },
      orderBy: { dueDate: 'asc' },
      take: 200,
    });
    for (const s of apOverdue) {
      out.push({
        id: `supplier_invoice.overdue:${s.id}`,
        category: 'supplier_invoice.overdue',
        severity: 'critical',
        companyId: s.companyId,
        title: `Supplier invoice ${s.invoiceNumber} overdue`,
        detail: `Payable past its due date of ${s.dueDate.toISOString().slice(0, 10)} (${s.status}).`,
        entityType: 'supplier_invoice',
        entityId: s.id,
        date: s.dueDate,
        amount: Number(s.totalAmount).toFixed(2),
      });
    }

    // ---- 3. Pending approvals (grouped counts) ----
    const [expMgr, expFin, apPending, disposalReq, leavePending] = await Promise.all([
      this.prisma.expense.count({ where: { ...companyWhere, status: 'submitted' } }),
      this.prisma.expense.count({ where: { ...companyWhere, status: 'manager_approved' } }),
      this.prisma.supplierInvoice.count({ where: { ...companyWhere, status: 'pending_approval' } }),
      this.prisma.asset.count({ where: { ...companyWhere, status: 'disposal_requested' } }),
      this.prisma.leaveApplication.count({ where: { ...companyWhere, status: 'submitted' } }),
    ]);
    const pend = (cat: string, n: number, label: string) => {
      if (n > 0)
        out.push({
          id: `approval.pending:${cat}`,
          category: 'approval.pending',
          severity: n >= 5 ? 'warning' : 'info',
          companyId: null,
          title: `${n} ${label} awaiting approval`,
          detail: `${n} item(s) are waiting for a decision.`,
          entityType: cat,
          entityId: null,
          date: null,
          amount: null,
        });
    };
    pend('expense.manager', expMgr, 'expense claim(s)');
    pend('expense.finance', expFin, 'expense claim(s) (finance)');
    pend('supplier_invoice', apPending, 'supplier invoice(s)');
    pend('asset.disposal', disposalReq, 'asset disposal(s)');
    pend('leave', leavePending, 'leave request(s)');

    // ---- 4. Supplier contracts expiring ----
    const contracts = await this.prisma.supplier.findMany({
      where: { ...companyWhere, contractExpiryDate: { not: null, lte: cutoff } },
      orderBy: { contractExpiryDate: 'asc' },
      take: 200,
    });
    for (const c of contracts) {
      out.push({
        id: `contract.expiring:${c.id}`,
        category: 'contract.expiring',
        severity: this.sev(c.contractExpiryDate, today),
        companyId: c.companyId,
        title: `Supplier contract ${new Date(c.contractExpiryDate!) < today ? 'expired' : 'expiring'} — ${c.name}`,
        detail: `Contract ${c.contractReference ?? ''} ends ${c.contractExpiryDate!.toISOString().slice(0, 10)}.`.trim(),
        entityType: 'supplier',
        entityId: c.id,
        date: c.contractExpiryDate,
        amount: null,
      });
    }

    // ---- 5. Vehicle statutory renewals ----
    const renewals = vehicles.length
      ? await this.prisma.vehicleRenewal.findMany({
          where: { vehicleId: { in: vehicles.map((v) => v.id) }, expiryDate: { lte: cutoff } },
          orderBy: { expiryDate: 'asc' },
          take: 200,
        })
      : [];
    for (const r of renewals) {
      const v = vById.get(r.vehicleId);
      out.push({
        id: `vehicle.renewal:${r.id}`,
        category: 'vehicle.renewal',
        severity: this.sev(r.expiryDate, today),
        companyId: v?.companyId ?? null,
        title: `${v?.registrationNumber ?? 'Vehicle'} ${r.renewalType.replace(/_/g, ' ')} ${new Date(r.expiryDate) < today ? 'expired' : 'due'}`,
        detail: `Renewal expires ${r.expiryDate.toISOString().slice(0, 10)}.`,
        entityType: 'vehicle',
        entityId: r.vehicleId,
        date: r.expiryDate,
        amount: null,
      });
    }

    // ---- 6. Vehicle service due ----
    const schedules = vehicles.length
      ? await this.prisma.serviceSchedule.findMany({
          where: { vehicleId: { in: vehicles.map((v) => v.id) }, isActive: true },
        })
      : [];
    for (const s of schedules) {
      const v = vById.get(s.vehicleId);
      const byDate = s.nextDueDate ? new Date(s.nextDueDate) <= today : false;
      const byKm = s.nextDueOdometer != null && v ? v.currentOdometer >= s.nextDueOdometer : false;
      if (!byDate && !byKm) continue;
      out.push({
        id: `vehicle.service_due:${s.id}`,
        category: 'vehicle.service_due',
        severity: byDate && s.nextDueDate && new Date(s.nextDueDate) < today ? 'critical' : 'warning',
        companyId: v?.companyId ?? null,
        title: `${v?.registrationNumber ?? 'Vehicle'} — ${s.name} due`,
        detail: byKm
          ? `Odometer ${v?.currentOdometer.toLocaleString()} has reached the ${s.nextDueOdometer?.toLocaleString()} service point.`
          : `Service due by ${s.nextDueDate?.toISOString().slice(0, 10)}.`,
        entityType: 'vehicle',
        entityId: s.vehicleId,
        date: s.nextDueDate ?? null,
        amount: null,
      });
    }

    // ---- 7. Asset insurance expiring ----
    const assetPolicies = assets.length
      ? await this.prisma.assetInsurancePolicy.findMany({
          where: { assetId: { in: assets.map((a) => a.id) }, status: 'active', endDate: { lte: cutoff } },
          orderBy: { endDate: 'asc' },
          take: 200,
        })
      : [];
    for (const p of assetPolicies) {
      const a = aById.get(p.assetId);
      out.push({
        id: `asset.insurance_expiring:${p.id}`,
        category: 'asset.insurance_expiring',
        severity: this.sev(p.endDate, today),
        companyId: a?.companyId ?? null,
        title: `Asset insurance ${new Date(p.endDate) < today ? 'expired' : 'expiring'} — ${a?.assetNumber ?? ''}`,
        detail: `${p.insurer} policy ${p.policyNumber} ends ${p.endDate.toISOString().slice(0, 10)}.`,
        entityType: 'asset',
        entityId: p.assetId,
        date: p.endDate,
        amount: null,
      });
    }

    // ---- 8. Asset inspections due (latest per asset) ----
    const inspections = assets.length
      ? await this.prisma.assetInspection.findMany({
          where: { assetId: { in: assets.map((a) => a.id) }, nextInspectionDate: { not: null, lte: cutoff } },
          orderBy: { inspectionDate: 'desc' },
        })
      : [];
    const seenAsset = new Set<string>();
    for (const ins of inspections) {
      if (seenAsset.has(ins.assetId)) continue;
      seenAsset.add(ins.assetId);
      const a = aById.get(ins.assetId);
      out.push({
        id: `asset.inspection_due:${ins.assetId}`,
        category: 'asset.inspection_due',
        severity: this.sev(ins.nextInspectionDate, today),
        companyId: a?.companyId ?? null,
        title: `Asset inspection due — ${a?.assetNumber ?? ''} ${a?.name ?? ''}`.trim(),
        detail: `Next inspection due ${ins.nextInspectionDate!.toISOString().slice(0, 10)}.`,
        entityType: 'asset',
        entityId: ins.assetId,
        date: ins.nextInspectionDate,
        amount: null,
      });
    }

    // ---- 9. Stock below minimum ----
    const lowProducts = await this.prisma.product.findMany({
      where: {
        ...companyWhere,
        status: 'active',
        OR: [{ minStockLevel: { not: null } }, { reorderPoint: { not: null } }],
      },
      select: {
        id: true,
        companyId: true,
        productCode: true,
        name: true,
        stockQuantity: true,
        minStockLevel: true,
        reorderPoint: true,
      },
      take: 1000,
    });
    for (const p of lowProducts) {
      const onHand = p.stockQuantity ?? 0;
      const threshold = p.minStockLevel ?? p.reorderPoint ?? null;
      if (threshold === null || onHand >= threshold) continue;
      out.push({
        id: `stock.below_minimum:${p.id}`,
        category: 'stock.below_minimum',
        severity: onHand <= 0 ? 'critical' : 'warning',
        companyId: p.companyId,
        title: `${p.productCode} ${onHand <= 0 ? 'out of stock' : 'below minimum'}`,
        detail: `${p.name}: ${onHand} on hand against a ${p.minStockLevel != null ? 'minimum' : 'reorder point'} of ${threshold}.`,
        entityType: 'product',
        entityId: p.id,
        date: null,
        amount: null,
      });
    }

    // ---- 10. Stock batches expiring ----
    const batches = await this.prisma.stockBatch.findMany({
      where: { ...companyWhere, expiryDate: { not: null, lte: cutoff }, quantity: { gt: 0 } },
      include: { product: { select: { productCode: true, name: true } } },
      orderBy: { expiryDate: 'asc' },
      take: 300,
    });
    for (const b of batches) {
      out.push({
        id: `batch.expiring:${b.id}`,
        category: 'batch.expiring',
        severity: this.sev(b.expiryDate, today),
        companyId: b.companyId,
        title: `Batch ${b.batchNumber} ${new Date(b.expiryDate!) < today ? 'expired' : 'expiring'} — ${b.product.productCode}`,
        detail: `${b.quantity} unit(s) of ${b.product.name} expire ${b.expiryDate!.toISOString().slice(0, 10)}.`,
        entityType: 'product',
        entityId: b.productId,
        date: b.expiryDate,
        amount: null,
      });
    }

    // ---- 11. Project deadlines ----
    const projects = await this.prisma.project.findMany({
      where: {
        ...companyWhere,
        status: { in: ['planned', 'active', 'on_hold'] },
        plannedEndDate: { not: null, lte: cutoff },
      },
      orderBy: { plannedEndDate: 'asc' },
      take: 200,
    });
    for (const pr of projects) {
      out.push({
        id: `project.deadline:${pr.id}`,
        category: 'project.deadline',
        severity: this.sev(pr.plannedEndDate, today),
        companyId: pr.companyId,
        title: `Project ${pr.projectCode} ${new Date(pr.plannedEndDate!) < today ? 'past its planned end' : 'nearing its deadline'}`,
        detail: `${pr.name} planned to end ${pr.plannedEndDate!.toISOString().slice(0, 10)} (status ${pr.status}).`,
        entityType: 'project',
        entityId: pr.id,
        date: pr.plannedEndDate,
        amount: null,
      });
    }

    // ---- department routing (2 September 2026) ----
    // Tag every alert with the department that owns it: a real column where the
    // source row has one (projects), otherwise a keyword match of the owning
    // function against the company's department names. This is what lets the
    // admin bell show each staff member only their own department's alerts.
    const projDeptById = new Map(projects.map((p) => [p.id, p.departmentId] as const));
    for (const a of out) {
      let deptId: string | null = null;
      if (a.category === 'project.deadline' && a.entityId) {
        deptId = projDeptById.get(a.entityId) ?? null;
      }
      if (!deptId && a.companyId) {
        deptId = this.routeDepartment(a.companyId, a.category, a.entityType, deptByCompany);
      }
      a.departmentId = deptId;
    }

    out.sort((x, y) => {
      const s = SEV_RANK[x.severity] - SEV_RANK[y.severity];
      if (s !== 0) return s;
      const dx = x.date ? new Date(x.date).getTime() : Infinity;
      const dy = y.date ? new Date(y.date).getTime() : Infinity;
      return dx - dy;
    });
    return out;
  }

  // The department in `companyId` that owns this alert category (or, for a
  // pending-approval queue, its entityType). Keywords are tried in priority
  // order — the most specific owner first ("warehouse" before the catch-all
  // "field") — and the first keyword that matches a department name wins.
  // Null when nothing matches: the alert is then treated as company-wide.
  private routeDepartment(
    companyId: string,
    category: string,
    entityType: string,
    deptByCompany: Map<string, { id: string; name: string }[]>,
  ): string | null {
    const depts = deptByCompany.get(companyId);
    if (!depts || depts.length === 0) return null;
    const keys = category === 'approval.pending' ? APPROVAL_KEYWORDS[entityType] : DEPT_KEYWORDS[category];
    if (!keys || keys.length === 0) return null;
    for (const k of keys) {
      const hit = depts.find((d) => d.name.toLowerCase().includes(k));
      if (hit) return hit.id;
    }
    return null;
  }

  // Resolve the caller's own department: their linked Employee record first
  // (that is what "admin staff" means here), then a department-scoped
  // UserScope row as a fallback. Null => no department => sees every alert in
  // company scope (same as before this change).
  private async resolveUserDepartment(user: AuthenticatedUser): Promise<string | null> {
    const emp = await this.prisma.employee.findUnique({
      where: { userId: user.id },
      select: { departmentId: true },
    });
    if (emp?.departmentId) return emp.departmentId;
    const scope = await this.prisma.userScope.findFirst({
      where: { userId: user.id, departmentId: { not: null } },
      select: { departmentId: true },
    });
    return scope?.departmentId ?? null;
  }

  // Mirror the caller's live alert feed onto their bell as Notification rows,
  // filtered to their department. Reconciles: creates a row for each alert
  // that has none yet, deletes rows whose underlying alert has cleared.
  // Best-effort and throttled — a failure here must never break the feed.
  async syncToNotifications(user: AuthenticatedUser): Promise<void> {
    const last = this.lastSync.get(user.id) ?? 0;
    if (Date.now() - last < AlertsService.SYNC_INTERVAL_MS) return;
    this.lastSync.set(user.id, Date.now());

    try {
      const groupWide = hasGroupVisibility(user, 'organization.company.viewAll');
      const myDeptId = await this.resolveUserDepartment(user);

      let alerts = await this.collect(user, 30);
      // A staff member with a department sees their department's alerts plus
      // company-wide ones. A group-visibility user, or one with no department,
      // sees everything already in their company scope.
      if (!groupWide && myDeptId) {
        alerts = alerts.filter((a) => !a.departmentId || a.departmentId === myDeptId);
      }

      const desired = new Map(alerts.map((a) => [a.id, a]));
      const existing = await this.prisma.notification.findMany({
        where: { userId: user.id, type: { startsWith: 'alert:' } },
        select: { id: true, entityId: true },
      });
      const existingKeys = new Set(existing.map((e) => e.entityId));

      const staleIds = existing.filter((e) => !desired.has(e.entityId as string)).map((e) => e.id);
      if (staleIds.length) {
        await this.prisma.notification.deleteMany({ where: { id: { in: staleIds } } });
      }

      const toCreate = alerts.filter((a) => !existingKeys.has(a.id));
      if (toCreate.length) {
        await this.prisma.notification.createMany({
          data: toCreate.map((a) => ({
            userId: user.id,
            companyId: a.companyId,
            departmentId: a.departmentId ?? null,
            type: `alert:${a.category}`,
            title: a.title,
            message: a.detail,
            entityType: a.entityType,
            entityId: a.id, // the stable alert key, not a table row id
            isRead: false,
          })),
        });
      }
    } catch (err) {
      this.lastSync.delete(user.id); // let the next poll retry
      this.logger.error('Failed to sync alerts to notifications', err as Error);
    }
  }

  async list(user: AuthenticatedUser, opts: { days?: number; category?: string; severity?: string }) {
    let rows = await this.collect(user, opts.days ?? 30);
    if (opts.category) rows = rows.filter((r) => r.category === opts.category);
    if (opts.severity) rows = rows.filter((r) => r.severity === opts.severity);
    return { windowDays: Math.min(Math.max(opts.days ?? 30, 0), 365), count: rows.length, alerts: rows };
  }

  async summary(user: AuthenticatedUser, days = 30) {
    const rows = await this.collect(user, days);
    const byCategory: Record<string, number> = {};
    let critical = 0,
      warning = 0,
      info = 0,
      overdue = 0,
      upcoming = 0;
    const now = startOfToday();
    for (const r of rows) {
      byCategory[r.category] = (byCategory[r.category] ?? 0) + 1;
      if (r.severity === 'critical') critical++;
      else if (r.severity === 'warning') warning++;
      else info++;
      if (r.date && new Date(r.date) < now) overdue++;
      else if (r.date) upcoming++;
    }
    return {
      windowDays: Math.min(Math.max(days, 0), 365),
      total: rows.length,
      critical,
      warning,
      info,
      overdue,
      upcoming,
      byCategory,
    };
  }
}
