import { Injectable, Logger } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { ConflictAppException, NotFoundAppException } from '../common/app-exception';
import { Paginated } from '../common/interceptors/response.interceptor';
import { AuthenticatedUser } from '../common/strategies/jwt.strategy';
import { hasGroupVisibility, isCompanyInScope } from '../common/scope.util';
import { GenerateCardsDto, IssueCardDto, ReissueCardDto, RevokeCardDto, UpdateCardDto } from './dto/staff-id-card.dto';

// Automatic Staff Identification Card (3 September 2026).
//
// Every actively registered administration staff member (an Employee row
// with status `active`) carries exactly one live StaffIdCard. Cards are
// created automatically:
//   • on Employee creation                — issueForEmployeeAuto()
//   • in bulk for anyone still missing one — generate()
// and follow the employee's status: setting an employee inactive revokes
// the card, bringing them back re-activates it (syncEmployeeStatus()).
// An administrator can also issue / reissue / revoke / restore a single
// card and correct its photo reference or expiry date by hand.

const GROUP_PERM = 'employee.idcard.viewAll';
const DEFAULT_VALID_YEARS = 3;

type CardWithEmployee = {
  id: string;
  employeeId: string;
  companyId: string;
  cardNumber: string;
  verificationCode: string;
  status: 'active' | 'revoked' | 'expired';
  issuedOn: Date;
  expiresOn: Date;
  revokedOn: Date | null;
  revokedReason: string | null;
  photoUrl: string | null;
  issuedByUserId: string | null;
  reissueCount: number;
  createdAt: Date;
  updatedAt: Date;
  employee: {
    id: string;
    employeeNumber: string;
    firstName: string;
    lastName: string;
    jobTitle: string | null;
    status: string;
    userId: string | null;
    companyId: string;
    branchId: string | null;
    departmentId: string | null;
    employmentStartDate: Date;
  };
};

