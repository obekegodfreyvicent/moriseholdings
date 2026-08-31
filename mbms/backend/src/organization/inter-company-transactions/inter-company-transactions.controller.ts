import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/strategies/jwt.strategy';
import { InterCompanyTransactionsService } from './inter-company-transactions.service';
import { CreateInterCompanyTransactionDto, PostInterCompanyTransactionDto } from './dto/inter-company-transaction.dto';

// Base path /api/v1/organization/inter-company-transactions.
@Controller('organization/inter-company-transactions')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class InterCompanyTransactionsController {
  constructor(private readonly interCompanyTransactionsService: InterCompanyTransactionsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query('companyId') companyId?: string) {
    return this.interCompanyTransactionsService.list(user, companyId);
  }

  @Post()
  @RequirePermission('organization.intercompany.manage')
  create(@CurrentUser() actor: AuthenticatedUser, @Body() dto: CreateInterCompanyTransactionDto) {
    return this.interCompanyTransactionsService.create(actor, dto);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.interCompanyTransactionsService.get(user, id);
  }

  @Post(':id/post')
  @RequirePermission('organization.intercompany.manage')
  post(@CurrentUser() actor: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: PostInterCompanyTransactionDto) {
    return this.interCompanyTransactionsService.post(actor, id, dto);
  }
}
