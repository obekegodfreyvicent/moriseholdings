import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/strategies/jwt.strategy';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { ExpensesService } from './expenses.service';
import { CreateExpenseDto, PayExpenseDto, RejectExpenseDto } from './dto/expense.dto';

// Base path /api/v1/expenses — Sprint 9 (Phase 2: Expense Management).
@Controller('expenses')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQueryDto,
    @Query('filter[companyId]') companyId?: string,
    @Query('filter[status]') status?: string,
  ) {
    return this.expensesService.list(user, query.page, query.pageSize, { companyId, status });
  }

  @Post()
  @RequirePermission('expense.create')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateExpenseDto) {
    return this.expensesService.create(user, dto);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.expensesService.get(user, id);
  }

  // No static @RequirePermission — approve() checks expense.approve.manager
  // or expense.approve.finance at runtime depending on the claim's current
  // status (see ExpensesService.approve).
  @Post(':id/approve')
  approve(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.expensesService.approve(user, id);
  }

  @Post(':id/reject')
  reject(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RejectExpenseDto) {
    return this.expensesService.reject(user, id, dto);
  }

  @Post(':id/pay')
  @RequirePermission('expense.approve.finance')
  pay(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: PayExpenseDto) {
    return this.expensesService.pay(user, id, dto);
  }
}
