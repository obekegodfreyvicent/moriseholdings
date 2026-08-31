import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/strategies/jwt.strategy';
import { AccountsReceivableService } from './accounts-receivable.service';
import { CreateCustomerCreditNoteDto, CreateCustomerDebitNoteDto } from './dto/accounts-receivable.dto';

const MANAGE = 'accounting.manage';

// Base path /api/v1/ar — Financial Module deepening, 19 August 2026.
@Controller('ar')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AccountsReceivableController {
  constructor(private readonly arService: AccountsReceivableService) {}

  @Post('credit-notes')
  @RequirePermission(MANAGE)
  createCreditNote(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateCustomerCreditNoteDto) {
    return this.arService.createCreditNote(user, dto);
  }

  @Post('debit-notes')
  @RequirePermission(MANAGE)
  createDebitNote(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateCustomerDebitNoteDto) {
    return this.arService.createDebitNote(user, dto);
  }

  @Get('aging')
  aging(@CurrentUser() user: AuthenticatedUser, @Query('companyId', ParseUUIDPipe) companyId: string) {
    return this.arService.aging(user, companyId);
  }

  @Get('outstanding-invoices')
  outstandingInvoices(@CurrentUser() user: AuthenticatedUser, @Query('companyId', ParseUUIDPipe) companyId: string) {
    return this.arService.outstandingInvoices(user, companyId);
  }

  @Get('statement')
  statement(@CurrentUser() user: AuthenticatedUser, @Query('companyId', ParseUUIDPipe) companyId: string, @Query('customerId', ParseUUIDPipe) customerId: string) {
    return this.arService.statement(user, companyId, customerId);
  }

  @Post('invoices/:id/send-reminder')
  sendReminder(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Query('companyId', ParseUUIDPipe) companyId: string) {
    return this.arService.sendReminder(user, companyId, id);
  }
}
