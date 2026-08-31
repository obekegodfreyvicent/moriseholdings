import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/strategies/jwt.strategy';
import { BudgetsService } from './budgets.service';
import { SetBudgetDto } from './dto/budget.dto';

// Base path /api/v1/accounting/budgets — Financial Module deepening, 19 August 2026.
@Controller('accounting/budgets')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class BudgetsController {
  constructor(private readonly budgetsService: BudgetsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query('financialPeriodId') financialPeriodId: string) {
    return this.budgetsService.list(user, financialPeriodId);
  }

  @Post()
  @RequirePermission('accounting.manage')
  set(@CurrentUser() user: AuthenticatedUser, @Body() dto: SetBudgetDto) {
    return this.budgetsService.set(user, dto);
  }
}
