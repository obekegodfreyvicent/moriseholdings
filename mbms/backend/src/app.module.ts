import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { AuditModule } from './common/audit/audit.module';
import { TranslationModule } from './common/translation/translation.module';
import { AuditTrailModule } from './audit/audit-trail.module';
import { NotificationsCoreModule } from './common/notifications/notifications.module';
import { NotificationsModule } from './notifications/notifications.module';
import { IdentityModule } from './identity/identity.module';
import { OrganizationModule } from './organization/organization.module';
import { EmployeesModule } from './employees/employees.module';
import { StaffIdCardsModule } from './staff-id-cards/staff-id-cards.module';
import { CustomersModule } from './customers/customers.module';
import { SuppliersModule } from './suppliers/suppliers.module';
import { ProductsModule } from './products/products.module';
import { InventoryModule } from './inventory/inventory.module';
import { MarketingModule } from './marketing/marketing.module';
import { CmsModule } from './cms/cms.module';
import { SocialPublishingModule } from './social-publishing/social-publishing.module';
import { AccountingModule } from './accounting/accounting.module';
import { ExpensesModule } from './expenses/expenses.module';
import { AssetsModule } from './assets/assets.module';
import { FleetModule } from './fleet/fleet.module';
import { AlertsModule } from './alerts/alerts.module';
import { ExecutiveModule } from './executive/executive.module';
import { ProjectsModule } from './projects/projects.module';
import { ReportsModule } from './reports/reports.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { HrDashboardModule } from './hr-dashboard/hr-dashboard.module';
import { ShiftSchedulingModule } from './shift-scheduling/shift-scheduling.module';
import { PayrollModule } from './payroll/payroll.module';
import { MyHrModule } from './my-hr/my-hr.module';
import { FinanceModule } from './finance/finance.module';
import { RecruitmentModule } from './recruitment/recruitment.module';
import { AttendanceModule } from './attendance/attendance.module';
import { LeaveModule } from './leave/leave.module';
import { PerformanceModule } from './performance/performance.module';
import { AccountsReceivableModule } from './accounts-receivable/accounts-receivable.module';
import { AccountsPayableModule } from './accounts-payable/accounts-payable.module';
import { SalesModule } from './sales/sales.module';
import { DeliveryModule } from './delivery/delivery.module';
import { SupportModule } from './support/support.module';
import { CustomerPortalModule } from './customer-portal/customer-portal.module';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 300 }], // generous global default; SEC-05 routes override with @Throttle
    }),
    PrismaModule,
    AuditModule,
    TranslationModule,
    AuditTrailModule,
    NotificationsCoreModule,
    NotificationsModule,
    IdentityModule,
    OrganizationModule,
    EmployeesModule,
    StaffIdCardsModule,
    CustomersModule,
    SuppliersModule,
    ProductsModule,
    InventoryModule,
    MarketingModule,
    CmsModule,
    SocialPublishingModule,
    AccountingModule,
    ExpensesModule,
    AssetsModule,
    FleetModule,
    AlertsModule,
    ExecutiveModule,
    ProjectsModule,
    ReportsModule,
    DashboardModule,
    HrDashboardModule,
    ShiftSchedulingModule,
    PayrollModule,
    MyHrModule,
    FinanceModule,
    RecruitmentModule,
    AttendanceModule,
    LeaveModule,
    PerformanceModule,
    AccountsReceivableModule,
    AccountsPayableModule,
    SalesModule,
    DeliveryModule,
    SupportModule,
    CustomerPortalModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
  ],
})
export class AppModule {}
