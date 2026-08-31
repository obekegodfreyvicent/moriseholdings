import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/strategies/jwt.strategy';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundAppException } from '../common/app-exception';
import { hasGroupVisibility, isCompanyInScope } from '../common/scope.util';
import { toCsv } from '../common/reports/csv.util';
import { buildPdfTable } from '../common/reports/pdf.util';

type Format = 'json' | 'csv' | 'pdf';

// Base path /api/v1/reports — Sprint 13 (RPT-01–06). Every report here
// enforces the EXACT SAME permission its underlying data already requires
// elsewhere in this API (organization.company.viewAll for companies,
// employee.manage/viewAll for employees, audit.view for the audit trail,
// scope-only for customers/suppliers/accounting) — a report is a different
// *shape* of the same data, never a way to see more of it than the
// equivalent list endpoint already allows.
@Controller('reports')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ReportsController {
  constructor(private readonly prisma: PrismaService) {}

  // RPT-01: company/branch listing report.
  @Get('companies')
  @RequirePermission('organization.company.viewAll')
  async companies(@Res({ passthrough: false }) reply: FastifyReply, @Query('format') format?: Format) {
    const companies = await this.prisma.company.findMany({
      include: { branches: true },
      orderBy: { name: 'asc' },
    });
    const headers = ['Company', 'Relationship', 'Currency', 'Status', 'Branch', 'Branch Status'];
    const rows: (string | number)[][] = [];
    for (const c of companies) {
      const relationship = c.relationshipType ?? (c.parentCompanyId ? 'unspecified' : 'root holding company');
      if (c.branches.length === 0) {
        rows.push([c.name, relationship, c.currency, c.status, '', '']);
      } else {
        for (const b of c.branches) {
          rows.push([c.name, relationship, c.currency, c.status, b.name, b.status]);
        }
      }
    }
    return this.respond(reply, format, 'Company and Branch Listing', null, headers, rows);
  }

  // RPT-02: employee listing report, filterable by company/branch/department.
  @Get('employees')
  @RequirePermission('employee.manage', 'employee.viewAll')
  async employees(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: false }) reply: FastifyReply,
    @Query('format') format?: Format,
    @Query('filter[companyId]') companyId?: string,
    @Query('filter[branchId]') branchId?: string,
    @Query('filter[departmentId]') departmentId?: string,
  ) {
    const where: any = {};
    if (companyId) {
      if (!isCompanyInScope(user, companyId, 'employee.viewAll')) throw new NotFoundAppException('Company not found.');
      where.companyId = companyId;
    } else if (!hasGroupVisibility(user, 'employee.viewAll')) {
      where.companyId = { in: user.scopes.map((s) => s.companyId) };
    }
    if (branchId) where.branchId = branchId;
    if (departmentId) where.departmentId = departmentId;

    const employees = await this.prisma.employee.findMany({ where, orderBy: { employeeNumber: 'asc' } });
    const headers = ['Employee #', 'First Name', 'Last Name', 'Job Title', 'Contract Type', 'Status'];
    const rows = employees.map((e) => [e.employeeNumber, e.firstName, e.lastName, e.jobTitle ?? '', e.contractType ?? '', e.status]);
    return this.respond(reply, format, 'Employee Listing', companyId ? `Company: ${companyId}` : 'Group-wide', headers, rows);
  }

  // RPT-03: customer listing report — same "Bearer + scoped" access as
  // GET /customers itself (no additional permission required beyond scope).
  @Get('customers')
  async customers(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: false }) reply: FastifyReply,
    @Query('format') format?: Format,
    @Query('filter[companyId]') companyId?: string,
  ) {
    const where = this.scopedCompanyWhere(user, companyId, 'customer.viewAll');
    const customers = await this.prisma.customer.findMany({ where, orderBy: { name: 'asc' } });
    const headers = ['Name', 'Category', 'Contact Email', 'Contact Phone', 'Credit Limit', 'Status'];
    const rows = customers.map((c) => [c.name, c.category ?? '', c.contactEmail ?? '', c.contactPhone ?? '', c.creditLimit?.toString() ?? '', c.status]);
    return this.respond(reply, format, 'Customer Listing', null, headers, rows);
  }

  // RPT-03: supplier listing report — same access rule as customers, above.
  @Get('suppliers')
  async suppliers(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: false }) reply: FastifyReply,
    @Query('format') format?: Format,
    @Query('filter[companyId]') companyId?: string,
  ) {
    const where = this.scopedCompanyWhere(user, companyId, 'supplier.viewAll');
    const suppliers = await this.prisma.supplier.findMany({ where, orderBy: { name: 'asc' } });
    const headers = ['Name', 'Category', 'Contact Email', 'Contact Phone', 'Tax ID', 'Status'];
    const rows = suppliers.map((s) => [s.name, s.category ?? '', s.contactEmail ?? '', s.contactPhone ?? '', s.taxId ?? '', s.status]);
    return this.respond(reply, format, 'Supplier Listing', null, headers, rows);
  }

  // RPT-04: chart of accounts report + trial balance report for a selected
  // company and period, combined into one exportable report — the same
  // scope rule as GET /accounting/accounts and GET /accounting/reports/
  // trial-balance (no static permission, scope-checked against
  // accounting.viewAll).
  @Get('accounting')
  async accounting(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: false }) reply: FastifyReply,
    @Query('companyId') companyId: string,
    @Query('periodId') periodId?: string,
    @Query('format') format?: Format,
  ) {
    if (!isCompanyInScope(user, companyId, 'accounting.viewAll')) {
      throw new NotFoundAppException('Company not found.');
    }
    const accounts = await this.prisma.account.findMany({ where: { companyId }, orderBy: { accountCode: 'asc' } });

    if (!periodId) {
      const headers = ['Code', 'Name', 'Type', 'Active'];
      const rows = accounts.map((a) => [a.accountCode, a.accountName, a.accountType, a.isActive ? 'Yes' : 'No']);
      return this.respond(reply, format, 'Chart of Accounts', `Company: ${companyId}`, headers, rows);
    }

    const period = await this.prisma.financialPeriod.findUnique({ where: { id: periodId } });
    if (!period || period.companyId !== companyId) throw new NotFoundAppException('Financial period not found for this company.');
    const items = await this.prisma.journalEntryItem.findMany({
      where: { journalEntry: { companyId, financialPeriodId: periodId, status: 'posted' } },
      include: { account: true },
    });
    const byAccount = new Map<string, { code: string; name: string; debit: number; credit: number }>();
    for (const item of items) {
      const key = item.accountId;
      if (!byAccount.has(key)) byAccount.set(key, { code: item.account.accountCode, name: item.account.accountName, debit: 0, credit: 0 });
      const row = byAccount.get(key)!;
      row.debit += Number(item.debitAmount);
      row.credit += Number(item.creditAmount);
    }
    const headers = ['Code', 'Name', 'Debit', 'Credit'];
    const rows = Array.from(byAccount.values())
      .sort((a, b) => a.code.localeCompare(b.code))
      .map((r) => [r.code, r.name, r.debit.toFixed(2), r.credit.toFixed(2)]);
    return this.respond(reply, format, 'Trial Balance', `Company: ${companyId} — Period: ${period.periodName}`, headers, rows);
  }

  // morise.docx, Section 2: "Compare performance of subsidiaries" +
  // "Generate consolidated group reports" — one report, since a
  // consolidated total is just the sum of the same per-company rows a
  // comparison already produces. Same access rule as /reports/companies
  // (organization.company.viewAll), since this is inherently a group-level
  // view spanning every company the caller can see. periodName (not a
  // periodId — company periods are per-company rows, matched by name
  // across companies the same way Sprint 10's consolidated accounting
  // reports already do) is optional; without it, revenue/expense/net
  // income are omitted and only headcount/asset/project counts are shown.
  @Get('company-comparison')
  @RequirePermission('organization.company.viewAll')
  async companyComparison(@Res({ passthrough: false }) reply: FastifyReply, @Query('periodName') periodName?: string, @Query('format') format?: Format) {
    const companies = await this.prisma.company.findMany({ orderBy: { name: 'asc' } });
    const headers = periodName
      ? ['Company', 'Employees', 'Customers', 'Suppliers', 'Active Assets', 'Active Projects', 'Revenue', 'Expense', 'Net Income']
      : ['Company', 'Employees', 'Customers', 'Suppliers', 'Active Assets', 'Active Projects'];
    const rows: (string | number)[][] = [];
    let totalEmployees = 0, totalCustomers = 0, totalSuppliers = 0, totalAssets = 0, totalProjects = 0, totalRevenue = 0, totalExpense = 0;

    for (const company of companies) {
      const [employees, customers, suppliers, assets, projects] = await this.prisma.$transaction([
        this.prisma.employee.count({ where: { companyId: company.id, status: 'active' } }),
        this.prisma.customer.count({ where: { companyId: company.id, status: 'active' } }),
        this.prisma.supplier.count({ where: { companyId: company.id, status: { not: 'blacklisted' } } }),
        this.prisma.asset.count({ where: { companyId: company.id, status: 'active' } }),
        this.prisma.project.count({ where: { companyId: company.id, status: 'active' } }),
      ]);
      totalEmployees += employees;
      totalCustomers += customers;
      totalSuppliers += suppliers;
      totalAssets += assets;
      totalProjects += projects;

      if (!periodName) {
        rows.push([company.name, employees, customers, suppliers, assets, projects]);
        continue;
      }
      const period = await this.prisma.financialPeriod.findFirst({ where: { companyId: company.id, periodName } });
      let revenue = 0, expense = 0;
      if (period) {
        const items = await this.prisma.journalEntryItem.findMany({
          where: { journalEntry: { companyId: company.id, financialPeriodId: period.id, status: 'posted' } },
          include: { account: true },
        });
        for (const item of items) {
          if (item.account.accountType === 'revenue') revenue += Number(item.creditAmount) - Number(item.debitAmount);
          if (item.account.accountType === 'expense') expense += Number(item.debitAmount) - Number(item.creditAmount);
        }
      }
      totalRevenue += revenue;
      totalExpense += expense;
      rows.push([company.name, employees, customers, suppliers, assets, projects, revenue.toFixed(2), expense.toFixed(2), (revenue - expense).toFixed(2)]);
    }

    const totalRow = periodName
      ? ['TOTAL (Group)', totalEmployees, totalCustomers, totalSuppliers, totalAssets, totalProjects, totalRevenue.toFixed(2), totalExpense.toFixed(2), (totalRevenue - totalExpense).toFixed(2)]
      : ['TOTAL (Group)', totalEmployees, totalCustomers, totalSuppliers, totalAssets, totalProjects];
    rows.push(totalRow);

    return this.respond(reply, format, 'Subsidiary Comparison / Consolidated Group Report', periodName ? `Period: ${periodName}` : 'Headcount/assets/projects only — no period selected', headers, rows);
  }

  // RPT-05: audit trail report, filterable by user/date/company/action —
  // same audit.view requirement as GET /audit/logs.
  @Get('audit-trail')
  @RequirePermission('audit.view')
  async auditTrail(
    @Res({ passthrough: false }) reply: FastifyReply,
    @Query('format') format?: Format,
    @Query('filter[userId]') userId?: string,
    @Query('filter[companyId]') companyId?: string,
    @Query('filter[entityType]') entityType?: string,
    @Query('filter[dateFrom]') dateFrom?: string,
    @Query('filter[dateTo]') dateTo?: string,
  ) {
    const where: any = {};
    if (userId) where.userId = userId;
    if (companyId) where.companyId = companyId;
    if (entityType) where.entityType = entityType;
    if (dateFrom || dateTo) {
      where.occurredAt = {};
      if (dateFrom) where.occurredAt.gte = new Date(dateFrom);
      if (dateTo) where.occurredAt.lte = new Date(dateTo);
    }
    const logs = await this.prisma.auditLog.findMany({ where, orderBy: { occurredAt: 'desc' }, take: 1000 });
    const headers = ['Occurred At', 'Event Type', 'Entity Type', 'Action', 'User ID', 'Company ID'];
    const rows = logs.map((l) => [l.occurredAt.toISOString(), l.eventType, l.entityType, l.action, l.userId ?? '', l.companyId ?? '']);
    return this.respond(reply, format, 'Audit Trail Report', null, headers, rows);
  }

  private scopedCompanyWhere(user: AuthenticatedUser, companyId: string | undefined, groupPerm: string) {
    if (companyId) {
      if (!isCompanyInScope(user, companyId, groupPerm)) throw new NotFoundAppException('Company not found.');
      return { companyId };
    }
    if (hasGroupVisibility(user, groupPerm)) return {};
    const scopedCompanyIds = user.scopes.map((s) => s.companyId);
    return { companyId: { in: scopedCompanyIds.length > 0 ? scopedCompanyIds : ['__none__'] } };
  }

  // RPT-06: format=csv|pdf streams the export directly (bypassing the
  // global {data,error} envelope via @Res({passthrough:false})); anything
  // else (the default) returns the same {headers, rows} shape through the
  // normal envelope, for programmatic/UI consumers that want structured
  // JSON rather than a file.
  private async respond(
    reply: FastifyReply,
    format: Format | undefined,
    title: string,
    subtitle: string | null,
    headers: string[],
    rows: (string | number)[][],
  ) {
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    if (format === 'csv') {
      reply
        .header('Content-Type', 'text/csv; charset=utf-8')
        .header('Content-Disposition', `attachment; filename="${slug}.csv"`)
        .send(toCsv(headers, rows));
      return;
    }
    if (format === 'pdf') {
      const buffer = await buildPdfTable(title, subtitle, headers, rows);
      reply
        .header('Content-Type', 'application/pdf')
        .header('Content-Disposition', `attachment; filename="${slug}.pdf"`)
        .send(buffer);
      return;
    }
    reply.header('Content-Type', 'application/json').send({ data: { title, subtitle, headers, rows }, error: null });
  }
}
