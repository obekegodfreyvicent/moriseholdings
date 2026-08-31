import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/strategies/jwt.strategy';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { JournalEntriesService } from './journal-entries.service';
import { CreateJournalEntryDto } from './dto/journal-entry.dto';

// Base path /api/v1/accounting/journal-entries — 09_API Specification, Section 9.
@Controller('accounting/journal-entries')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class JournalEntriesController {
  constructor(private readonly journalEntriesService: JournalEntriesService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQueryDto,
    @Query('companyId', ParseUUIDPipe) companyId: string,
    @Query('filter[financialPeriodId]') financialPeriodId?: string,
    @Query('filter[status]') status?: string,
  ) {
    return this.journalEntriesService.list(user, query.page, query.pageSize, companyId, {
      financialPeriodId,
      status,
    });
  }

  @Post()
  @RequirePermission('accounting.manage')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateJournalEntryDto) {
    return this.journalEntriesService.create(user, dto);
  }

  @Post(':id/post')
  @RequirePermission('accounting.manage')
  post(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.journalEntriesService.post(user, id);
  }
}
