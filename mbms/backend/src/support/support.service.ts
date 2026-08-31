import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConflictAppException, ForbiddenAppException, NotFoundAppException } from '../common/app-exception';
import { AuthenticatedUser } from '../common/strategies/jwt.strategy';
import { hasGroupVisibility, isCompanyInScope } from '../common/scope.util';
import { AuditService } from '../common/audit/audit.service';
import { ContentTranslationService } from '../common/translation/content-translation.service';
import { AuthenticatedCustomer } from '../customer-portal/common/customer-auth.types';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { CreateTicketMessageDto } from './dto/create-ticket-message.dto';

const GROUP_PERM = 'support.ticket.viewAll';
const MANAGE_PERM = 'support.ticket.manage';

function toTicketResource(t: any) {
  return {
    id: t.id,
    ticketNumber: t.ticketNumber,
    companyId: t.companyId,
    customerId: t.customerId,
    category: t.category,
    priority: t.priority,
    subject: t.subject,
    description: t.description,
    // Content localisation (27 August 2026): when the customer wrote in
    // another language, `subject`/`description` above hold the English
    // normalisation and these hold the source language + exact original.
    sourceLanguage: t.sourceLanguage ?? 'en',
    subjectOriginal: t.subjectOriginal ?? null,
    descriptionOriginal: t.descriptionOriginal ?? null,
    relatedOrderId: t.relatedOrderId,
    relatedInvoiceId: t.relatedInvoiceId,
    status: t.status,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    messages: Array.isArray(t.messages)
      ? t.messages.map((m: any) => ({
          id: m.id,
          authorType: m.authorType,
          authorId: m.authorId,
          message: m.message,
          sourceLanguage: m.sourceLanguage ?? 'en',
          messageOriginal: m.messageOriginal ?? null,
          createdAt: m.createdAt,
        }))
      : undefined,
  };
}

const TICKET_INCLUDE = { messages: { orderBy: { createdAt: 'asc' as const } } };

/**
 * Sprint 16 (Customer Storefront). Status semantics (see the TicketStatus
 * enum, schema.prisma): a ticket starts (and stays, on any new customer
 * message) at "awaiting_reply" — from the customer's own perspective,
 * their ticket is awaiting a reply from Morise Holdings. A staff message
 * does NOT flip status automatically (replying isn't the same as
 * resolving); staff explicitly resolve() when the issue is actually
 * settled. "open"/"closed" are left in the enum for a future triage
 * workflow this MVP doesn't need — the same honestly-unused-enum-value
 * convention AuditAction's own "delete" value already establishes.
 */
