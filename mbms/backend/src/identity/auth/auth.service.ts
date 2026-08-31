import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { generateOpaqueToken, hashToken } from './token.util';

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;
const RESET_EXPIRES_MINUTES = 30;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  // POST /api/v1/identity/auth/login — FR-AUTH-01 / AC-01
  async login(email: string, password: string, ip: string | undefined) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        userRoles: { include: { role: true } },
        scopes: true,
      },
    });

    // Same generic message whether the email doesn't exist or the password
    // is wrong — never leak which one it was.
    const invalidCredentials = () => new UnauthorizedException('Invalid email or password.');

    if (!user) throw invalidCredentials();

    if (user.status === 'locked' && user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException(
        `Account is temporarily locked until ${user.lockedUntil.toISOString()} after repeated failed attempts.`,
      );
    }

    const passwordOk = await bcrypt.compare(password, user.passwordHash);
    if (!passwordOk) {
      const attempts = user.failedLoginAttempts + 1;
      const shouldLock = attempts >= MAX_FAILED_ATTEMPTS;
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: attempts,
          status: shouldLock ? 'locked' : user.status,
          lockedUntil: shouldLock ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null,
        },
      });
      throw invalidCredentials();
    }

    if (user.status !== 'active') {
      throw new UnauthorizedException('Account is not active. Contact your administrator.');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });

    return this.issueTokens(user.id, user.email, ip);
  }

  // POST /api/v1/identity/auth/refresh — FR-AUTH-05
  async refresh(refreshToken: string, ip: string | undefined) {
    const tokenHash = hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findFirst({
      where: { tokenHash, revokedAt: null },
    });

    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token is invalid or has expired.');
    }

    // Rotate: revoke the used token, issue a fresh pair.
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const user = await this.prisma.user.findUnique({ where: { id: stored.userId } });
    if (!user || user.status !== 'active') {
      throw new UnauthorizedException('Account is not active.');
    }

    return this.issueTokens(user.id, user.email, ip);
  }

  // POST /api/v1/identity/auth/logout — FR-AUTH-02
  async logout(refreshToken: string) {
    const tokenHash = hashToken(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  // POST /api/v1/identity/auth/password-reset/request — FR-AUTH-03
  async requestPasswordReset(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    // Always behave the same way whether or not the email exists, so the
    // endpoint can't be used to enumerate registered accounts.
    if (!user) return;

    const token = generateOpaqueToken();
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + RESET_EXPIRES_MINUTES * 60_000),
      },
    });

    // No mail server is wired up in this Sprint 1+2 slice (morise.docx
    // Section 43/54 lists one for a later phase) — log instead so the flow
    // is demonstrable end-to-end locally.
    // eslint-disable-next-line no-console
    console.log(`[password-reset] token for ${email}: ${token} (expires in ${RESET_EXPIRES_MINUTES}m)`);
  }

  // POST /api/v1/identity/auth/password-reset/confirm — FR-AUTH-03, 04
  async confirmPasswordReset(token: string, newPassword: string) {
    const tokenHash = hashToken(token);
    const stored = await this.prisma.passwordResetToken.findFirst({
      where: { tokenHash, usedAt: null },
    });

    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Reset token is invalid or has expired.');
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: stored.userId },
        data: { passwordHash, failedLoginAttempts: 0, lockedUntil: null, status: 'active' },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: stored.id },
        data: { usedAt: new Date() },
      }),
      // Revoke every existing session on password reset.
      this.prisma.refreshToken.updateMany({
        where: { userId: stored.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }

  private async issueTokens(userId: string, email: string, _ip: string | undefined) {
    const full = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        userRoles: { include: { role: { include: { rolePermissions: { include: { permission: true } } } } } },
        userPermissions: { include: { permission: true } },
        scopes: true,
      },
    });

    // Effective permission codes (role permissions + direct grants), the
    // same set jwt.strategy re-derives per request. Returned to the client
    // so the Admin app can HIDE nav items and screens the user has not been
    // granted — "shouldn't even see them" — not just block them on submit.
    const permissions = Array.from(
      new Set([
        ...full.userRoles.flatMap((ur) => ur.role.rolePermissions.map((rp) => rp.permission.code)),
        ...full.userPermissions.map((up) => up.permission.code),
      ]),
    );

    const access_token = await this.jwt.signAsync({ sub: userId, email });

    const refreshTokenPlain = generateOpaqueToken();
    const refreshDays = Number(this.config.get('JWT_REFRESH_EXPIRES_IN_DAYS') ?? 7);
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: hashToken(refreshTokenPlain),
        expiresAt: new Date(Date.now() + refreshDays * 24 * 60 * 60_000),
      },
    });

    return {
      access_token,
      refresh_token: refreshTokenPlain,
      expires_in: parseExpiresInSeconds(this.config.get<string>('JWT_ACCESS_EXPIRES_IN') ?? '900s'),
      user: {
        id: full.id,
        email: full.email,
        first_name: full.firstName,
        last_name: full.lastName,
        roles: full.userRoles.map((ur) => ur.role.name),
        permissions,
        scopes: full.scopes.map((s) => ({ company_id: s.companyId, branch_id: s.branchId })),
      },
    };
  }
}

function parseExpiresInSeconds(expr: string): number {
  const match = /^(\d+)s$/.exec(expr);
  return match ? Number(match[1]) : 900;
}
