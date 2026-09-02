import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './lib/auth';
import { RequireAuth } from './components/RequireAuth';
import { LoginPage } from './pages/Login';
import { DashboardPage } from './pages/Dashboard';
import { CompaniesPage } from './pages/Companies';
import { CompanyDetailPage } from './pages/CompanyDetail';
import { EmployeesPage } from './pages/Employees';
import { CustomersPage } from './pages/Customers';
import { SuppliersPage } from './pages/Suppliers';
import { ProductsPage } from './pages/Products';
import { InventoryPage } from './pages/Inventory';
import { FleetPage } from './pages/Fleet';
import { AlertsPage } from './pages/Alerts';
import { MarketingPage } from './pages/Marketing';
import { CmsPage } from './pages/Cms';
import { HrDashboardPage } from './pages/Hr';
import { DepartmentsPage } from './pages/Departments';
import { ShiftSchedulingPage } from './pages/ShiftScheduling';
import { PayrollPage } from './pages/Payroll';
import { MyClockPage, MyLeavePage, MyShiftsPage, MyPerformancePage, MyPayslipsPage, MySalaryAdvancesPage } from './pages/MyHr';
import { FinancePage } from './pages/Finance';
import { AuditTrailPage } from './pages/AuditTrail';
import { AccountingPage } from './pages/Accounting';
import { ExpensesPage } from './pages/Expenses';
import { AssetsPage } from './pages/Assets';
import { ProjectsPage } from './pages/Projects';
import { ReportsPage } from './pages/Reports';
import { InterCompanyTransactionsPage } from './pages/InterCompanyTransactions';
import { UsersPage } from './pages/Users';
import { ProfilePage } from './pages/Profile';
import { RecruitmentPage } from './pages/Recruitment';
import { AttendancePage } from './pages/Attendance';
import { LeavePage } from './pages/Leave';
import { PerformancePage } from './pages/Performance';
import { AccountsPayablePage } from './pages/AccountsPayable';
import { OrdersPage } from './pages/Orders';
import { SupportTicketsPage } from './pages/SupportTickets';
import { ComingSoon } from './components/ComingSoon';

