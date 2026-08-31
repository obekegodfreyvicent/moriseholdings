import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConflictAppException, NotFoundAppException } from '../common/app-exception';
import { Paginated } from '../common/interceptors/response.interceptor';
import { AuthenticatedUser } from '../common/strategies/jwt.strategy';
import { hasGroupVisibility, isCompanyInScope } from '../common/scope.util';
import {
  AddTeamMemberDto,
  CreateMilestoneDto,
  CreateProjectDto,
  CreateTaskDto,
  RemoveTeamMemberDto,
  UpdateProjectDto,
  UpdateTaskDto,
} from './dto/project.dto';
import { AuditService } from '../common/audit/audit.service';

const GROUP_PERM = 'project.viewAll';

// 05_Business Process Document, Section 6.6: "Project Registered -> Manager
// & Team Assigned -> Budget Allocated -> Tasks Assigned & Tracked ->
// Progress & Expenses Recorded -> Project Reviewed for Profitability ->
// Project Closed". Modeled as five explicit transitions rather than a
// generic PATCH status field, the same auditability convention every
// other workflow module (Expenses, Assets) already uses.
const ALLOWED_TRANSITIONS: Record<string, string> = {
  activate: 'active',
  hold: 'on_hold',
  resume: 'active',
  complete: 'completed',
  close: 'closed',
};
const TRANSITION_FROM: Record<string, string[]> = {
  activate: ['planned'],
  hold: ['active'],
  resume: ['on_hold'],
  complete: ['active', 'on_hold'],
  close: ['completed'],
};

