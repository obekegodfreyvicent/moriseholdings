import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/strategies/jwt.strategy';
import { FleetService } from './fleet.service';
import {
  AssignDriverDto,
  CreateAccidentDto,
  CreateRenewalDto,
  CreateServiceRecordDto,
  CreateServiceScheduleDto,
  CreateVehicleDto,
  CreateVehicleExpenseDto,
  EndAssignmentDto,
  LogFuelDto,
  LogLocationDto,
  LogOdometerDto,
  UpdateAccidentDto,
  UpdateServiceScheduleDto,
  UpdateVehicleDto,
} from './dto/fleet.dto';

// Base path /api/v1/fleet — Fleet & Vehicle Management (2 September 2026).
// Reads scoped per BR-01 (fleet.viewAll for group-wide); writes gated by
// fleet.manage.
@Controller('fleet')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class FleetController {
  constructor(private readonly fleet: FleetService) {}

  // ---- Reports (before /vehicles/:id) --------------------------
  @Get('reports/fleet-register')
  reportFleetRegister(@CurrentUser() user: AuthenticatedUser, @Query('companyId') companyId?: string) {
    return this.fleet.reportFleetRegister(user, companyId || undefined);
  }

  @Get('reports/fuel-consumption')
  reportFuelConsumption(
    @CurrentUser() user: AuthenticatedUser,
    @Query('companyId') companyId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.fleet.reportFuelConsumption(user, { companyId: companyId || undefined, from: from || undefined, to: to || undefined });
  }

  @Get('reports/expenses')
  reportExpenses(
    @CurrentUser() user: AuthenticatedUser,
    @Query('companyId') companyId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.fleet.reportExpenses(user, { companyId: companyId || undefined, from: from || undefined, to: to || undefined });
  }

  @Get('reports/renewals-due')
  reportRenewalsDue(
    @CurrentUser() user: AuthenticatedUser,
    @Query('companyId') companyId?: string,
    @Query('days') days?: string,
  ) {
    return this.fleet.reportRenewalsDue(user, companyId || undefined, days ? Number(days) : undefined);
  }

  @Get('reports/service-due')
  reportServiceDue(@CurrentUser() user: AuthenticatedUser, @Query('companyId') companyId?: string) {
    return this.fleet.reportServiceDue(user, companyId || undefined);
  }

  // ---- by-id sub-resource actions ---------------------------
  @Post('assignments/:assignmentId/end')
  @RequirePermission('fleet.manage')
  endAssignment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
    @Body() dto: EndAssignmentDto,
  ) {
    return this.fleet.endAssignment(user, assignmentId, dto);
  }

  @Patch('service-schedules/:scheduleId')
  @RequirePermission('fleet.manage')
  updateSchedule(
    @CurrentUser() user: AuthenticatedUser,
    @Param('scheduleId', ParseUUIDPipe) scheduleId: string,
    @Body() dto: UpdateServiceScheduleDto,
  ) {
    return this.fleet.updateSchedule(user, scheduleId, dto);
  }

  @Patch('accidents/:accidentId')
  @RequirePermission('fleet.manage')
  updateAccident(
    @CurrentUser() user: AuthenticatedUser,
    @Param('accidentId', ParseUUIDPipe) accidentId: string,
    @Body() dto: UpdateAccidentDto,
  ) {
    return this.fleet.updateAccident(user, accidentId, dto);
  }

  // ---- Vehicles --------------------------------------------
  @Get('vehicles')
  listVehicles(
    @CurrentUser() user: AuthenticatedUser,
    @Query('companyId') companyId?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.fleet.listVehicles(user, { companyId: companyId || undefined, status: status || undefined, search: search || undefined });
  }

  @Post('vehicles')
  @RequirePermission('fleet.manage')
  createVehicle(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateVehicleDto) {
    return this.fleet.createVehicle(user, dto);
  }

  @Get('vehicles/:id')
  getVehicle(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.fleet.getVehicle(user, id);
  }

  @Patch('vehicles/:id')
  @RequirePermission('fleet.manage')
  updateVehicle(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateVehicleDto) {
    return this.fleet.updateVehicle(user, id, dto);
  }

  @Get('vehicles/:id/summary')
  summary(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.fleet.summary(user, id);
  }

  @Post('vehicles/:id/location')
  @RequirePermission('fleet.manage')
  logLocation(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: LogLocationDto) {
    return this.fleet.logLocation(user, id, dto);
  }

  // driver assignments
  @Get('vehicles/:id/assignments')
  listAssignments(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.fleet.listAssignments(user, id);
  }

  @Post('vehicles/:id/assignments')
  @RequirePermission('fleet.manage')
  assignDriver(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AssignDriverDto) {
    return this.fleet.assignDriver(user, id, dto);
  }

  // odometer
  @Get('vehicles/:id/odometer')
  listOdometer(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.fleet.listOdometer(user, id);
  }

  @Post('vehicles/:id/odometer')
  @RequirePermission('fleet.manage')
  logOdometer(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: LogOdometerDto) {
    return this.fleet.logOdometer(user, id, dto);
  }

  // fuel
  @Get('vehicles/:id/fuel')
  listFuel(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.fleet.listFuel(user, id);
  }

  @Post('vehicles/:id/fuel')
  @RequirePermission('fleet.manage')
  logFuel(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: LogFuelDto) {
    return this.fleet.logFuel(user, id, dto);
  }

  // service schedules
  @Get('vehicles/:id/service-schedules')
  listSchedules(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.fleet.listSchedules(user, id);
  }

  @Post('vehicles/:id/service-schedules')
  @RequirePermission('fleet.manage')
  createSchedule(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateServiceScheduleDto) {
    return this.fleet.createSchedule(user, id, dto);
  }

  // service records (service + repair)
  @Get('vehicles/:id/service-records')
  listServiceRecords(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.fleet.listServiceRecords(user, id);
  }

  @Post('vehicles/:id/service-records')
  @RequirePermission('fleet.manage')
  addServiceRecord(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateServiceRecordDto) {
    return this.fleet.addServiceRecord(user, id, dto);
  }

  // renewals
  @Get('vehicles/:id/renewals')
  listRenewals(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.fleet.listRenewals(user, id);
  }

  @Post('vehicles/:id/renewals')
  @RequirePermission('fleet.manage')
  addRenewal(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateRenewalDto) {
    return this.fleet.addRenewal(user, id, dto);
  }

  // accidents
  @Get('vehicles/:id/accidents')
  listAccidents(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.fleet.listAccidents(user, id);
  }

  @Post('vehicles/:id/accidents')
  @RequirePermission('fleet.manage')
  addAccident(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateAccidentDto) {
    return this.fleet.addAccident(user, id, dto);
  }

  // expenses
  @Get('vehicles/:id/expenses')
  listExpenses(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.fleet.listExpenses(user, id);
  }

  @Post('vehicles/:id/expenses')
  @RequirePermission('fleet.manage')
  addExpense(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateVehicleExpenseDto) {
    return this.fleet.addExpense(user, id, dto);
  }
}
