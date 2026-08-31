import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { PrismaService } from '../prisma/prisma.service';
import { Paginated } from '../common/interceptors/response.interceptor';

function toResource(l: any) {
  return {
    id: l.id,
    eventType: l.eventType,
    sourceService: l.sourceService,
    userId: l.userId,
    companyId: l.companyId,
    entityType: l.entityType,
    entityId: l.entityId,
    action: l.action,
    previousValue: l.previousValue,
    newValue: l.newValue,
    ipAddress: l.ipAddress,
    occurredAt: l.occurredAt,
  };
}

// GET /api/v1/audit/logs — 09_API Specification, Section 10.
// Per FR-AUDIT-03, this controller has no POST/PATCH/DELETE — read-only by
// design, not by omission.
@Controller('audit')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AuditTrailController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('logs')
  @RequirePermission('audit.view')
  async list(
    @Query() query: PaginationQueryDto,
    @Query('filter[userId]') userId?: string,
    @Query('filter[companyId]') companyId?: string,
    @Query('filter[entityType]') entityType?: string,
    @Query('filter[action]') action?: string,
    @Query('filter[dateFrom]') dateFrom?: string,
    @Query('filter[dateTo]') dateTo?: string,
  ): Promise<Paginated<unknown>> {
    const where: any = {};
    if (userId) where.userId = userId;
    if (companyId) where.companyId = companyId;
    if (entityType) where.entityType = entityType;
    if (action) where.action = action;
    if (dateFrom || dateTo) {
      where.occurredAt = {};
      if (dateFrom) where.occurredAt.gte = new Date(dateFrom);
      if (dateTo) where.occurredAt.lte = new Date(dateTo);
    }

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { occurredAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { items: rows.map(toResource), page: query.page, pageSize: query.pageSize, total };
  }
}
