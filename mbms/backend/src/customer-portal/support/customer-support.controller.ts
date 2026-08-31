import { Body, Controller, Get, Headers, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { CustomerJwtAuthGuard } from '../common/customer-jwt-auth.guard';
import { CurrentCustomer } from '../common/current-customer.decorator';
import { AuthenticatedCustomer } from '../common/customer-auth.types';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { SupportService } from '../../support/support.service';
import { CreateTicketDto } from '../../support/dto/create-ticket.dto';
import { CreateTicketMessageDto } from '../../support/dto/create-ticket-message.dto';
import { ContentTranslationService } from '../../common/translation/content-translation.service';

// Base path /api/v1/customer-portal/support-tickets.
//
// Content localisation (27 August 2026): the customer sees ticket text in the
// language they are browsing in — their own wording verbatim where they typed
// it, and staff replies glossary-translated as far as the catalogue reaches.
// Text the customer submits is normalised to English by SupportService before
// it is stored (see support.service.ts).
@Controller('customer-portal/support-tickets')
@UseGuards(CustomerJwtAuthGuard)
export class CustomerSupportController {
  constructor(
    private readonly supportService: SupportService,
    private readonly translation: ContentTranslationService,
  ) {}

  private localiseTicket(t: any, lang: string) {
    if (lang === 'en' || !t) return this.stripOriginals(t);
    // Show the customer their own wording verbatim only when they are
    // browsing in the language they wrote it in; otherwise glossary-translate
    // the stored English into the requested language.
    const own = t.sourceLanguage === lang;
    const out = {
      ...t,
      subject: own && t.subjectOriginal != null ? t.subjectOriginal : this.translation.toLocale(t.subject, lang),
      description:
        own && t.descriptionOriginal != null ? t.descriptionOriginal : this.translation.toLocale(t.description, lang),
      messages: Array.isArray(t.messages)
        ? t.messages.map((m: any) => ({
            ...m,
            message:
              m.authorType === 'customer' && m.sourceLanguage === lang && m.messageOriginal != null
                ? m.messageOriginal
                : this.translation.toLocale(m.message, lang),
          }))
        : t.messages,
    };
    return this.stripOriginals(out);
  }

  // The *_original / sourceLanguage columns are for staff (the admin "show
  // original" view); the customer response doesn't carry them.
  private stripOriginals(t: any) {
    if (!t) return t;
    const { subjectOriginal, descriptionOriginal, sourceLanguage, ...rest } = t;
    if (Array.isArray(rest.messages)) {
      rest.messages = rest.messages.map((m: any) => {
        const { messageOriginal, sourceLanguage: _s, ...mrest } = m;
        return mrest;
      });
    }
    return rest;
  }

  @Get()
  async list(
    @CurrentCustomer() customer: AuthenticatedCustomer,
    @Query() query: PaginationQueryDto,
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    const lang = this.translation.resolveLang(acceptLanguage);
    const page = await this.supportService.listForCustomer(customer, query.page, query.pageSize);
    return { ...page, items: page.items.map((t: any) => this.localiseTicket(t, lang)) };
  }

  @Post()
  async create(
    @CurrentCustomer() customer: AuthenticatedCustomer,
    @Body() dto: CreateTicketDto,
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    const lang = this.translation.resolveLang(acceptLanguage);
    const ticket = await this.supportService.createForCustomer(customer, dto, lang);
    return this.localiseTicket(ticket, lang);
  }

  @Get(':id')
  async get(
    @CurrentCustomer() customer: AuthenticatedCustomer,
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    const lang = this.translation.resolveLang(acceptLanguage);
    const ticket = await this.supportService.getForCustomer(customer, id);
    return this.localiseTicket(ticket, lang);
  }

  @Post(':id/messages')
  async reply(
    @CurrentCustomer() customer: AuthenticatedCustomer,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateTicketMessageDto,
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    const lang = this.translation.resolveLang(acceptLanguage);
    const ticket = await this.supportService.replyAsCustomer(customer, id, dto, lang);
    return this.localiseTicket(ticket, lang);
  }
}
