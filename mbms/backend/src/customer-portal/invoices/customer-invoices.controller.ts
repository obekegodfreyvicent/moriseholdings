import { Controller, Get, Headers, Param, ParseUUIDPipe, Query, Res, UseGuards } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { CustomerJwtAuthGuard } from '../common/customer-jwt-auth.guard';
import { CurrentCustomer } from '../common/current-customer.decorator';
import { AuthenticatedCustomer } from '../common/customer-auth.types';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { InvoicesService } from '../../sales/invoices.service';
import { ContentTranslationService } from '../../common/translation/content-translation.service';

// Base path /api/v1/customer-portal/invoices.
//
// Content localisation (30 August 2026): the account statement and the
// statement / invoice PDFs honour Accept-Language — row types and the
// document labels are rendered in the customer's language (Latin scripts +
// digit transliteration; a non-Latin script falls back to English text —
// PDFKit built-in font limitation). The invoice list / detail carry only
// codes, amounts and a computed status, so they are language-neutral.
@Controller('customer-portal/invoices')
@UseGuards(CustomerJwtAuthGuard)
export class CustomerInvoicesController {
  constructor(
    private readonly invoicesService: InvoicesService,
    private readonly translation: ContentTranslationService,
  ) {}

  @Get()
  list(@CurrentCustomer() customer: AuthenticatedCustomer, @Query() query: PaginationQueryDto, @Query('filter[status]') status?: string) {
    return this.invoicesService.listForCustomer(customer, query.page, query.pageSize, { status });
  }

  @Get('summary')
  summary(@CurrentCustomer() customer: AuthenticatedCustomer) {
    return this.invoicesService.summaryForCustomer(customer);
  }

  @Get('statement')
  statement(
    @CurrentCustomer() customer: AuthenticatedCustomer,
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    return this.invoicesService.statementForCustomer(customer, this.translation.resolveLang(acceptLanguage));
  }

  @Get('statement/pdf')
  async statementPdf(
    @CurrentCustomer() customer: AuthenticatedCustomer,
    @Res({ passthrough: false }) reply: FastifyReply,
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    const buffer = await this.invoicesService.statementPdfForCustomer(
      customer,
      this.translation.resolveLang(acceptLanguage),
    );
    reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', 'attachment; filename="account-statement.pdf"')
      .send(buffer);
  }

  @Get(':id')
  get(@CurrentCustomer() customer: AuthenticatedCustomer, @Param('id', ParseUUIDPipe) id: string) {
    return this.invoicesService.getForCustomer(customer, id);
  }

  @Get(':id/pdf')
  async invoicePdf(
    @CurrentCustomer() customer: AuthenticatedCustomer,
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: false }) reply: FastifyReply,
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    const invoice = await this.invoicesService.getForCustomer(customer, id);
    const buffer = await this.invoicesService.invoicePdfForCustomer(
      customer,
      id,
      this.translation.resolveLang(acceptLanguage),
    );
    reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', `attachment; filename="${invoice.invoiceNumber}.pdf"`)
      .send(buffer);
  }
}
