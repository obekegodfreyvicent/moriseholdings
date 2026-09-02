import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/strategies/jwt.strategy';
import { ExecutiveService } from './executive.service';

// Base path /api/v1/executive — the Final System Objective. Answers the
// group-management questions the specification closes with, filtered to the
// caller's company scope (BR-01). Any authenticated user; a Group role gets
// the whole group, a subsidiary-scoped user gets only their companies.
@Controller('executive')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ExecutiveController {
  constructor(private readonly executive: ExecutiveService) {}

  @Get('questions')
  questions(@CurrentUser() user: AuthenticatedUser) {
    return this.executive.questions(user);
  }

  @Get('overview')
  overview(@CurrentUser() user: AuthenticatedUser) {
    return this.executive.overview(user);
  }
}
