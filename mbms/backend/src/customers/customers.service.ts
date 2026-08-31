import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundAppException } from '../common/app-exception';
import { Paginated } from '../common/interceptors/response.interceptor';
import { AuthenticatedUser } from '../common/strategies/jwt.strategy';
import { hasGroupVisibility, isCompanyInScope } from '../common/scope.util';
import { CreateCustomerDto, UpdateCustomerDto } from './dto/customer.dto';
import { AuditService } from '../common/audit/audit.service';

const GROUP_PERM = 'customer.viewAll';

function toResource(c: any) {
  return {
    id: c.id,
    companyId: c.companyId,
    name: c.name,
    category: c.category,
    contactEmail: c.contactEmail,
    contactPhone: c.contactPhone,
    address: c.address,
    creditLimit: c.creditLimit?.toString() ?? null,
    paymentTermsDays: c.paymentTermsDays,
    status: c.status,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  // GET /customers — FR-CUST-01, scoped per BR-01
  async list(
    user: AuthenticatedUser,
    page: number,
    pageSize: number,
    filters: { companyId?: string; category?: string; status?: string },
  ): Promise<Paginated<unknown>> {
    const where: any = {};
    if (filters.category) where.category = filters.category;
    if (filters.status) where.status = filters.status;

    if (hasGroupVisibility(user, GROUP_PERM)) {
      if (filters.companyId) where.companyId = filters.companyId;
    } else {
      // BR-01 / Alpha 5.2: see the identical fix and comment in
      // employees.service.ts's list() — filters.companyId must be checked
      // against the caller's own scope before use.
      const scopedCompanyIds = user.scopes.map((s) => s.companyId);
      where.companyId =
        filters.companyId && scopedCompanyIds.includes(filters.companyId)
          ? filters.companyId
          : { in: scopedCompanyIds.length > 0 ? scopedCompanyIds : ['__none__'] };
    }

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.customer.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.customer.count({ where }),
    ]);
    return { items: rows.map(toResource), page, pageSize, total };
  }

  // POST /customers — FR-CUST-01 / AC-06
  async create(user: AuthenticatedUser, dto: CreateCustomerDto) {
    if (!isCompanyInScope(user, dto.companyId, GROUP_PERM)) {
      throw new NotFoundAppException('Company not found.');
    }
    const customer = await this.prisma.customer.create({ data: dto });
    await this.auditService.record({
      eventType: 'customer.record.created',
      sourceService: 'customer-service',
      userId: user.id,
      companyId: customer.companyId,
      entityType: 'customer',
      entityId: customer.id,
      action: 'create',
      newValue: { name: customer.name, category: customer.category },
    });
    return toResource(customer);
  }

  // GET /customers/{id} — FR-CUST-01
  async get(user: AuthenticatedUser, id: string) {
    const customer = await this.findOrThrow(id);
    if (!isCompanyInScope(user, customer.companyId, GROUP_PERM)) {
      throw new NotFoundAppException('Customer not found.');
    }
    return toResource(customer);
  }

  // PATCH /customers/{id} — FR-CUST-02
  async update(user: AuthenticatedUser, id: string, dto: UpdateCustomerDto) {
    const customer = await this.findOrThrow(id);
    if (!isCompanyInScope(user, customer.companyId, GROUP_PERM)) {
      throw new NotFoundAppException('Customer not found.');
    }
    const updated = await this.prisma.customer.update({ where: { id }, data: dto });
    await this.auditService.record({
      eventType: 'customer.record.updated',
      sourceService: 'customer-service',
      userId: user.id,
      companyId: updated.companyId,
      entityType: 'customer',
      entityId: updated.id,
      action: 'update',
      previousValue: { creditLimit: customer.creditLimit?.toString(), paymentTermsDays: customer.paymentTermsDays },
      newValue: { creditLimit: updated.creditLimit?.toString(), paymentTermsDays: updated.paymentTermsDays },
    });
    return toResource(updated);
  }

  // GET /customers/{id}/statement — FR-CUST-03
  // Sprint 16 (Customer Storefront) added a real Sales/Invoicing service —
  // this now returns actual invoice + payment transactions with a running
  // balance, replacing the honestly-empty stub this endpoint returned
  // before that sprint (12_UAT Plan, UAT-03's original expectation, no
  // longer applicable). A cancelled order's invoice is excluded, matching
  // InvoicesService.statementForCustomer's own convention exactly.
  async statement(user: AuthenticatedUser, id: string) {
    const customer = await this.findOrThrow(id);
    if (!isCompanyInScope(user, customer.companyId, GROUP_PERM)) {
      throw new NotFoundAppException('Customer not found.');
    }

    const invoices = await this.prisma.invoice.findMany({
      where: { customerId: id, order: { status: { not: 'cancelled' } } },
      orderBy: { createdAt: 'asc' },
    });
    const payments = await this.prisma.payment.findMany({ where: { customerId: id }, orderBy: { createdAt: 'asc' } });

    type Row = { date: Date; type: 'invoice' | 'payment'; reference: string; amount: number };
    const rows: Row[] = [
      ...invoices.map((i) => ({ date: i.createdAt, type: 'invoice' as const, reference: i.invoiceNumber, amount: Number(i.amount) })),
      ...payments.map((p) => ({ date: p.createdAt, type: 'payment' as const, reference: p.reference ?? p.method, amount: -Number(p.amount) })),
    ].sort((a, b) => a.date.getTime() - b.date.getTime());

    let running = 0;
    const transactions = rows.map((r) => {
      running += r.amount;
      return { date: r.date, type: r.type, reference: r.reference, amount: r.amount.toFixed(2), runningBalance: running.toFixed(2) };
    });

    return {
      customerId: id,
      customerName: customer.name,
      transactions,
      balance: running.toFixed(2),
    };
  }

  private async findOrThrow(id: string) {
    const customer = await this.prisma.customer.findUnique({ where: { id } });
    if (!customer) throw new NotFoundAppException('Customer not found.');
    return customer;
  }
}
