import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConflictAppException, ForbiddenAppException, NotFoundAppException } from '../common/app-exception';
import { AuthenticatedUser } from '../common/strategies/jwt.strategy';
import { hasGroupVisibility, isCompanyInScope } from '../common/scope.util';
import { AuditService } from '../common/audit/audit.service';
import {
  CreateCycleDto,
  CreateObjectiveDto,
  CreateReviewDto,
  SetObjectiveStatusDto,
  SubmitManagerAssessmentDto,
  SubmitSelfAssessmentDto,
} from './dto/performance.dto';

const GROUP_PERM = 'performance.viewAll';
const MANAGE_PERM = 'performance.manage';

@Injectable()
export class PerformanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  // ---------------------------------------------------------------- Cycles

  async listCycles(user: AuthenticatedUser, companyId?: string) {
    const where: any = {};
    if (hasGroupVisibility(user, GROUP_PERM)) {
      if (companyId) where.companyId = companyId;
    } else {
      const scoped = user.scopes.map((s) => s.companyId);
      where.companyId = companyId && scoped.includes(companyId) ? companyId : { in: scoped.length > 0 ? scoped : ['__none__'] };
    }
    return this.prisma.performanceReviewCycle.findMany({ where, orderBy: { startDate: 'desc' } });
  }

  async createCycle(user: AuthenticatedUser, dto: CreateCycleDto) {
    if (!isCompanyInScope(user, dto.companyId, GROUP_PERM)) {
      throw new NotFoundAppException('Company not found.');
    }
    const cycle = await this.prisma.performanceReviewCycle.create({ data: { ...dto, startDate: new Date(dto.startDate), endDate: new Date(dto.endDate) } });
    await this.record(user.id, 'performance.cycle.created', dto.companyId, 'performance_review_cycle', cycle.id, { name: cycle.name });
    return cycle;
  }

  async closeCycle(user: AuthenticatedUser, id: string) {
    const cycle = await this.findCycleOrThrow(user, id);
    if (cycle.status === 'closed') {
      throw new ConflictAppException('Cycle is already closed.');
    }
    const updated = await this.prisma.performanceReviewCycle.update({ where: { id }, data: { status: 'closed' } });
    await this.record(user.id, 'performance.cycle.closed', cycle.companyId, 'performance_review_cycle', id, {});
    return updated;
  }

  private async findCycleOrThrow(user: AuthenticatedUser, id: string) {
    const cycle = await this.prisma.performanceReviewCycle.findUnique({ where: { id } });
    if (!cycle || !isCompanyInScope(user, cycle.companyId, GROUP_PERM)) {
      throw new NotFoundAppException('Review cycle not found.');
    }
    return cycle;
  }

  // ---------------------------------------------------------------- Objectives / KPIs

  async listObjectives(user: AuthenticatedUser, filters: { cycleId?: string; employeeId?: string }) {
    if (filters.cycleId) await this.findCycleOrThrow(user, filters.cycleId);
    const where: any = {};
    if (filters.cycleId) where.cycleId = filters.cycleId;
    if (filters.employeeId) where.employeeId = filters.employeeId;
    return this.prisma.performanceObjective.findMany({ where, orderBy: { createdAt: 'desc' } });
  }

  async createObjective(user: AuthenticatedUser, dto: CreateObjectiveDto) {
    const cycle = await this.findCycleOrThrow(user, dto.cycleId);
    const objective = await this.prisma.performanceObjective.create({ data: dto });
    await this.record(user.id, 'performance.objective.created', cycle.companyId, 'performance_objective', objective.id, { title: objective.title });
    return objective;
  }

  async setObjectiveStatus(user: AuthenticatedUser, id: string, dto: SetObjectiveStatusDto) {
    const objective = await this.prisma.performanceObjective.findUnique({ where: { id } });
    if (!objective) throw new NotFoundAppException('Objective not found.');
    const cycle = await this.findCycleOrThrow(user, objective.cycleId);
    const updated = await this.prisma.performanceObjective.update({ where: { id }, data: { status: dto.status } });
    await this.record(user.id, 'performance.objective.status_set', cycle.companyId, 'performance_objective', id, { status: dto.status });
    return updated;
  }

  // ---------------------------------------------------------------- Reviews

  async createReview(user: AuthenticatedUser, dto: CreateReviewDto) {
    const cycle = await this.findCycleOrThrow(user, dto.cycleId);
    const existing = await this.prisma.performanceReview.findUnique({
      where: { cycleId_employeeId: { cycleId: dto.cycleId, employeeId: dto.employeeId } },
    });
    if (existing) {
      throw new ConflictAppException('A review already exists for this employee in this cycle.');
    }
    const review = await this.prisma.performanceReview.create({
      data: { cycleId: dto.cycleId, employeeId: dto.employeeId, companyId: cycle.companyId, managerEmployeeId: dto.managerEmployeeId },
    });
    await this.record(user.id, 'performance.review.created', cycle.companyId, 'performance_review', review.id, {});
    return review;
  }

  async list(user: AuthenticatedUser, filters: { companyId?: string; employeeId?: string; cycleId?: string }) {
    const where: any = {};
    if (filters.employeeId) where.employeeId = filters.employeeId;
    if (filters.cycleId) where.cycleId = filters.cycleId;

    if (hasGroupVisibility(user, GROUP_PERM)) {
      if (filters.companyId) where.companyId = filters.companyId;
    } else {
      const scoped = user.scopes.map((s) => s.companyId);
      where.companyId = filters.companyId && scoped.includes(filters.companyId) ? filters.companyId : { in: scoped.length > 0 ? scoped : ['__none__'] };
      // Narrower-than-scope default, matching Expense/Leave's convention:
      // without group-wide visibility, only your own reviews and reviews
      // where you're the named manager are visible — performance
      // assessments are more personal than shared master data.
      if (!user.permissions.includes(MANAGE_PERM)) {
        const own = await this.prisma.employee.findFirst({ where: { userId: user.id } });
        const orConditions: any[] = [];
        if (own) {
          orConditions.push({ employeeId: own.id });
          orConditions.push({ managerEmployeeId: own.id });
        }
        where.AND = orConditions.length > 0 ? [{ OR: orConditions }] : [{ id: '__none__' }];
      }
    }
    return this.prisma.performanceReview.findMany({ where, orderBy: { createdAt: 'desc' } });
  }

  // Same self-access reasoning as submitSelfAssessment below: an employee
  // reading their own review must work even with no scope/viewAll
  // permission at all, so ownership is checked before falling back to the
  // scope-gated lookup.
  async getReview(user: AuthenticatedUser, id: string) {
    const review = await this.prisma.performanceReview.findUnique({ where: { id } });
    if (!review) throw new NotFoundAppException('Performance review not found.');
    const own = await this.prisma.employee.findFirst({ where: { userId: user.id } });
    if (own && (own.id === review.employeeId || own.id === review.managerEmployeeId)) {
      return review;
    }
    return this.findReviewOrThrow(user, id);
  }

  // Deliberately does not go through findReviewOrThrow's isCompanyInScope
  // gate — an ordinary "Employee"-role holder submitting their own
  // self-assessment may hold no organizational scope/viewAll permission at
  // all (the same self-service reasoning already applied to Attendance's
  // clock-in and Leave's submit). Ownership (review.employeeId matches the
  // caller's own linked Employee record) is the actual gate here, checked
  // directly, not company scope.
  async submitSelfAssessment(user: AuthenticatedUser, id: string, dto: SubmitSelfAssessmentDto) {
    const review = await this.prisma.performanceReview.findUnique({ where: { id } });
    if (!review) throw new NotFoundAppException('Performance review not found.');
    const own = await this.prisma.employee.findFirst({ where: { userId: user.id } });
    if (!own || own.id !== review.employeeId) {
      throw new ForbiddenAppException('You may only submit your own self-assessment.');
    }
    if (review.status !== 'self_assessment_pending') {
      throw new ConflictAppException(`Review is "${review.status}", not self_assessment_pending.`);
    }
    const updated = await this.prisma.performanceReview.update({
      where: { id },
      data: { selfAssessment: dto.selfAssessment, selfAssessmentAt: new Date(), status: 'manager_review_pending' },
    });
    await this.record(user.id, 'performance.review.self_assessment_submitted', review.companyId, 'performance_review', id, {});
    return updated;
  }

  async submitManagerAssessment(user: AuthenticatedUser, id: string, dto: SubmitManagerAssessmentDto) {
    const review = await this.findReviewOrThrow(user, id);
    if (!user.permissions.includes(MANAGE_PERM)) {
      throw new ForbiddenAppException(`Your role does not include the "${MANAGE_PERM}" permission required for this action.`);
    }
    if (review.status !== 'manager_review_pending') {
      throw new ConflictAppException(`Review is "${review.status}", not manager_review_pending.`);
    }
    const updated = await this.prisma.performanceReview.update({
      where: { id },
      data: {
        managerAssessment: dto.managerAssessment,
        managerRating: dto.managerRating,
        promotionRecommended: dto.promotionRecommended ?? false,
        trainingRecommendation: dto.trainingRecommendation,
        status: 'completed',
        completedAt: new Date(),
      },
    });
    await this.record(user.id, 'performance.review.completed', review.companyId, 'performance_review', id, { managerRating: dto.managerRating, promotionRecommended: dto.promotionRecommended ?? false });
    return updated;
  }

  private async findReviewOrThrow(user: AuthenticatedUser, id: string) {
    const review = await this.prisma.performanceReview.findUnique({ where: { id } });
    if (!review || !isCompanyInScope(user, review.companyId, GROUP_PERM)) {
      throw new NotFoundAppException('Performance review not found.');
    }
    return review;
  }

  private async record(userId: string, eventType: string, companyId: string, entityType: string, entityId: string, newValue: Record<string, unknown>) {
    await this.auditService.record({ eventType, sourceService: 'performance-service', userId, companyId, entityType, entityId, action: 'update', newValue });
  }
}
