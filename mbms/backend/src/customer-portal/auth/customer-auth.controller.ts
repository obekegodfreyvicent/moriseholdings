import { Body, Controller, Get, Headers, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CustomerAuthService } from './customer-auth.service';
import { ContentTranslationService } from '../../common/translation/content-translation.service';
import { CustomerLoginDto } from './dto/customer-login.dto';
import { CustomerRefreshDto } from './dto/customer-refresh.dto';
import {
  CustomerRegisterDto,
  ForgotPasswordDto,
  GoogleSignInDto,
  ResetPasswordDto,
} from './dto/customer-self-service.dto';

// Base path /api/v1/customer-portal/auth.
@Controller('customer-portal/auth')
export class CustomerAuthController {
  constructor(
    private readonly customerAuthService: CustomerAuthService,
    private readonly translation: ContentTranslationService,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } }) // SEC-05 convention, applied here too.
  login(@Body() dto: CustomerLoginDto) {
    return this.customerAuthService.login(dto.identifier, dto.password);
  }

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  register(@Body() dto: CustomerRegisterDto, @Headers('accept-language') acceptLanguage?: string) {
    return this.customerAuthService.register(dto, this.translation.resolveLang(acceptLanguage));
  }

  @Post('google')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  google(@Body() dto: GoogleSignInDto) {
    return this.customerAuthService.googleSignIn(dto);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.customerAuthService.forgotPassword(dto);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.customerAuthService.resetPassword(dto);
  }

  @Get('companies')
  companies() {
    return this.customerAuthService.registrableCompanies();
  }

  @Get('branches')
  branches(@Query('companyId') companyId: string) {
    return this.customerAuthService.registrableBranches(companyId);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Body() dto: CustomerRefreshDto) {
    await this.customerAuthService.logout(dto.refresh_token);
    return { message: 'Logged out.' };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: CustomerRefreshDto) {
    return this.customerAuthService.refresh(dto.refresh_token);
  }
}
