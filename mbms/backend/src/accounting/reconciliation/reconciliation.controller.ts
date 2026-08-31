import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/strategies/jwt.strategy';
import { ReconciliationService } from './reconciliation.service';
import { CreateReconciliationDto } from './dto/reconciliation.dto';

// Base path /api/v1/accounting/reconciliations — Financial Module deepening, 19 August 2026.
@Controller('accounting/reconciliations')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ReconciliationController {
  constructor(private readonly reconciliationService: ReconciliationService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query('companyId', ParseUUIDPipe) companyId: string, @Query('accountId') accountId?: string) {
    return this.reconciliationService.list(user, companyId, accountId);
  }

  @Post()
  @RequirePermission('accounting.manage')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateReconciliationDto) {
    return this.reconciliationService.create(user, dto);
  }

  @Post(':id/reconcile')
  @RequirePermission('accounting.manage')
  reconcile(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.reconciliationService.reconcile(user, id);
  }
}