// Admin navigation redesign (27 August 2026) — menu entries in the agreed
// four-category taxonomy that have no backend service yet. They render a
// consistent <ComingSoon> placeholder so the regrouped sidebar has no dead
// links. See the root README and the docx "Implementation Status Update
// (27 August 2026)" sections.
// Every regrouped nav entry now has a working screen — the array is kept
// (empty) so a future placeholder can be re-introduced without reshaping the
// route table.
const STUB_ROUTES = [];

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/dashboard"
            element={
              <RequireAuth>
                <DashboardPage />
              </RequireAuth>
            }
          />
          <Route
            path="/employees"
            element={
              <RequireAuth>
                <EmployeesPage />
              </RequireAuth>
            }
          />
          <Route
            path="/customers"
            element={
              <RequireAuth>
                <CustomersPage />
              </RequireAuth>
            }
          />
          <Route
            path="/suppliers"
            element={
              <RequireAuth>
                <SuppliersPage />
              </RequireAuth>
            }
          />
          <Route
            path="/products"
            element={
              <RequireAuth>
                <ProductsPage />
              </RequireAuth>
            }
          />
          <Route
            path="/inventory"
            element={
              <RequireAuth>
                <InventoryPage />
              </RequireAuth>
            }
          />
          <Route
            path="/fleet"
            element={
              <RequireAuth>
                <FleetPage />
              </RequireAuth>
            }
          />
          <Route
            path="/alerts"
            element={
              <RequireAuth>
                <AlertsPage />
              </RequireAuth>
            }
          />
          <Route
            path="/marketing"
            element={
              <RequireAuth>
                <MarketingPage />
              </RequireAuth>
            }
          />
          <Route
            path="/cms"
            element={
              <RequireAuth>
                <CmsPage />
              </RequireAuth>
            }
          />
          <Route
            path="/hr"
            element={
              <RequireAuth>
                <HrDashboardPage />
              </RequireAuth>
            }
          />
          <Route
            path="/departments"
            element={
              <RequireAuth>
                <DepartmentsPage />
              </RequireAuth>
            }
          />
          <Route
            path="/shift-scheduling"
            element={
              <RequireAuth>
                <ShiftSchedulingPage />
              </RequireAuth>
            }
          />
          <Route
            path="/payroll"
            element={
              <RequireAuth>
                <PayrollPage />
              </RequireAuth>
            }
          />
          <Route path="/my/clock" element={<RequireAuth><MyClockPage /></RequireAuth>} />
          <Route path="/my/leave" element={<RequireAuth><MyLeavePage /></RequireAuth>} />
          <Route path="/my/shifts" element={<RequireAuth><MyShiftsPage /></RequireAuth>} />
          <Route path="/my/performance" element={<RequireAuth><MyPerformancePage /></RequireAuth>} />
          <Route path="/my/payslips" element={<RequireAuth><MyPayslipsPage /></RequireAuth>} />
          <Route path="/my/salary-advances" element={<RequireAuth><MySalaryAdvancesPage /></RequireAuth>} />
          <Route path="/finance" element={<RequireAuth><FinancePage /></RequireAuth>} />
          <Route
            path="/audit"
            element={
              <RequireAuth>
                <AuditTrailPage />
              </RequireAuth>
            }
          />
          <Route
            path="/accounting"
            element={
              <RequireAuth>
                <AccountingPage />
              </RequireAuth>
            }
          />
          <Route
            path="/expenses"
            element={
              <RequireAuth>
                <ExpensesPage />
              </RequireAuth>
            }
          />
          <Route
            path="/accounts-payable"
            element={
              <RequireAuth>
                <AccountsPayablePage />
              </RequireAuth>
            }
          />
          <Route
            path="/assets"
            element={
              <RequireAuth>
                <AssetsPage />
              </RequireAuth>
            }
          />
          <Route
            path="/projects"
            element={
              <RequireAuth>
                <ProjectsPage />
              </RequireAuth>
            }
          />
          <Route
            path="/reports"
            element={
              <RequireAuth>
                <ReportsPage />
              </RequireAuth>
            }
          />
          <Route
            path="/inter-company"
            element={
              <RequireAuth>
                <InterCompanyTransactionsPage />
              </RequireAuth>
            }
          />
          <Route
            path="/companies"
            element={
              <RequireAuth>
                <CompaniesPage />
              </RequireAuth>
            }
          />
          <Route
            path="/companies/:id"
            element={
              <RequireAuth>
                <CompanyDetailPage />
              </RequireAuth>
            }
          />
          <Route
            path="/recruitment"
            element={
              <RequireAuth>
                <RecruitmentPage />
              </RequireAuth>
            }
          />
          <Route
            path="/attendance"
            element={
              <RequireAuth>
                <AttendancePage />
              </RequireAuth>
            }
          />
          <Route
            path="/leave"
            element={
              <RequireAuth>
                <LeavePage />
              </RequireAuth>
            }
          />
          <Route
            path="/performance"
            element={
              <RequireAuth>
                <PerformancePage />
              </RequireAuth>
            }
          />
          <Route
            path="/orders"
            element={
              <RequireAuth>
                <OrdersPage />
              </RequireAuth>
            }
          />
          <Route
            path="/support-tickets"
            element={
              <RequireAuth>
                <SupportTicketsPage />
              </RequireAuth>
            }
          />
          <Route
            path="/users"
            element={
              <RequireAuth>
                <UsersPage />
              </RequireAuth>
            }
          />
          <Route
            path="/profile"
            element={
              <RequireAuth>
                <ProfilePage />
              </RequireAuth>
            }
          />
          {STUB_ROUTES.map((s) => (
            <Route
              key={s.path}
              path={s.path}
              element={
                <RequireAuth>
                  <ComingSoon
                    title={s.title}
                    category={s.category}
                    summary={s.summary}
                    planned={s.planned}
                  />
                </RequireAuth>
              }
            />
          ))}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