function startOfToday(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function addYears(from: Date, years: number): Date {
  const d = new Date(from);
  d.setUTCFullYear(d.getUTCFullYear() + years);
  return d;
}

function initials(firstName: string, lastName: string): string {
  return `${(firstName || '').charAt(0)}${(lastName || '').charAt(0)}`.toUpperCase();
}

@Injectable()
export class StaffIdCardsService {
  private readonly logger = new Logger('StaffIdCardsService');

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  // ---------------------------------------------------------------- helpers

  // MID-XXXXXXXX — eight uppercase hex characters. Random rather than a
  // running sequence so the bulk sweep never races on a counter; the unique
  // index on card_number is the backstop, with a short retry loop.
  private async generateCardNumber(taken: Set<string> = new Set()): Promise<string> {
    for (let attempt = 0; attempt < 8; attempt++) {
      const candidate = `MID-${randomBytes(4).toString('hex').toUpperCase()}`;
      if (taken.has(candidate)) continue;
      const clash = await this.prisma.staffIdCard.findUnique({ where: { cardNumber: candidate } });
      if (!clash) {
        taken.add(candidate);
        return candidate;
      }
    }
    // Astronomically unlikely; fall back to a longer token.
    return `MID-${randomBytes(8).toString('hex').toUpperCase()}`;
  }

  private verificationCode(): string {
    return randomBytes(24).toString('hex'); // 48 chars, fits VarChar(64)
  }

  private isValidNow(card: { status: string; expiresOn: Date }, today = startOfToday()): boolean {
    return card.status === 'active' && new Date(card.expiresOn) >= today;
  }

  private async decorate(cards: CardWithEmployee[]) {
    const companyIds = new Set<string>();
    const departmentIds = new Set<string>();
    const branchIds = new Set<string>();
    for (const c of cards) {
      companyIds.add(c.companyId);
      if (c.employee.departmentId) departmentIds.add(c.employee.departmentId);
      if (c.employee.branchId) branchIds.add(c.employee.branchId);
    }
    const empty: { id: string; name: string }[] = [];
    const [companies, departments, branches] = await Promise.all([
      this.prisma.company.findMany({ where: { id: { in: [...companyIds] } }, select: { id: true, name: true } }),
      departmentIds.size
        ? this.prisma.department.findMany({ where: { id: { in: [...departmentIds] } }, select: { id: true, name: true } })
        : Promise.resolve(empty),
      branchIds.size
        ? this.prisma.branch.findMany({ where: { id: { in: [...branchIds] } }, select: { id: true, name: true } })
        : Promise.resolve(empty),
    ]);
    const toNameMap = (rows: { id: string; name: string }[]) =>
      new Map<string, string>(rows.map((x) => [x.id, x.name] as [string, string]));
    const companyName = toNameMap(companies);
    const departmentName = toNameMap(departments);
    const branchName = toNameMap(branches);
    const today = startOfToday();
    return cards.map((c) => this.toResource(c, { companyName, departmentName, branchName }, today));
  }

  private toResource(
    c: CardWithEmployee,
    names: { companyName: Map<string, string>; departmentName: Map<string, string>; branchName: Map<string, string> },
    today = startOfToday(),
  ) {
    const e = c.employee;
    return {
      id: c.id,
      cardNumber: c.cardNumber,
      verificationCode: c.verificationCode,
      status: c.status,
      isValid: this.isValidNow(c, today),
      issuedOn: c.issuedOn,
      expiresOn: c.expiresOn,
      revokedOn: c.revokedOn,
      revokedReason: c.revokedReason,
      photoUrl: c.photoUrl,
      reissueCount: c.reissueCount,
      issuedByUserId: c.issuedByUserId,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      employee: {
        id: e.id,
        employeeNumber: e.employeeNumber,
        firstName: e.firstName,
        lastName: e.lastName,
        fullName: `${e.firstName} ${e.lastName}`,
        initials: initials(e.firstName, e.lastName),
        jobTitle: e.jobTitle,
        status: e.status,
        userId: e.userId,
        employmentStartDate: e.employmentStartDate,
        companyId: e.companyId,
        companyName: names.companyName.get(e.companyId) ?? null,
        departmentId: e.departmentId,
        departmentName: e.departmentId ? names.departmentName.get(e.departmentId) ?? null : null,
        branchId: e.branchId,
        branchName: e.branchId ? names.branchName.get(e.branchId) ?? null : null,
      },
    };
  }

  private scopedCompanyFilter(user: AuthenticatedUser, requestedCompanyId?: string) {
    if (hasGroupVisibility(user, GROUP_PERM)) {
      return requestedCompanyId ? { companyId: requestedCompanyId } : {};
    }
    const scopedIds = user.scopes.map((s) => s.companyId);
    if (requestedCompanyId && scopedIds.includes(requestedCompanyId)) {
      return { companyId: requestedCompanyId };
    }
    return { companyId: { in: scopedIds.length ? scopedIds : ['__none__'] } };
  }

  private async loadOrThrow(user: AuthenticatedUser, id: string): Promise<CardWithEmployee> {
    const card = (await this.prisma.staffIdCard.findUnique({
      where: { id },
      include: { employee: true },
    })) as CardWithEmployee | null;
    if (!card || !isCompanyInScope(user, card.companyId, GROUP_PERM)) {
      throw new NotFoundAppException('Identification card not found.');
    }
    return card;
  }

  // ---------------------------------------------------------------- queries

  async list(
    user: AuthenticatedUser,
    page: number,
    pageSize: number,
    filters: { companyId?: string; status?: string; employeeId?: string; search?: string },
  ): Promise<Paginated<unknown>> {
    const where: any = { ...this.scopedCompanyFilter(user, filters.companyId) };
    if (filters.status && ['active', 'revoked', 'expired'].includes(filters.status)) {
      where.status = filters.status;
    }
    if (filters.employeeId) where.employeeId = filters.employeeId;
    if (filters.search) {
      const q = filters.search.trim();
      where.OR = [
        { cardNumber: { contains: q, mode: 'insensitive' } },
        { employee: { firstName: { contains: q, mode: 'insensitive' } } },
        { employee: { lastName: { contains: q, mode: 'insensitive' } } },
        { employee: { employeeNumber: { contains: q, mode: 'insensitive' } } },
        { employee: { jobTitle: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.staffIdCard.findMany({
        where,
        include: { employee: true },
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.staffIdCard.count({ where }),
    ]);
    const items = await this.decorate(rows as CardWithEmployee[]);
    return { items, page, pageSize, total };
  }

  async summary(user: AuthenticatedUser, companyId?: string) {
    const cardWhere: any = { ...this.scopedCompanyFilter(user, companyId) };
    const empScope = this.scopedCompanyFilter(user, companyId);
    const empWhere: any = { status: 'active', ...empScope };

    const today = startOfToday();
    const in30 = new Date(today);
    in30.setUTCDate(in30.getUTCDate() + 30);

    const [activeStaff, cardsIssued, active, revoked, expired, expiringSoon, activeStaffWithCard] = await Promise.all([
      this.prisma.employee.count({ where: empWhere }),
      this.prisma.staffIdCard.count({ where: cardWhere }),
      this.prisma.staffIdCard.count({ where: { ...cardWhere, status: 'active' } }),
      this.prisma.staffIdCard.count({ where: { ...cardWhere, status: 'revoked' } }),
      this.prisma.staffIdCard.count({ where: { ...cardWhere, status: 'expired' } }),
      this.prisma.staffIdCard.count({
        where: { ...cardWhere, status: 'active', expiresOn: { gte: today, lte: in30 } },
      }),
      this.prisma.staffIdCard.count({ where: { ...cardWhere, employee: { status: 'active' } } }),
    ]);

    return {
      activeStaff,
      cardsIssued,
      missing: Math.max(activeStaff - activeStaffWithCard, 0),
      active,
      revoked,
      expired,
      expiringWithin30Days: expiringSoon,
    };
  }

  async get(user: AuthenticatedUser, id: string) {
    const card = await this.loadOrThrow(user, id);
    return (await this.decorate([card]))[0];
  }

  async getByEmployee(user: AuthenticatedUser, employeeId: string) {
    const employee = await this.prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee || !isCompanyInScope(user, employee.companyId, GROUP_PERM)) {
      throw new NotFoundAppException('Employee not found.');
    }
    const card = (await this.prisma.staffIdCard.findUnique({
      where: { employeeId },
      include: { employee: true },
    })) as CardWithEmployee | null;
    if (!card) return { employeeId, card: null };
    return { employeeId, card: (await this.decorate([card]))[0] };
  }

  async verify(user: AuthenticatedUser, code: string) {
    const card = (await this.prisma.staffIdCard.findUnique({
      where: { verificationCode: code },
      include: { employee: true },
    })) as CardWithEmployee | null;
    if (!card || !isCompanyInScope(user, card.companyId, GROUP_PERM)) {
      return { found: false, valid: false };
    }
    const [company] = await Promise.all([
      this.prisma.company.findUnique({ where: { id: card.companyId }, select: { name: true } }),
    ]);
    return {
      found: true,
      valid: this.isValidNow(card),
      status: card.status,
      cardNumber: card.cardNumber,
      holderName: `${card.employee.firstName} ${card.employee.lastName}`,
      employeeNumber: card.employee.employeeNumber,
      jobTitle: card.employee.jobTitle,
      companyName: company?.name ?? null,
      issuedOn: card.issuedOn,
      expiresOn: card.expiresOn,
    };
  }

  // --------------------------------------------------------------- mutations

  async issue(user: AuthenticatedUser, dto: IssueCardDto) {
    const employee = await this.prisma.employee.findUnique({ where: { id: dto.employeeId } });
    if (!employee || !isCompanyInScope(user, employee.companyId, GROUP_PERM)) {
      throw new NotFoundAppException('Employee not found.');
    }
    const existing = await this.prisma.staffIdCard.findUnique({ where: { employeeId: dto.employeeId } });
    if (existing) {
      throw new ConflictAppException(
        'This employee already has an identification card. Use reissue to replace it, or restore it if it was revoked.',
      );
    }
    const issuedOn = dto.issuedOn ? new Date(dto.issuedOn) : startOfToday();
    const card = await this.prisma.staffIdCard.create({
      data: {
        employeeId: employee.id,
        companyId: employee.companyId,
        cardNumber: await this.generateCardNumber(),
        verificationCode: this.verificationCode(),
        status: 'active',
        issuedOn,
        expiresOn: addYears(issuedOn, dto.validYears ?? DEFAULT_VALID_YEARS),
        photoUrl: dto.photoUrl?.trim() || null,
        issuedByUserId: user.id,
      },
      include: { employee: true },
    });
    await this.auditService.record({
      eventType: 'employee.idcard.issued',
      sourceService: 'staff-id-card-service',
      userId: user.id,
      companyId: card.companyId,
      entityType: 'staff_id_card',
      entityId: card.id,
      action: 'create',
      newValue: { cardNumber: card.cardNumber, employeeNumber: employee.employeeNumber },
    });
    return (await this.decorate([card as CardWithEmployee]))[0];
  }

  async generate(user: AuthenticatedUser, dto: GenerateCardsDto) {
    const scope = this.scopedCompanyFilter(user, dto.companyId);
    const today = startOfToday();
    const validYears = dto.validYears ?? DEFAULT_VALID_YEARS;

    // 1. Age out any live card that has passed its expiry date.
    const expired = await this.prisma.staffIdCard.updateMany({
      where: { ...(scope as any), status: 'active', expiresOn: { lt: today } },
      data: { status: 'expired' },
    });

    // 2. Issue a card for every active employee that still has none.
    const missing = await this.prisma.employee.findMany({
      where: { status: 'active', ...(scope as any), idCard: { is: null } },
      select: { id: true, companyId: true, employeeNumber: true },
    });
    const taken = new Set<string>();
    let generated = 0;
    for (const emp of missing) {
      try {
        await this.prisma.staffIdCard.create({
          data: {
            employeeId: emp.id,
            companyId: emp.companyId,
            cardNumber: await this.generateCardNumber(taken),
            verificationCode: this.verificationCode(),
            status: 'active',
            issuedOn: today,
            expiresOn: addYears(today, validYears),
            issuedByUserId: user.id,
          },
        });
        generated++;
      } catch (err) {
        // A concurrent create for the same employee (unique employee_id) —
        // safe to skip, the card now exists.
        this.logger.warn(`Skipped card for employee ${emp.id}: ${(err as Error).message}`);
      }
    }

    if (generated > 0 || expired.count > 0) {
      await this.auditService.record({
        eventType: 'employee.idcard.bulk_generated',
        sourceService: 'staff-id-card-service',
        userId: user.id,
        companyId: dto.companyId ?? null,
        entityType: 'staff_id_card',
        entityId: null,
        action: 'create',
        newValue: { generated, expired: expired.count },
      });
    }

    const activeStaff = await this.prisma.employee.count({ where: { status: 'active', ...(scope as any) } });
    return { generated, expired: expired.count, activeStaff };
  }

  async update(user: AuthenticatedUser, id: string, dto: UpdateCardDto) {
    const card = await this.loadOrThrow(user, id);
    const data: any = {};
    if (dto.photoUrl !== undefined) data.photoUrl = dto.photoUrl.trim() || null;
    if (dto.expiresOn !== undefined) {
      const expiresOn = new Date(dto.expiresOn);
      data.expiresOn = expiresOn;
      // Correcting an expiry date back into the future revives an aged-out
      // card; a revoked card stays revoked until explicitly restored.
      if (card.status === 'expired' && expiresOn >= startOfToday()) data.status = 'active';
    }
    if (Object.keys(data).length === 0) {
      return (await this.decorate([card]))[0];
    }
    const updated = await this.prisma.staffIdCard.update({
      where: { id },
      data,
      include: { employee: true },
    });
    await this.auditService.record({
      eventType: 'employee.idcard.updated',
      sourceService: 'staff-id-card-service',
      userId: user.id,
      companyId: card.companyId,
      entityType: 'staff_id_card',
      entityId: card.id,
      action: 'update',
      previousValue: { expiresOn: card.expiresOn, photoUrl: card.photoUrl, status: card.status },
      newValue: { expiresOn: updated.expiresOn, photoUrl: updated.photoUrl, status: updated.status },
    });
    return (await this.decorate([updated as CardWithEmployee]))[0];
  }

  async reissue(user: AuthenticatedUser, id: string, dto: ReissueCardDto) {
    const card = await this.loadOrThrow(user, id);
    const today = startOfToday();
    const updated = await this.prisma.staffIdCard.update({
      where: { id },
      data: {
        cardNumber: await this.generateCardNumber(),
        verificationCode: this.verificationCode(),
        status: 'active',
        issuedOn: today,
        expiresOn: addYears(today, dto.validYears ?? DEFAULT_VALID_YEARS),
        revokedOn: null,
        revokedReason: null,
        issuedByUserId: user.id,
        reissueCount: { increment: 1 },
      },
      include: { employee: true },
    });
    await this.auditService.record({
      eventType: 'employee.idcard.reissued',
      sourceService: 'staff-id-card-service',
      userId: user.id,
      companyId: card.companyId,
      entityType: 'staff_id_card',
      entityId: card.id,
      action: 'update',
      previousValue: { cardNumber: card.cardNumber },
      newValue: { cardNumber: updated.cardNumber, reason: dto.reason ?? null },
    });
    return (await this.decorate([updated as CardWithEmployee]))[0];
  }

  async revoke(user: AuthenticatedUser, id: string, dto: RevokeCardDto) {
    const card = await this.loadOrThrow(user, id);
    if (card.status === 'revoked') {
      throw new ConflictAppException('This card is already revoked.');
    }
    const updated = await this.prisma.staffIdCard.update({
      where: { id },
      data: { status: 'revoked', revokedOn: startOfToday(), revokedReason: dto.reason.trim() },
      include: { employee: true },
    });
    await this.auditService.record({
      eventType: 'employee.idcard.revoked',
      sourceService: 'staff-id-card-service',
      userId: user.id,
      companyId: card.companyId,
      entityType: 'staff_id_card',
      entityId: card.id,
      action: 'update',
      previousValue: { status: card.status },
      newValue: { status: 'revoked', reason: dto.reason },
    });
    return (await this.decorate([updated as CardWithEmployee]))[0];
  }

  async restore(user: AuthenticatedUser, id: string) {
    const card = await this.loadOrThrow(user, id);
    if (card.status === 'active') {
      throw new ConflictAppException('This card is already active.');
    }
    if (new Date(card.expiresOn) < startOfToday()) {
      throw new ConflictAppException('This card has passed its expiry date — reissue it instead of restoring it.');
    }
    const updated = await this.prisma.staffIdCard.update({
      where: { id },
      data: { status: 'active', revokedOn: null, revokedReason: null },
      include: { employee: true },
    });
    await this.auditService.record({
      eventType: 'employee.idcard.restored',
      sourceService: 'staff-id-card-service',
      userId: user.id,
      companyId: card.companyId,
      entityType: 'staff_id_card',
      entityId: card.id,
      action: 'update',
      previousValue: { status: card.status },
      newValue: { status: 'active' },
    });
    return (await this.decorate([updated as CardWithEmployee]))[0];
  }

  // -------------------------------------------------- automatic hooks (internal)
  // Called by EmployeesService. Best-effort: a failure here must never block
  // the employee create / update that triggered it.

  async issueForEmployeeAuto(
    employee: { id: string; companyId: string; employeeNumber: string; status: string },
    issuedByUserId?: string,
  ): Promise<void> {
    try {
      if (employee.status !== 'active') return;
      const existing = await this.prisma.staffIdCard.findUnique({ where: { employeeId: employee.id } });
      if (existing) return;
      const today = startOfToday();
      const card = await this.prisma.staffIdCard.create({
        data: {
          employeeId: employee.id,
          companyId: employee.companyId,
          cardNumber: await this.generateCardNumber(),
          verificationCode: this.verificationCode(),
          status: 'active',
          issuedOn: today,
          expiresOn: addYears(today, DEFAULT_VALID_YEARS),
          issuedByUserId: issuedByUserId ?? null,
        },
      });
      await this.auditService.record({
        eventType: 'employee.idcard.issued',
        sourceService: 'staff-id-card-service',
        userId: issuedByUserId ?? null,
        companyId: employee.companyId,
        entityType: 'staff_id_card',
        entityId: card.id,
        action: 'create',
        newValue: { cardNumber: card.cardNumber, employeeNumber: employee.employeeNumber, automatic: true },
      });
    } catch (err) {
      this.logger.error(`Automatic ID-card issue failed for employee ${employee.id}`, err as Error);
    }
  }

  async syncEmployeeStatus(
    employee: { id: string; companyId: string; status: string },
    actingUserId?: string,
  ): Promise<void> {
    try {
      const card = await this.prisma.staffIdCard.findUnique({ where: { employeeId: employee.id } });
      if (!card) {
        // Someone reactivated an employee who never had a card — give them one.
        if (employee.status === 'active') {
          await this.issueForEmployeeAuto(
            { ...employee, employeeNumber: '' },
            actingUserId,
          );
        }
        return;
      }
      if (employee.status === 'inactive' && card.status === 'active') {
        await this.prisma.staffIdCard.update({
          where: { id: card.id },
          data: { status: 'revoked', revokedOn: startOfToday(), revokedReason: 'Employee record set inactive' },
        });
        await this.auditService.record({
          eventType: 'employee.idcard.revoked',
          sourceService: 'staff-id-card-service',
          userId: actingUserId ?? null,
          companyId: employee.companyId,
          entityType: 'staff_id_card',
          entityId: card.id,
          action: 'update',
          newValue: { status: 'revoked', reason: 'Employee record set inactive', automatic: true },
        });
      } else if (
        employee.status === 'active' &&
        card.status === 'revoked' &&
        new Date(card.expiresOn) >= startOfToday()
      ) {
        await this.prisma.staffIdCard.update({
          where: { id: card.id },
          data: { status: 'active', revokedOn: null, revokedReason: null },
        });
        await this.auditService.record({
          eventType: 'employee.idcard.restored',
          sourceService: 'staff-id-card-service',
          userId: actingUserId ?? null,
          companyId: employee.companyId,
          entityType: 'staff_id_card',
          entityId: card.id,
          action: 'update',
          newValue: { status: 'active', automatic: true },
        });
      }
    } catch (err) {
      this.logger.error(`Automatic ID-card status sync failed for employee ${employee.id}`, err as Error);
    }
  }
}
