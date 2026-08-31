import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { CustomerAuthController } from './customer-auth.controller';
import { CustomerAuthService } from './customer-auth.service';
import { CustomerJwtStrategy } from '../common/customer-jwt.strategy';

// Registers its own JwtModule instance (module-scoped, not global — same
// as identity/auth/auth.module.ts's own registration) so this module's
// JwtService always signs with JWT_CUSTOMER_ACCESS_SECRET, never the staff
// secret, even though both modules use the same @nestjs/jwt package.
@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_CUSTOMER_ACCESS_SECRET'),
        signOptions: { expiresIn: config.get<string>('JWT_CUSTOMER_ACCESS_EXPIRES_IN') ?? '900s' },
      }),
    }),
  ],
  controllers: [CustomerAuthController],
  providers: [CustomerAuthService, CustomerJwtStrategy],
  exports: [CustomerAuthService],
})
export class CustomerAuthModule {}
