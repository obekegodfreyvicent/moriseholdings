import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/strategies/jwt.strategy';
import { RecurringEntriesService } from './recurring-entries.service';
import { CreateRecurringEntryDto, GenerateRecurringEntryDto, UpdateRecurringEntryDto } from './dto/recurring-entry.dto';

// Base path /api/v1/accounting/recurring-entries — Sprint 10 (FR-ACC-07).
@Controller('accounting/recurring-entries')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RecurringEntriesController {
  constructor(private readonly recurringEntriesService: RecurringEntriesService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query('companyId', ParseUUIDPipe) companyId: string) {
    return this.recurringEntriesService.list(user, companyId);
  }

  @Post()
  @RequirePermission('accounting.manage')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateRecurringEntryDto) {
    return this.recurringEntriesService.create(user, dto);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.recurringEntriesService.get(user, id);
  }

  @Patch(':id')
  @RequirePermission('accounting.manage')
  update(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateRecurringEntryDto) {
    return this.recurringEntriesService.update(user, id, dto);
  }

  @Post(':id/generate')
  @RequirePermission('accounting.manage')
  generate(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: GenerateRecurringEntryDto) {
    return this.recurringEntriesService.generate(user, id, dto);
  }
}