function toResource(p: any) {
  return {
    id: p.id,
    companyId: p.companyId,
    branchId: p.branchId,
    departmentId: p.departmentId,
    projectCode: p.projectCode,
    name: p.name,
    description: p.description,
    managerEmployeeId: p.managerEmployeeId,
    startDate: p.startDate,
    plannedEndDate: p.plannedEndDate,
    actualEndDate: p.actualEndDate,
    budget: Number(p.budget).toFixed(2),
    revenueAmount: Number(p.revenueAmount).toFixed(2),
    status: p.status,
    createdBy: p.createdBy,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

function toTeamMemberResource(m: any) {
  return { id: m.id, projectId: m.projectId, employeeId: m.employeeId, role: m.role, addedAt: m.addedAt };
}

function toTaskResource(t: any) {
  return {
    id: t.id,
    projectId: t.projectId,
    name: t.name,
    description: t.description,
    assignedToEmployeeId: t.assignedToEmployeeId,
    status: t.status,
    dueDate: t.dueDate,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}

function toMilestoneResource(m: any) {
  return { id: m.id, projectId: m.projectId, name: m.name, dueDate: m.dueDate, status: m.status, completedAt: m.completedAt, createdAt: m.createdAt };
}

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  // GET /projects — FR-PROJ-01, scoped per BR-01. Company-wide operational
  // data (like Assets/Suppliers/Products), not personal claims (unlike
  // Expenses) — any authenticated scoped user sees the full in-scope list.
  async list(user: AuthenticatedUser, page: number, pageSize: number, filters: { companyId?: string; status?: string }): Promise<Paginated<unknown>> {
    const where: any = {};
    if (filters.status) where.status = filters.status;
    if (hasGroupVisibility(user, GROUP_PERM)) {
      if (filters.companyId) where.companyId = filters.companyId;
    } else {
      const scopedCompanyIds = user.scopes.map((s) => s.companyId);
      where.companyId =
        filters.companyId && scopedCompanyIds.includes(filters.companyId)
          ? filters.companyId
          : { in: scopedCompanyIds.length > 0 ? scopedCompanyIds : ['__none__'] };
    }
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.project.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
      this.prisma.project.count({ where }),
    ]);
    return { items: rows.map(toResource), page, pageSize, total };
  }

  // POST /projects — FR-PROJ-01: "Project Registered"
  async create(user: AuthenticatedUser, dto: CreateProjectDto) {
    if (!isCompanyInScope(user, dto.companyId)) {
      throw new NotFoundAppException('Company not found.');
    }
    if (dto.managerEmployeeId) {
      await this.assertEmployee(dto.companyId, dto.managerEmployeeId, 'managerEmployeeId');
    }
    const project = await this.prisma.project.create({
      data: {
        companyId: dto.companyId,
        branchId: dto.branchId,
        departmentId: dto.departmentId,
        projectCode: dto.projectCode,
        name: dto.name,
        description: dto.description,
        managerEmployeeId: dto.managerEmployeeId,
        startDate: new Date(dto.startDate),
        plannedEndDate: dto.plannedEndDate ? new Date(dto.plannedEndDate) : undefined,
        budget: dto.budget ?? 0,
        createdBy: user.id,
      },
    });
    await this.auditService.record({
      eventType: 'project.registered',
      sourceService: 'project-service',
      userId: user.id,
      companyId: project.companyId,
      entityType: 'project',
      entityId: project.id,
      action: 'create',
      newValue: { projectCode: project.projectCode, name: project.name, budget: project.budget.toString() },
    });
    return toResource(project);
  }

  // GET /projects/{id}
  async get(user: AuthenticatedUser, id: string) {
    const project = await this.findOrThrow(id);
    if (!isCompanyInScope(user, project.companyId, GROUP_PERM)) {
      throw new NotFoundAppException('Project not found.');
    }
    return toResource(project);
  }

  // PATCH /projects/{id} — FR-PROJ-01/02 ("Manager & Team Assigned",
  // "Budget Allocated")
  async update(user: AuthenticatedUser, id: string, dto: UpdateProjectDto) {
    const project = await this.findOrThrow(id);
    if (!isCompanyInScope(user, project.companyId, GROUP_PERM)) {
      throw new NotFoundAppException('Project not found.');
    }
    if (dto.managerEmployeeId) {
      await this.assertEmployee(project.companyId, dto.managerEmployeeId, 'managerEmployeeId');
    }
    const updated = await this.prisma.project.update({
      where: { id },
      data: {
        ...dto,
        plannedEndDate: dto.plannedEndDate ? new Date(dto.plannedEndDate) : undefined,
      },
    });
    await this.auditService.record({
      eventType: 'project.updated',
      sourceService: 'project-service',
      userId: user.id,
      companyId: updated.companyId,
      entityType: 'project',
      entityId: updated.id,
      action: 'update',
      previousValue: { budget: project.budget.toString(), managerEmployeeId: project.managerEmployeeId },
      newValue: { budget: updated.budget.toString(), managerEmployeeId: updated.managerEmployeeId },
    });
    return toResource(updated);
  }

  // ------------------------------------------------------------- Team
  async listTeam(user: AuthenticatedUser, id: string) {
    const project = await this.assertVisible(user, id);
    const rows = await this.prisma.projectTeamMember.findMany({ where: { projectId: project.id }, orderBy: { addedAt: 'asc' } });
    return rows.map(toTeamMemberResource);
  }

  async addTeamMember(user: AuthenticatedUser, id: string, dto: AddTeamMemberDto) {
    const project = await this.assertVisible(user, id);
    await this.assertEmployee(project.companyId, dto.employeeId, 'employeeId');
    const member = await this.prisma.projectTeamMember.upsert({
      where: { projectId_employeeId: { projectId: project.id, employeeId: dto.employeeId } },
      update: { role: dto.role },
      create: { projectId: project.id, employeeId: dto.employeeId, role: dto.role },
    });
    await this.auditService.record({
      eventType: 'project.team_member.added',
      sourceService: 'project-service',
      userId: user.id,
      companyId: project.companyId,
      entityType: 'project',
      entityId: project.id,
      action: 'update',
      newValue: { employeeId: dto.employeeId, role: dto.role },
    });
    return toTeamMemberResource(member);
  }

  async removeTeamMember(user: AuthenticatedUser, id: string, dto: RemoveTeamMemberDto) {
    const project = await this.assertVisible(user, id);
    await this.prisma.projectTeamMember.deleteMany({ where: { projectId: project.id, employeeId: dto.employeeId } });
    await this.auditService.record({
      eventType: 'project.team_member.removed',
      sourceService: 'project-service',
      userId: user.id,
      companyId: project.companyId,
      entityType: 'project',
      entityId: project.id,
      action: 'update',
      previousValue: { employeeId: dto.employeeId },
    });
    return { removed: true };
  }

  // ------------------------------------------------------------- Tasks
  async listTasks(user: AuthenticatedUser, id: string) {
    const project = await this.assertVisible(user, id);
    const rows = await this.prisma.projectTask.findMany({ where: { projectId: project.id }, orderBy: { createdAt: 'desc' } });
    return rows.map(toTaskResource);
  }

  async createTask(user: AuthenticatedUser, id: string, dto: CreateTaskDto) {
    const project = await this.assertVisible(user, id);
    if (dto.assignedToEmployeeId) await this.assertEmployee(project.companyId, dto.assignedToEmployeeId, 'assignedToEmployeeId');
    const task = await this.prisma.projectTask.create({
      data: {
        projectId: project.id,
        name: dto.name,
        description: dto.description,
        assignedToEmployeeId: dto.assignedToEmployeeId,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      },
    });
    await this.auditService.record({
      eventType: 'project.task.created',
      sourceService: 'project-service',
      userId: user.id,
      companyId: project.companyId,
      entityType: 'project',
      entityId: project.id,
      action: 'create',
      newValue: { taskId: task.id, name: task.name },
    });
    return toTaskResource(task);
  }

  async updateTask(user: AuthenticatedUser, id: string, taskId: string, dto: UpdateTaskDto) {
    const project = await this.assertVisible(user, id);
    const existing = await this.prisma.projectTask.findUnique({ where: { id: taskId } });
    if (!existing || existing.projectId !== project.id) throw new NotFoundAppException('Task not found for this project.');
    if (dto.assignedToEmployeeId) await this.assertEmployee(project.companyId, dto.assignedToEmployeeId, 'assignedToEmployeeId');
    const updated = await this.prisma.projectTask.update({
      where: { id: taskId },
      data: { ...dto, dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined },
    });
    await this.auditService.record({
      eventType: 'project.task.updated',
      sourceService: 'project-service',
      userId: user.id,
      companyId: project.companyId,
      entityType: 'project',
      entityId: project.id,
      action: 'update',
      previousValue: { taskId, status: existing.status },
      newValue: { taskId, status: updated.status },
    });
    return toTaskResource(updated);
  }

  // ------------------------------------------------------------- Milestones
  async listMilestones(user: AuthenticatedUser, id: string) {
    const project = await this.assertVisible(user, id);
    const rows = await this.prisma.projectMilestone.findMany({ where: { projectId: project.id }, orderBy: { createdAt: 'asc' } });
    return rows.map(toMilestoneResource);
  }

  async createMilestone(user: AuthenticatedUser, id: string, dto: CreateMilestoneDto) {
    const project = await this.assertVisible(user, id);
    const milestone = await this.prisma.projectMilestone.create({
      data: { projectId: project.id, name: dto.name, dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined },
    });
    await this.auditService.record({
      eventType: 'project.milestone.created',
      sourceService: 'project-service',
      userId: user.id,
      companyId: project.companyId,
      entityType: 'project',
      entityId: project.id,
      action: 'create',
      newValue: { milestoneId: milestone.id, name: milestone.name },
    });
    return toMilestoneResource(milestone);
  }

  async completeMilestone(user: AuthenticatedUser, id: string, milestoneId: string) {
    const project = await this.assertVisible(user, id);
    const existing = await this.prisma.projectMilestone.findUnique({ where: { id: milestoneId } });
    if (!existing || existing.projectId !== project.id) throw new NotFoundAppException('Milestone not found for this project.');
    if (existing.status === 'completed') {
      throw new ConflictAppException('This milestone is already completed.');
    }
    const updated = await this.prisma.projectMilestone.update({
      where: { id: milestoneId },
      data: { status: 'completed', completedAt: new Date() },
    });
    await this.auditService.record({
      eventType: 'project.milestone.completed',
      sourceService: 'project-service',
      userId: user.id,
      companyId: project.companyId,
      entityType: 'project',
      entityId: project.id,
      action: 'approve',
      newValue: { milestoneId },
    });
    return toMilestoneResource(updated);
  }

  // ------------------------------------------------------------- Status transitions
  // "Project Closed" and every step before it in 05_Business Process
  // Document, Section 6.6's workflow.
  async transition(user: AuthenticatedUser, id: string, action: keyof typeof ALLOWED_TRANSITIONS) {
    const project = await this.assertVisible(user, id);
    const allowedFrom = TRANSITION_FROM[action];
    if (!allowedFrom.includes(project.status)) {
      throw new ConflictAppException(`Cannot ${action} a project with status "${project.status}".`);
    }
    const newStatus = ALLOWED_TRANSITIONS[action];
    const updated = await this.prisma.project.update({
      where: { id },
      data: {
        status: newStatus as any,
        actualEndDate: newStatus === 'closed' ? new Date() : undefined,
      },
    });
    await this.auditService.record({
      eventType: `project.${action}d`,
      sourceService: 'project-service',
      userId: user.id,
      companyId: updated.companyId,
      entityType: 'project',
      entityId: updated.id,
      action: action === 'close' || action === 'complete' ? 'approve' : 'update',
      previousValue: { status: project.status },
      newValue: { status: updated.status },
    });
    return toResource(updated);
  }

  // GET /projects/{id}/profitability — "Project Reviewed for Profitability".
  // actualCost is the sum of this project's own PAID expense claims — reuse
  // of the existing Expense Service (Sprint 9) rather than a second,
  // parallel expense ledger. Only `paid` claims count, the same "posted
  // only" discipline the trial balance/income statement reports already
  // apply to journal entries.
  async profitability(user: AuthenticatedUser, id: string) {
    const project = await this.assertVisible(user, id);
    const paidExpenses = await this.prisma.expense.findMany({
      where: { projectId: project.id, status: 'paid' },
    });
    const actualCost = paidExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
    const budget = Number(project.budget);
    const revenue = Number(project.revenueAmount);
    const margin = revenue - actualCost;
    return {
      projectId: project.id,
      budget: budget.toFixed(2),
      actualCost: actualCost.toFixed(2),
      budgetVariance: (budget - actualCost).toFixed(2),
      revenueAmount: revenue.toFixed(2),
      margin: margin.toFixed(2),
      marginPercent: revenue > 0 ? ((margin / revenue) * 100).toFixed(1) : null,
      expenseCount: paidExpenses.length,
    };
  }

  private async assertVisible(user: AuthenticatedUser, id: string) {
    const project = await this.findOrThrow(id);
    if (!isCompanyInScope(user, project.companyId, GROUP_PERM)) {
      throw new NotFoundAppException('Project not found.');
    }
    return project;
  }

  private async assertEmployee(companyId: string, employeeId: string, field: string) {
    const employee = await this.prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee || employee.companyId !== companyId) {
      throw new NotFoundAppException(`${field}: employee not found for this company.`);
    }
  }

  private async findOrThrow(id: string) {
    const project = await this.prisma.project.findUnique({ where: { id } });
    if (!project) throw new NotFoundAppException('Project not found.');
    return project;
  }
}
