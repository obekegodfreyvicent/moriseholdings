import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundAppException } from '../../common/app-exception';
import { AuthenticatedUser } from '../../common/strategies/jwt.strategy';
import { isCompanyInScope } from '../../common/scope.util';
import { AuditService } from '../../common/audit/audit.service';
import { SetBudgetDto } from './dto/budget.dto';

const GROUP_PERM = 'accounting.viewAll';

@Injectable()
export class BudgetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async list(user: AuthenticatedUser, financialPeriodId: string) {
    const period = await this.prisma.financialPeriod.findUnique({ where: { id: financialPeriodId } });
    if (!period || !isCompanyInScope(user, period.companyId, GROUP_PERM)) {
      throw new NotFoundAppException('Financial period not found.');
    }
    return this.prisma.budget.findMany({ where: { financialPeriodId }, include: { account: true } });
  }

  // Upsert — one budgeted amount per account per period, matching how
  // LeaveBalance is upserted rather than accumulated (a re-submission
  // corrects the figure, it doesn't add to it).
  async set(user: AuthenticatedUser, dto: SetBudgetDto) {
    if (!isCompanyInScope(user, dto.companyId, GROUP_PERM)) {
      throw new NotFoundAppException('Company not found.');
    }
    const period = await this.prisma.financialPeriod.findUnique({ where: { id: dto.financialPeriodId } });
    if (!period || period.companyId !== dto.companyId) {
      throw new NotFoundAppException('Financial period not found for this company.');
    }
    const account = await this.prisma.account.findUnique({ where: { id: dto.accountId } });
    if (!account || account.companyId !== dto.companyId) {
      throw new NotFoundAppException('Account not found for this company.');
    }

    const budget = await this.prisma.budget.upsert({
      where: { financialPeriodId_accountId: { financialPeriodId: dto.financialPeriodId, accountId: dto.accountId } },
      update: { budgetedAmount: dto.budgetedAmount },
      create: { companyId: dto.companyId, financialPeriodId: dto.financialPeriodId, accountId: dto.accountId, budgetedAmount: dto.budgetedAmount, createdBy: user.id },
    });
    await this.auditService.record({
      eventType: 'accounting.budget.set',
      sourceService: 'accounting-service',
      userId: user.id,
      companyId: dto.companyId,
      entityType: 'budget',
      entityId: budget.id,
      action: 'update',
      newValue: { accountId: dto.accountId, budgetedAmount: dto.budgetedAmount },
    });
    return budget;
  }
}
