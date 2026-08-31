import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedCustomer, CustomerJwtPayload } from './customer-auth.types';

// Registered under the Passport strategy name 'customer-jwt' (the second
// constructor arg), kept structurally separate from the staff 'jwt'
// strategy — see CustomerJwtAuthGuard.
@Injectable()
export class CustomerJwtStrategy extends PassportStrategy(Strategy, 'customer-jwt') {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_CUSTOMER_ACCESS_SECRET'),
    });
  }

  // Re-validated against the database on every request, same discipline as
  // JwtStrategy — a status change (e.g. an admin deactivating the account)
  // takes effect immediately, not just at next login.
  async validate(payload: CustomerJwtPayload): Promise<AuthenticatedCustomer> {
    const customer = await this.prisma.customer.findUnique({ where: { id: payload.sub } });
    if (!customer || customer.status !== 'active' || !customer.passwordHash) {
      throw new UnauthorizedException('Account is not active.');
    }
    return {
      id: customer.id,
      companyId: customer.companyId,
      name: customer.name,
      accountNumber: customer.accountNumber,
      contactEmail: customer.contactEmail,
    };
  }
}
