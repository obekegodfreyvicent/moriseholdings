import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ConflictAppException, NotFoundAppException } from '../../common/app-exception';
import { AuthenticatedUser } from '../../common/strategies/jwt.strategy';
import { isCompanyInScope } from '../../common/scope.util';
import { CreateAccountDto, UpdateAccountDto } from './dto/account.dto';
import { AuditService } from '../../common/audit/audit.service';

const GROUP_PERM = 'accounting.viewAll';

function toResource(a: any) {
  return {
    id: a.id,
    companyId: a.companyId,
    accountCode: a.accountCode,
    accountName: a.accountName,
    accountType: a.accountType,
    parentAccountId: a.parentAccountId,
    isActive: a.isActive,
    createdAt: a.createdAt,
  };
}

@Injectable()
export class AccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  // GET /accounting/accounts?companyId=... — FR-ACC-01
  async list(user: AuthenticatedUser, companyId: string) {
    await this.assertScope(user, companyId);
    const rows = await this.prisma.account.findMany({
      where: { companyId },
      orderBy: { accountCode: 'asc' },
    });
    return rows.map(toResource);
  }

  // POST /accounting/accounts — FR-ACC-01
  async create(user: AuthenticatedUser, dto: CreateAccountDto) {
    await this.assertScope(user, dto.companyId);
    const existing = await this.prisma.account.findFirst({
      where: { companyId: dto.companyId, accountCode: dto.accountCode },
    });
    if (existing) {
      throw new ConflictAppException(`Account code "${dto.accountCode}" already exists for this company.`);
    }
    const account = await this.prisma.account.create({
      data: {
        companyId: dto.companyId,
        accountCode: dto.accountCode,
        accountName: dto.accountName,
        accountType: dto.accountType as any,
        parentAccountId: dto.parentAccountId,
      },
    });
    await this.auditService.record({
      eventType: 'accounting.account.created',
      sourceService: 'accounting-service',
      userId: user.id,
      companyId: account.companyId,
      entityType: 'account',
      entityId: account.id,
      action: 'create',
      newValue: { accountCode: account.accountCode, accountName: account.accountName, accountType: account.accountType },
    });
    return toResource(account);
  }

  // PATCH /accounting/accounts/{id} — FR-ACC-01
  async update(user: AuthenticatedUser, id: string, dto: UpdateAccountDto) {
    const account = await this.findOrThrow(id);
    await this.assertScope(user, account.companyId);
    const updated = await this.prisma.account.update({ where: { id }, data: dto });
    return toResource(updated);
  }

  async findOrThrow(id: string) {
    const account = await this.prisma.account.findUnique({ where: { id } });
    if (!account) throw new NotFoundAppException('Account not found.');
    return account;
  }

  async assertScope(user: AuthenticatedUser, companyId: string) {
    if (!isCompanyInScope(user, companyId, GROUP_PERM)) {
      throw new NotFoundAppException('Company not found.');
    }
  }
}
