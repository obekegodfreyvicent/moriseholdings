import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/strategies/jwt.strategy';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { SuppliersService } from './suppliers.service';
import {
  CreateSupplierContactDto,
  CreateSupplierDto,
  CreateSupplierEvaluationDto,
  SuspendSupplierDto,
  UpdateSupplierContactDto,
  UpdateSupplierDto,
} from './dto/supplier.dto';

// Base path /api/v1/suppliers — 09_API Specification, Section 7.
@Controller('suppliers')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQueryDto,
    @Query('filter[companyId]') companyId?: string,
    @Query('filter[category]') category?: string,
    @Query('filter[status]') status?: string,
  ) {
    return this.suppliersService.list(user, query.page, query.pageSize, { companyId, category, status });
  }

  @Post()
  @RequirePermission('supplier.manage')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateSupplierDto) {
    return this.suppliersService.create(user, dto);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.suppliersService.get(user, id);
  }

  @Patch(':id')
  @RequirePermission('supplier.manage')
  update(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateSupplierDto) {
    return this.suppliersService.update(user, id, dto);
  }

  @Post(':id/blacklist')
  @RequirePermission('supplier.manage')
  blacklist(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.suppliersService.blacklist(user, id);
  }

  @Post(':id/unblacklist')
  @RequirePermission('supplier.manage')
  unblacklist(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.suppliersService.unblacklist(user, id);
  }

  // FR-SUPP-04: time-bound suspension
  @Post(':id/suspend')
  @RequirePermission('supplier.manage')
  suspend(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SuspendSupplierDto,
  ) {
    return this.suppliersService.suspend(user, id, dto);
  }

  @Post(':id/unsuspend')
  @RequirePermission('supplier.manage')
  unsuspend(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.suppliersService.unsuspend(user, id);
  }

  // FR-SUPP-05: multi-contact list
  @Get(':id/contacts')
  listContacts(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.suppliersService.listContacts(user, id);
  }

  @Post(':id/contacts')
  @RequirePermission('supplier.manage')
  addContact(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateSupplierContactDto,
  ) {
    return this.suppliersService.addContact(user, id, dto);
  }

  @Patch(':id/contacts/:contactId')
  @RequirePermission('supplier.manage')
  updateContact(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('contactId', ParseUUIDPipe) contactId: string,
    @Body() dto: UpdateSupplierContactDto,
  ) {
    return this.suppliersService.updateContact(user, id, contactId, dto);
  }

  @Delete(':id/contacts/:contactId')
  @RequirePermission('supplier.manage')
  removeContact(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('contactId', ParseUUIDPipe) contactId: string,
  ) {
    return this.suppliersService.removeContact(user, id, contactId);
  }

  // FR-SUPP-06: evaluation scorecards
  @Get(':id/evaluations')
  listEvaluations(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.suppliersService.listEvaluations(user, id);
  }

  @Post(':id/evaluations')
  @RequirePermission('supplier.manage')
  addEvaluation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateSupplierEvaluationDto,
  ) {
    return this.suppliersService.addEvaluation(user, id, dto);
  }

  @Delete(':id/evaluations/:evaluationId')
  @RequirePermission('supplier.manage')
  removeEvaluation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('evaluationId', ParseUUIDPipe) evaluationId: string,
  ) {
    return this.suppliersService.removeEvaluation(user, id, evaluationId);
  }

  // FR-SUPP-07: derived performance summary
  @Get(':id/performance')
  performance(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.suppliersService.performance(user, id);
  }
}
