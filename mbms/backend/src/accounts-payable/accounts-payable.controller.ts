import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/strategies/jwt.strategy';
import { AccountsPayableService } from './accounts-payable.service';
import { CreateSupplierCreditNoteDto, CreateSupplierInvoiceDto, RecordSupplierPaymentDto } from './dto/accounts-payable.dto';

const MANAGE = 'ap.manage';
const APPROVE = 'ap.approve';

// Base path /api/v1/ap — Financial Module deepening, 19 August 2026.
@Controller('ap')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AccountsPayableController {
  constructor(private readonly apService: AccountsPayableService) {}

  @Get('invoices')
  listInvoices(
    @CurrentUser() user: AuthenticatedUser,
    @Query('filter[companyId]') companyId?: string,
    @Query('filter[supplierId]') supplierId?: string,
    @Query('filter[status]') status?: string,
  ) {
    return this.apService.listInvoices(user, { companyId, supplierId, status });
  }

  @Post('invoices')
  @RequirePermission(MANAGE)
  createInvoice(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateSupplierInvoiceDto) {
    return this.apService.createInvoice(user, dto);
  }

  @Post('invoices/:id/submit-for-approval')
  @RequirePermission(MANAGE)
  submitForApproval(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.apService.submitForApproval(user, id);
  }

  @Post('invoices/:id/approve')
  @RequirePermission(APPROVE)
  approve(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.apService.approve(user, id);
  }

  @Post('payments')
  @RequirePermission(MANAGE)
  recordPayment(@CurrentUser() user: AuthenticatedUser, @Body() dto: RecordSupplierPaymentDto) {
    return this.apService.recordPayment(user, dto);
  }

  @Post('credit-notes')
  @RequirePermission(MANAGE)
  createCreditNote(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateSupplierCreditNoteDto) {
    return this.apService.createCreditNote(user, dto);
  }

  @Get('aging')
  aging(@CurrentUser() user: AuthenticatedUser, @Query('companyId', ParseUUIDPipe) companyId: string) {
    return this.apService.aging(user, companyId);
  }

  @Get('statement')
  statement(@CurrentUser() user: AuthenticatedUser, @Query('companyId', ParseUUIDPipe) companyId: string, @Query('supplierId', ParseUUIDPipe) supplierId: string) {
    return this.apService.statement(user, companyId, supplierId);
  }

  @Get('payment-schedule')
  paymentSchedule(@CurrentUser() user: AuthenticatedUser, @Query('companyId', ParseUUIDPipe) companyId: string) {
    return this.apService.paymentSchedule(user, companyId);
  }
}
