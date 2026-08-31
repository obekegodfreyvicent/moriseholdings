import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { FinanceService } from './finance.service';

// Base path /api/v1/finance — the Admin "Financial & Accounting" overview
// (28 August 2026). Read-only; visible to anyone who holds one of the
// finance-area permissions (the same list the front-end capability map uses
// for the /finance route).
@Controller('finance')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @Get('overview')
  @RequirePermission(
    'accounting.manage',
    'accounting.viewAll',
    'ap.manage',
    'ap.approve',
    'ap.viewAll',
    'expense.viewAll',
    'expense.approve.finance',
    'asset.manage',
    'asset.viewAll',
    'project.manage',
    'project.viewAll',
    'supplier.manage',
    'supplier.viewAll',
    'organization.intercompany.manage',
    'organization.intercompany.viewAll',
  )
  overview() {
    return this.financeService.overview();
  }
}
