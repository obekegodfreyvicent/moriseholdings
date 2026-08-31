import { ConflictException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { ContentTranslationService } from '../../common/translation/content-translation.service';
import { generateOpaqueToken, hashToken } from '../../identity/auth/token.util';
import {
  CustomerRegisterDto,
  ForgotPasswordDto,
  GoogleSignInDto,
  ResetPasswordDto,
} from './dto/customer-self-service.dto';

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;
const RESET_TOKEN_MINUTES = 30;
// Starter terms for a self-registered / Google account until staff review it
// in the CRM.
const STARTER_CREDIT_LIMIT = 1_000_000;
const STARTER_PAYMENT_TERMS_DAYS = 14;

const onlyDigits = (s: string) => s.replace(/[^\d]/g, '');
const isDevReset = () => (process.env.NODE_ENV ?? 'development') !== 'production';

/**
 * Customer portal auth (Sprint 16, extended 29 August 2026 for self-service).
 *
 * Login accepts an **email, phone number or account number**. Customers can
 * **sign up** themselves (an active account with starter credit terms) and
 * **sign in with Google**. A **password reset** flow issues a one-time token;
 * with no SMTP/SMS in this build the plain token is returned to the caller in
 * dev (documented seam — a real deployment emails / SMSes a link), the same
 * honest gap already noted for the payment gateway and in-app-only
 * notifications.
 */
@Injectable()
export class CustomerAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
    private readonly translation: ContentTranslationService,
  ) {}

  // --------------------------------- login ---------------------------------

  async login(identifier: string, password: string) {
    const customer = await this.findByIdentifier(identifier);

    const invalidCredentials = () => new UnauthorizedException('Invalid email, phone or account number, or password.');
    if (!customer || !customer.passwordHash) throw invalidCredentials();

    if (customer.lockedUntil && customer.lockedUntil > new Date()) {
      throw new UnauthorizedException(
        `Account is temporarily locked until ${customer.lockedUntil.toISOString()} after repeated failed attempts.`,
      );
    }

    const passwordOk = await bcrypt.compare(password, customer.passwordHash);
    if (!passwordOk) {
      const attempts = customer.failedLoginAttempts + 1;
      const shouldLock = attempts >= MAX_FAILED_ATTEMPTS;
      await this.prisma.customer.update({
        where: { id: customer.id },
        data: {
          failedLoginAttempts: attempts,
          lockedUntil: shouldLock ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null,
        },
      });
      throw invalidCredentials();
    }

    if (customer.status !== 'active') {
      throw new UnauthorizedException('This account is not active. Contact Morise Holdings to reactivate it.');
    }

    await this.prisma.customer.update({
      where: { id: customer.id },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });

    return this.issueTokens(customer.id);
  }

  /** email | account number | phone (phone matched with formatting ignored). */
  private async findByIdentifier(identifierRaw: string) {
    const id = identifierRaw.trim();
    let customer = await this.prisma.customer.findFirst({
      where: { OR: [{ contactEmail: id }, { accountNumber: id }, { contactPhone: id }] },
    });
    if (customer) return customer;

    const digits = onlyDigits(id);
    if (digits.length >= 7) {
      // Match on the national significant number (last 9 digits for Uganda),
      // so "+256 701 234 567", "0701234567" and "701234567" all resolve to
      // the same account.
      const tail = digits.slice(-9);
      const candidates = await this.prisma.customer.findMany({
        where: { contactPhone: { not: null } },
        select: { id: true, contactPhone: true },
      });
      const match = candidates.find((c) => {
        const d = onlyDigits(c.contactPhone as string);
        return d === digits || (d.length >= 9 && d.slice(-9) === tail);
      });
      if (match) customer = await this.prisma.customer.findUnique({ where: { id: match.id } });
    }
    return customer;
  }

  // ------------------------------- register -------------------------------

  async register(dto: CustomerRegisterDto, sourceLang = 'en') {
    const email = dto.contactEmail.trim().toLowerCase();
    // Content localisation (29 August 2026): the business name and phone are
    // customer-typed, so store them canonically — English words, 0-9 digits —
    // keeping the source language + original wording, exactly as delivery
    // addresses and support tickets already do.
    const lang = this.translation.resolveLang(sourceLang);
    const keep = lang !== 'en';
    const nameEnglish = this.translation.toEnglish(dto.name.trim(), lang).english || dto.name.trim();
    const phoneRaw = dto.contactPhone?.trim() || null;
    const phone = phoneRaw ? this.translation.toEnglish(phoneRaw, lang).english : null;

    const company = await this.prisma.company.findUnique({ where: { id: dto.companyId } });
    if (!company || company.status !== 'active') {
      throw new NotFoundException('That company is not available for a customer account.');
    }

    // Storefront group catalogue (29 August 2026): an optional home branch,
    // which must belong to the selling company the customer is registering
    // with.
    let homeBranchId: string | null = null;
    if (dto.homeBranchId) {
      const branch = await this.prisma.branch.findUnique({ where: { id: dto.homeBranchId } });
      if (!branch || branch.companyId !== dto.companyId || branch.status !== 'active') {
        throw new NotFoundException('That branch is not available for the selected company.');
      }
      homeBranchId = branch.id;
    }

    const existing = await this.prisma.customer.findFirst({
      where: {
        OR: [{ contactEmail: email }, ...(phone ? [{ contactPhone: phone }] : [])],
        passwordHash: { not: null },
      },
    });
    if (existing) {
      throw new ConflictException('An account with that email or phone already exists. Try signing in or resetting your password.');
    }

    const accountNumber = await this.nextAccountNumber();
    const passwordHash = await bcrypt.hash(dto.password, 12);

    const customer = await this.prisma.customer.create({
      data: {
        companyId: dto.companyId,
        name: nameEnglish,
        nameOriginal: keep && dto.name.trim() !== nameEnglish ? dto.name.trim() : null,
        sourceLanguage: lang,
        category: 'Self-registered',
        contactEmail: email,
        contactPhone: phone,
        accountNumber,
        passwordHash,
        homeBranchId,
        creditLimit: STARTER_CREDIT_LIMIT,
        paymentTermsDays: STARTER_PAYMENT_TERMS_DAYS,
        status: 'active',
        selfRegistered: true,
      },
    });
    await this.audit.record({
      eventType: 'customer.self_registered',
      sourceService: 'customer-auth-service',
      userId: null,
      companyId: dto.companyId,
      entityType: 'customer',
      entityId: customer.id,
      action: 'create',
      newValue: { name: customer.name, accountNumber, via: 'password' },
    });
    return this.issueTokens(customer.id);
  }

  // ---------------------------- google sign-in ----------------------------

  async googleSignIn(dto: GoogleSignInDto) {
    // Production: `dto` is derived from a verified Google ID token. This build
    // trusts the email the "Continue with Google" button sends (seam).
    const email = dto.email.trim().toLowerCase();

    let customer = await this.prisma.customer.findFirst({ where: { contactEmail: email } });

    if (customer) {
      if (customer.status !== 'active') {
        throw new UnauthorizedException('This account is not active. Contact Morise Holdings to reactivate it.');
      }
      if (!customer.googleLinked) {
        await this.prisma.customer.update({ where: { id: customer.id }, data: { googleLinked: true } });
      }
      await this.audit.record({
        eventType: 'customer.google_signin',
        sourceService: 'customer-auth-service',
        companyId: customer.companyId,
        entityType: 'customer',
        entityId: customer.id,
        action: 'update',
        newValue: { email, event: 'google_signin' },
      });
      return this.issueTokens(customer.id);
    }

    // Auto-register a new Google account.
    const companyId = dto.companyId ?? (await this.defaultStorefrontCompanyId());
    const accountNumber = await this.nextAccountNumber();
    customer = await this.prisma.customer.create({
      data: {
        companyId,
        name: dto.name?.trim() || email.split('@')[0],
        category: 'Self-registered',
        contactEmail: email,
        accountNumber,
        creditLimit: STARTER_CREDIT_LIMIT,
        paymentTermsDays: STARTER_PAYMENT_TERMS_DAYS,
        status: 'active',
        selfRegistered: true,
        googleLinked: true,
      },
    });
    await this.audit.record({
      eventType: 'customer.self_registered',
      sourceService: 'customer-auth-service',
      companyId,
      entityType: 'customer',
      entityId: customer.id,
      action: 'create',
      newValue: { name: customer.name, accountNumber, via: 'google' },
    });
    return this.issueTokens(customer.id);
  }

  // --------------------------- password reset ---------------------------

  async forgotPassword(dto: ForgotPasswordDto) {
    const customer = await this.findByIdentifier(dto.identifier);
    // Always answer the same way — don't reveal whether an account exists.
    const base: { message: string; devResetToken?: string } = {
      message: 'If an account matches that email, phone or account number, a password-reset link has been sent.',
    };
    if (!customer) return base;

    const plain = generateOpaqueToken();
    await this.prisma.$transaction([
      this.prisma.customerPasswordResetToken.updateMany({
        where: { customerId: customer.id, usedAt: null },
        data: { usedAt: new Date() },
      }),
      this.prisma.customerPasswordResetToken.create({
        data: {
          customerId: customer.id,
          tokenHash: hashToken(plain),
          expiresAt: new Date(Date.now() + RESET_TOKEN_MINUTES * 60_000),
        },
      }),
    ]);
    await this.audit.record({
      eventType: 'customer.password_reset_requested',
      sourceService: 'customer-auth-service',
      companyId: customer.companyId,
      entityType: 'customer',
      entityId: customer.id,
      action: 'update',
      newValue: { via: dto.identifier.includes('@') ? 'email' : 'identifier' },
    });

    // Seam: with no SMTP/SMS the token is handed back directly in dev so the
    // flow is testable end to end. A real deployment sends a link instead.
    if (isDevReset()) base.devResetToken = plain;
    return base;
  }

  async resetPassword(dto: ResetPasswordDto) {
    const row = await this.prisma.customerPasswordResetToken.findFirst({
      where: { tokenHash: hashToken(dto.token), usedAt: null },
    });
    if (!row || row.expiresAt < new Date()) {
      throw new UnauthorizedException('This reset link is invalid or has expired. Request a new one.');
    }
    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.$transaction([
      this.prisma.customer.update({
        where: { id: row.customerId },
        data: { passwordHash, failedLoginAttempts: 0, lockedUntil: null },
      }),
      this.prisma.customerPasswordResetToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
      this.prisma.customerPasswordResetToken.updateMany({
        where: { customerId: row.customerId, usedAt: null },
        data: { usedAt: new Date() },
      }),
      this.prisma.customerRefreshToken.updateMany({
        where: { customerId: row.customerId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    const customer = await this.prisma.customer.findUnique({ where: { id: row.customerId } });
    await this.audit.record({
      eventType: 'customer.password_reset_completed',
      sourceService: 'customer-auth-service',
      companyId: customer?.companyId ?? null,
      entityType: 'customer',
      entityId: row.customerId,
      action: 'update',
      newValue: {},
    });
    return { message: 'Your password has been reset. Sign in with your new password.' };
  }

  // ---------------------------- companies list ----------------------------

  /** Public: the Morise companies a customer can open an account with. */
  async registrableCompanies() {
    const companies = await this.prisma.company.findMany({
      where: { status: 'active' },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
    const withCatalogue = await this.prisma.product.groupBy({
      by: ['companyId'],
      where: { unitPrice: { not: null }, status: 'active' },
      _count: { _all: true },
    });
    const sellerIds = new Set(withCatalogue.map((r) => r.companyId));
    const sellers = companies.filter((c) => sellerIds.has(c.id));
    return (sellers.length ? sellers : companies).map((c) => ({ id: c.id, name: c.name }));
  }

  /** Public: the active branches of one registrable company, for the
   *  optional "home branch" picker on the sign-up form. */
  async registrableBranches(companyId: string) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company || company.status !== 'active') return [];
    const branches = await this.prisma.branch.findMany({
      where: { companyId, status: 'active' },
      select: { id: true, name: true, address: true },
      orderBy: { name: 'asc' },
    });
    return branches;
  }

  private async defaultStorefrontCompanyId() {
    const list = await this.registrableCompanies();
    if (list.length === 0) throw new NotFoundException('No company is available for a customer account.');
    return list[0].id;
  }

  private async nextAccountNumber() {
    const rows = await this.prisma.customer.findMany({
      where: { accountNumber: { startsWith: 'CUST-' } },
      select: { accountNumber: true },
    });
    const max = rows.reduce((m, r) => {
      const n = Number((r.accountNumber ?? '').replace('CUST-', ''));
      return Number.isFinite(n) && n > m ? n : m;
    }, 0);
    return `CUST-${String(max + 1).padStart(4, '0')}`;
  }

  // ------------------------------- refresh -------------------------------

  async refresh(refreshToken: string) {
    const tokenHash = hashToken(refreshToken);
    const stored = await this.prisma.customerRefreshToken.findFirst({ where: { tokenHash, revokedAt: null } });
    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token is invalid or has expired.');
    }

    await this.prisma.customerRefreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });

    const customer = await this.prisma.customer.findUnique({ where: { id: stored.customerId } });
    if (!customer || customer.status !== 'active') {
      throw new UnauthorizedException('This account is not active.');
    }
    return this.issueTokens(customer.id);
  }

  async logout(refreshToken: string) {
    const tokenHash = hashToken(refreshToken);
    await this.prisma.customerRefreshToken.updateMany({ where: { tokenHash, revokedAt: null }, data: { revokedAt: new Date() } });
  }

  private async issueTokens(customerId: string) {
    const customer = await this.prisma.customer.findUniqueOrThrow({
      where: { id: customerId },
      include: { homeBranch: { select: { name: true } } },
    });
    const company = await this.prisma.company.findUnique({ where: { id: customer.companyId }, select: { name: true } });
    const access_token = await this.jwt.signAsync({ sub: customer.id });

    const refreshTokenPlain = generateOpaqueToken();
    const refreshDays = Number(this.config.get('JWT_CUSTOMER_REFRESH_EXPIRES_IN_DAYS') ?? 7);
    await this.prisma.customerRefreshToken.create({
      data: {
        customerId: customer.id,
        tokenHash: hashToken(refreshTokenPlain),
        expiresAt: new Date(Date.now() + refreshDays * 24 * 60 * 60_000),
      },
    });

    return {
      access_token,
      refresh_token: refreshTokenPlain,
      expires_in: parseExpiresInSeconds(this.config.get<string>('JWT_CUSTOMER_ACCESS_EXPIRES_IN') ?? '900s'),
      customer: {
        id: customer.id,
        companyId: customer.companyId,
        companyName: company?.name ?? null,
        homeBranchId: customer.homeBranchId ?? null,
        homeBranchName: (customer as any).homeBranch?.name ?? null,
        name: customer.name,
        accountNumber: customer.accountNumber,
        contactEmail: customer.contactEmail,
      },
    };
  }
}

function parseExpiresInSeconds(expr: string): number {
  const match = /^(\d+)s$/.exec(expr);
  return match ? Number(match[1]) : 900;
}