@Injectable()
export class SupportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly translation: ContentTranslationService,
  ) {}

  // ---------------------------- Customer-facing ----------------------------

  async listForCustomer(customer: AuthenticatedCustomer, page: number, pageSize: number) {
    const where = { customerId: customer.id };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.supportTicket.findMany({ where, include: TICKET_INCLUDE, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
      this.prisma.supportTicket.count({ where }),
    ]);
    return { items: rows.map(toTicketResource), page, pageSize, total };
  }

  async getForCustomer(customer: AuthenticatedCustomer, id: string) {
    const ticket = await this.findOrThrow(id);
    if (ticket.customerId !== customer.id) throw new NotFoundAppException('Support ticket not found.');
    return toTicketResource(ticket);
  }

  // `sourceLang` is the customer's storefront language (parsed from the
  // Accept-Language header). Content localisation (27 August 2026): text the
  // customer typed is normalised to English for storage, with the exact
  // original wording and source language preserved on the row.
  async createForCustomer(customer: AuthenticatedCustomer, dto: CreateTicketDto, sourceLang = 'en') {
    if (dto.relatedOrderId) {
      const order = await this.prisma.order.findUnique({ where: { id: dto.relatedOrderId } });
      if (!order || order.customerId !== customer.id) throw new NotFoundAppException('Related order not found.');
    }
    if (dto.relatedInvoiceId) {
      const invoice = await this.prisma.invoice.findUnique({ where: { id: dto.relatedInvoiceId } });
      if (!invoice || invoice.customerId !== customer.id) throw new NotFoundAppException('Related invoice not found.');
    }

    const count = await this.prisma.supportTicket.count({ where: { companyId: customer.companyId } });
    const ticketNumber = `TCK-${String(1000 + count + 1)}`;

    const lang = this.translation.resolveLang(sourceLang);
    const subjectEn = this.translation.toEnglish(dto.subject, lang);
    const descriptionEn = this.translation.toEnglish(dto.description, lang);
    const keepOriginal = lang !== 'en';

    const ticket = await this.prisma.supportTicket.create({
      data: {
        ticketNumber,
        companyId: customer.companyId,
        customerId: customer.id,
        category: dto.category,
        priority: dto.priority ?? 'medium',
        subject: subjectEn.english,
        description: descriptionEn.english,
        sourceLanguage: lang,
        subjectOriginal: keepOriginal ? dto.subject : null,
        descriptionOriginal: keepOriginal ? dto.description : null,
        relatedOrderId: dto.relatedOrderId,
        relatedInvoiceId: dto.relatedInvoiceId,
        status: 'awaiting_reply',
        messages: {
          create: [
            {
              authorType: 'customer',
              authorId: customer.id,
              message: descriptionEn.english,
              sourceLanguage: lang,
              messageOriginal: keepOriginal ? dto.description : null,
            },
          ],
        },
      },
      include: TICKET_INCLUDE,
    });

    await this.auditService.record({
      eventType: 'support.ticket.created',
      sourceService: 'support-service',
      userId: customer.id,
      companyId: customer.companyId,
      entityType: 'support_ticket',
      entityId: ticket.id,
      action: 'create',
      newValue: { ticketNumber, category: dto.category, priority: ticket.priority },
    });

    return toTicketResource(ticket);
  }

  async replyAsCustomer(customer: AuthenticatedCustomer, id: string, dto: CreateTicketMessageDto, sourceLang = 'en') {
    const ticket = await this.findOrThrow(id);
    if (ticket.customerId !== customer.id) throw new NotFoundAppException('Support ticket not found.');
    if (ticket.status === 'closed') throw new ConflictAppException('This ticket is closed.');

    const lang = this.translation.resolveLang(sourceLang);
    const messageEn = this.translation.toEnglish(dto.message, lang);

    await this.prisma.$transaction([
      this.prisma.ticketMessage.create({
        data: {
          ticketId: id,
          authorType: 'customer',
          authorId: customer.id,
          message: messageEn.english,
          sourceLanguage: lang,
          messageOriginal: lang !== 'en' ? dto.message : null,
        },
      }),
      this.prisma.supportTicket.update({ where: { id }, data: { status: 'awaiting_reply' } }),
    ]);
    return this.getForCustomer(customer, id);
  }

  // ------------------------------- Staff-facing -------------------------------

  async listForStaff(user: AuthenticatedUser, page: number, pageSize: number, filters: { companyId?: string; status?: string }) {
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
      this.prisma.supportTicket.findMany({ where, include: TICKET_INCLUDE, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
      this.prisma.supportTicket.count({ where }),
    ]);
    return { items: rows.map(toTicketResource), page, pageSize, total };
  }

  async getForStaff(user: AuthenticatedUser, id: string) {
    const ticket = await this.findOrThrow(id);
    if (!isCompanyInScope(user, ticket.companyId, GROUP_PERM)) throw new NotFoundAppException('Support ticket not found.');
    return toTicketResource(ticket);
  }

  async replyAsStaff(user: AuthenticatedUser, id: string, dto: CreateTicketMessageDto) {
    const ticket = await this.findOrThrow(id);
    if (!isCompanyInScope(user, ticket.companyId, GROUP_PERM)) throw new NotFoundAppException('Support ticket not found.');
    if (!user.permissions.includes(MANAGE_PERM)) {
      throw new ForbiddenAppException(`Your role does not include the "${MANAGE_PERM}" permission required for this action.`);
    }
    if (ticket.status === 'closed') throw new ConflictAppException('This ticket is closed.');

    await this.prisma.ticketMessage.create({ data: { ticketId: id, authorType: 'staff', authorId: user.id, message: dto.message } });
    await this.auditService.record({
      eventType: 'support.ticket.replied',
      sourceService: 'support-service',
      userId: user.id,
      companyId: ticket.companyId,
      entityType: 'support_ticket',
      entityId: ticket.id,
      action: 'update',
      newValue: { message: dto.message },
    });
    return this.getForStaff(user, id);
  }

  async resolveAsStaff(user: AuthenticatedUser, id: string) {
    const ticket = await this.findOrThrow(id);
    if (!isCompanyInScope(user, ticket.companyId, GROUP_PERM)) throw new NotFoundAppException('Support ticket not found.');
    if (!user.permissions.includes(MANAGE_PERM)) {
      throw new ForbiddenAppException(`Your role does not include the "${MANAGE_PERM}" permission required for this action.`);
    }
    const updated = await this.prisma.supportTicket.update({ where: { id }, data: { status: 'resolved' }, include: TICKET_INCLUDE });
    await this.auditService.record({
      eventType: 'support.ticket.resolved',
      sourceService: 'support-service',
      userId: user.id,
      companyId: ticket.companyId,
      entityType: 'support_ticket',
      entityId: ticket.id,
      action: 'update',
      previousValue: { status: ticket.status },
      newValue: { status: 'resolved' },
    });
    return toTicketResource(updated);
  }

  private async findOrThrow(id: string) {
    const ticket = await this.prisma.supportTicket.findUnique({ where: { id }, include: TICKET_INCLUDE });
    if (!ticket) throw new NotFoundAppException('Support ticket not found.');
    return ticket;
  }
}
