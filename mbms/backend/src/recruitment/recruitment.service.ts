import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConflictAppException, NotFoundAppException } from '../common/app-exception';
import { Paginated } from '../common/interceptors/response.interceptor';
import { AuthenticatedUser } from '../common/strategies/jwt.strategy';
import { hasGroupVisibility, isCompanyInScope } from '../common/scope.util';
import { AuditService } from '../common/audit/audit.service';
import {
  CompleteInterviewDto,
  CreateApplicationDto,
  CreateInterviewDto,
  CreateOfferDto,
  CreateVacancyDto,
  RejectApplicationDto,
  RespondOfferDto,
  UpdateVacancyDto,
} from './dto/recruitment.dto';

const GROUP_PERM = 'recruitment.viewAll';

@Injectable()
export class RecruitmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  // ---------------------------------------------------------------- Vacancies

  async listVacancies(user: AuthenticatedUser, page: number, pageSize: number, filters: { companyId?: string; status?: string }) {
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
      this.prisma.jobVacancy.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
      this.prisma.jobVacancy.count({ where }),
    ]);
    return { items: rows, page, pageSize, total } satisfies Paginated<unknown>;
  }

  async createVacancy(user: AuthenticatedUser, dto: CreateVacancyDto) {
    if (!isCompanyInScope(user, dto.companyId, GROUP_PERM)) {
      throw new NotFoundAppException('Company not found.');
    }
    const vacancy = await this.prisma.jobVacancy.create({
      data: { ...dto, closingDate: dto.closingDate ? new Date(dto.closingDate) : null, createdBy: user.id },
    });
    await this.record(user.id, 'recruitment.vacancy.created', vacancy.companyId, 'vacancy', vacancy.id, { title: vacancy.title, status: vacancy.status });
    return vacancy;
  }

  async getVacancy(user: AuthenticatedUser, id: string) {
    const vacancy = await this.findVacancyOrThrow(user, id);
    const applications = await this.prisma.jobApplication.findMany({ where: { vacancyId: id }, orderBy: { appliedAt: 'desc' } });
    return { ...vacancy, applications };
  }

  async updateVacancy(user: AuthenticatedUser, id: string, dto: UpdateVacancyDto) {
    await this.findVacancyOrThrow(user, id);
    const vacancy = await this.prisma.jobVacancy.update({
      where: { id },
      data: { ...dto, closingDate: dto.closingDate ? new Date(dto.closingDate) : undefined },
    });
    await this.record(user.id, 'recruitment.vacancy.updated', vacancy.companyId, 'vacancy', vacancy.id, {});
    return vacancy;
  }

  async submitVacancyForApproval(user: AuthenticatedUser, id: string) {
    const vacancy = await this.findVacancyOrThrow(user, id);
    if (vacancy.status !== 'draft') {
      throw new ConflictAppException(`Vacancy is "${vacancy.status}", not draft.`);
    }
    const updated = await this.prisma.jobVacancy.update({ where: { id }, data: { status: 'pending_approval' } });
    await this.record(user.id, 'recruitment.vacancy.submitted_for_approval', vacancy.companyId, 'vacancy', id, {});
    return updated;
  }

  async approveVacancy(user: AuthenticatedUser, id: string) {
    const vacancy = await this.findVacancyOrThrow(user, id);
    if (vacancy.status !== 'pending_approval') {
      throw new ConflictAppException(`Vacancy is "${vacancy.status}", not pending_approval.`);
    }
    const updated = await this.prisma.jobVacancy.update({
      where: { id },
      data: { status: 'open', postedDate: new Date(), approvedBy: user.id, approvedAt: new Date() },
    });
    await this.record(user.id, 'recruitment.vacancy.approved', vacancy.companyId, 'vacancy', id, {});
    return updated;
  }

  async closeVacancy(user: AuthenticatedUser, id: string) {
    const vacancy = await this.findVacancyOrThrow(user, id);
    if (vacancy.status === 'closed') {
      throw new ConflictAppException('Vacancy is already closed.');
    }
    const updated = await this.prisma.jobVacancy.update({ where: { id }, data: { status: 'closed' } });
    await this.record(user.id, 'recruitment.vacancy.closed', vacancy.companyId, 'vacancy', id, {});
    return updated;
  }

  private async findVacancyOrThrow(user: AuthenticatedUser, id: string) {
    const vacancy = await this.prisma.jobVacancy.findUnique({ where: { id } });
    if (!vacancy || !isCompanyInScope(user, vacancy.companyId, GROUP_PERM)) {
      throw new NotFoundAppException('Vacancy not found.');
    }
    return vacancy;
  }

  // ---------------------------------------------------------------- Applications
  // "Applicant database": this list, filterable by vacancy/status, is the
  // database — no separate CRM table. There is no public candidate portal
  // in this proof-of-concept (the same deferred-infrastructure class as
  // real document upload), so applications are entered by HR, not
  // submitted directly by a candidate.

  async listApplications(user: AuthenticatedUser, vacancyId: string) {
    await this.findVacancyOrThrow(user, vacancyId);
    return this.prisma.jobApplication.findMany({ where: { vacancyId }, orderBy: { appliedAt: 'desc' } });
  }

  async createApplication(user: AuthenticatedUser, vacancyId: string, dto: CreateApplicationDto) {
    const vacancy = await this.findVacancyOrThrow(user, vacancyId);
    const application = await this.prisma.jobApplication.create({ data: { vacancyId, ...dto } });
    await this.record(user.id, 'recruitment.application.created', vacancy.companyId, 'job_application', application.id, { applicantName: application.applicantName });
    return application;
  }

  async getApplication(user: AuthenticatedUser, id: string) {
    const { application } = await this.findApplicationOrThrow(user, id);
    const interviews = await this.prisma.interview.findMany({ where: { applicationId: id }, orderBy: { scheduledAt: 'asc' } });
    const offer = await this.prisma.jobOffer.findUnique({ where: { applicationId: id } });
    return { ...application, interviews, offer };
  }

  async shortlistApplication(user: AuthenticatedUser, id: string) {
    const { application, vacancy } = await this.findApplicationOrThrow(user, id);
    if (application.status !== 'applied') {
      throw new ConflictAppException(`Application is "${application.status}", not applied.`);
    }
    const updated = await this.prisma.jobApplication.update({ where: { id }, data: { status: 'shortlisted' } });
    await this.record(user.id, 'recruitment.application.shortlisted', vacancy.companyId, 'job_application', id, {});
    return updated;
  }

  async rejectApplication(user: AuthenticatedUser, id: string, dto: RejectApplicationDto) {
    const { application, vacancy } = await this.findApplicationOrThrow(user, id);
    if (application.status === 'hired' || application.status === 'rejected') {
      throw new ConflictAppException(`Application is already "${application.status}".`);
    }
    const updated = await this.prisma.jobApplication.update({ where: { id }, data: { status: 'rejected', rejectionReason: dto.reason } });
    await this.record(user.id, 'recruitment.application.rejected', vacancy.companyId, 'job_application', id, { reason: dto.reason });
    return updated;
  }

  // ---------------------------------------------------------------- Interviews

  async createInterview(user: AuthenticatedUser, applicationId: string, dto: CreateInterviewDto) {
    const { application, vacancy } = await this.findApplicationOrThrow(user, applicationId);
    if (!['shortlisted', 'interview_scheduled', 'interviewed'].includes(application.status)) {
      throw new ConflictAppException(`Application must be shortlisted first (currently "${application.status}").`);
    }
    const interview = await this.prisma.interview.create({
      data: { applicationId, scheduledAt: new Date(dto.scheduledAt), interviewerEmployeeId: dto.interviewerEmployeeId, mode: dto.mode, createdBy: user.id },
    });
    if (application.status === 'shortlisted') {
      await this.prisma.jobApplication.update({ where: { id: applicationId }, data: { status: 'interview_scheduled' } });
    }
    await this.record(user.id, 'recruitment.interview.scheduled', vacancy.companyId, 'interview', interview.id, {});
    return interview;
  }

  async completeInterview(user: AuthenticatedUser, id: string, dto: CompleteInterviewDto) {
    const interview = await this.prisma.interview.findUnique({ where: { id } });
    if (!interview) throw new NotFoundAppException('Interview not found.');
    const { application, vacancy } = await this.findApplicationOrThrow(user, interview.applicationId);
    if (interview.status !== 'scheduled') {
      throw new ConflictAppException(`Interview is "${interview.status}", not scheduled.`);
    }
    const updated = await this.prisma.interview.update({
      where: { id },
      data: { status: 'completed', score: dto.score, notes: dto.notes },
    });
    if (application.status === 'interview_scheduled') {
      await this.prisma.jobApplication.update({ where: { id: application.id }, data: { status: 'interviewed' } });
    }
    await this.record(user.id, 'recruitment.interview.completed', vacancy.companyId, 'interview', id, { score: dto.score });
    return updated;
  }

  // ---------------------------------------------------------------- Offers

  async createOffer(user: AuthenticatedUser, applicationId: string, dto: CreateOfferDto) {
    const { application, vacancy } = await this.findApplicationOrThrow(user, applicationId);
    if (application.status !== 'interviewed') {
      throw new ConflictAppException(`Application must be interviewed first (currently "${application.status}").`);
    }
    const offer = await this.prisma.jobOffer.create({
      data: {
        applicationId,
        offeredSalary: dto.offeredSalary,
        currency: dto.currency,
        proposedStartDate: new Date(dto.proposedStartDate),
        issuedBy: user.id,
      },
    });
    await this.prisma.jobApplication.update({ where: { id: applicationId }, data: { status: 'offered' } });
    await this.record(user.id, 'recruitment.offer.issued', vacancy.companyId, 'job_offer', offer.id, {});
    return offer;
  }

  async respondOffer(user: AuthenticatedUser, id: string, dto: RespondOfferDto) {
    const offer = await this.prisma.jobOffer.findUnique({ where: { id } });
    if (!offer) throw new NotFoundAppException('Offer not found.');
    const { vacancy } = await this.findApplicationOrThrow(user, offer.applicationId);
    if (offer.status !== 'pending') {
      throw new ConflictAppException(`Offer is "${offer.status}", not pending.`);
    }
    const updated = await this.prisma.jobOffer.update({ where: { id }, data: { status: dto.status, respondedAt: new Date() } });
    if (dto.status === 'declined') {
      await this.prisma.jobApplication.update({ where: { id: offer.applicationId }, data: { status: 'rejected', rejectionReason: 'Offer declined by candidate.' } });
    }
    await this.record(user.id, 'recruitment.offer.responded', vacancy.companyId, 'job_offer', id, { status: dto.status });
    return updated;
  }

  // Onboarding: the funnel's actual end point — converts an accepted offer
  // into a real Employee record, closing Recruitment into Employee
  // Management rather than leaving "onboarding" as an unlinked status
  // flag. companyId/branchId/departmentId come from the vacancy the
  // application was made against; employeeNumber is generated (no
  // candidate-supplied number exists at this point in the funnel).
  async onboard(user: AuthenticatedUser, offerId: string) {
    const offer = await this.prisma.jobOffer.findUnique({ where: { id: offerId } });
    if (!offer) throw new NotFoundAppException('Offer not found.');
    if (offer.onboardedEmployeeId) {
      throw new ConflictAppException('This offer has already been onboarded.');
    }
    const application = await this.prisma.jobApplication.findUnique({ where: { id: offer.applicationId } });
    if (!application) throw new NotFoundAppException('Application not found.');
    const vacancy = await this.findVacancyOrThrow(user, application.vacancyId);
    if (offer.status !== 'accepted') {
      throw new ConflictAppException(`Offer is "${offer.status}", not accepted.`);
    }

    const [firstName, ...rest] = application.applicantName.trim().split(/\s+/);
    const employeeNumber = `E-${Date.now().toString(36).toUpperCase()}`;
    const employee = await this.prisma.employee.create({
      data: {
        companyId: vacancy.companyId,
        branchId: vacancy.branchId,
        departmentId: vacancy.departmentId,
        employeeNumber,
        firstName: firstName || application.applicantName,
        lastName: rest.join(' ') || '—',
        jobTitle: vacancy.title,
        employmentStartDate: offer.proposedStartDate,
        contractType: vacancy.employmentType,
      },
    });
    await this.prisma.jobOffer.update({ where: { id: offerId }, data: { onboardedEmployeeId: employee.id } });
    await this.prisma.jobApplication.update({ where: { id: application.id }, data: { status: 'hired' } });
    await this.record(user.id, 'recruitment.candidate.onboarded', vacancy.companyId, 'employee', employee.id, { employeeNumber });
    return employee;
  }

  private async findApplicationOrThrow(user: AuthenticatedUser, id: string) {
    const application = await this.prisma.jobApplication.findUnique({ where: { id } });
    if (!application) throw new NotFoundAppException('Application not found.');
    const vacancy = await this.findVacancyOrThrow(user, application.vacancyId);
    return { application, vacancy };
  }

  private async record(userId: string, eventType: string, companyId: string, entityType: string, entityId: string, newValue: Record<string, unknown>) {
    await this.auditService.record({
      eventType,
      sourceService: 'recruitment-service',
      userId,
      companyId,
      entityType,
      entityId,
      action: eventType.endsWith('created') ? 'create' : 'update',
      newValue,
    });
  }
}
