import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/strategies/jwt.strategy';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { SupportService } from './support.service';
import { CreateTicketMessageDto } from './dto/create-ticket-message.dto';

// Base path /api/v1/support/tickets — Sprint 16, staff side: view and
// reply to a customer's support ticket. The customer's own side lives at
// /customer-portal/support (customer-jwt guard, not this one).
@Controller('support/tickets')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('support.ticket.manage', 'support.ticket.viewAll')
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQueryDto,
    @Query('filter[companyId]') companyId?: string,
    @Query('filter[status]') status?: string,
  ) {
    return this.supportService.listForStaff(user, query.page, query.pageSize, { companyId, status });
  }

  @Get(':id')
  get(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.supportService.getForStaff(user, id);
  }

  @Post(':id/messages')
  @RequirePermission('support.ticket.manage')
  reply(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateTicketMessageDto) {
    return this.supportService.replyAsStaff(user, id, dto);
  }

  @Post(':id/resolve')
  @RequirePermission('support.ticket.manage')
  resolve(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.supportService.resolveAsStaff(user, id);
  }
}
