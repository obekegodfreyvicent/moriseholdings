-- CreateEnum
CREATE TYPE "RosterEntryStatus" AS ENUM ('planned', 'published');

-- CreateEnum
CREATE TYPE "PayrollRunStatus" AS ENUM ('draft', 'approved', 'paid', 'cancelled');

-- CreateEnum
CREATE TYPE "SalaryAdvanceStatus" AS ENUM ('requested', 'approved', 'recovering', 'recovered', 'rejected', 'cancelled');

-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "gross_salary" DECIMAL(18,2),
ADD COLUMN     "pay_frequency" VARCHAR(20);

-- CreateTable
CREATE TABLE "roster_entries" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "shift_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status" "RosterEntryStatus" NOT NULL DEFAULT 'planned',
    "note" TEXT,
    "created_by" TEXT NOT NULL,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roster_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_runs" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "period_year" INTEGER NOT NULL,
    "period_month" INTEGER NOT NULL,
    "status" "PayrollRunStatus" NOT NULL DEFAULT 'draft',
    "total_gross" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "total_paye" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "total_nssf_employee" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "total_nssf_employer" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "total_advances" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "total_net" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "employee_count" INTEGER NOT NULL DEFAULT 0,
    "created_by" TEXT NOT NULL,
    "approved_by" TEXT,
    "approved_at" TIMESTAMP(3),
    "paid_at" TIMESTAMP(3),
    "journal_entry_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payslips" (
    "id" TEXT NOT NULL,
    "payroll_run_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "employee_name" VARCHAR(200) NOT NULL,
    "gross_salary" DECIMAL(18,2) NOT NULL,
    "paye" DECIMAL(18,2) NOT NULL,
    "nssf_employee" DECIMAL(18,2) NOT NULL,
    "nssf_employer" DECIMAL(18,2) NOT NULL,
    "advance_recovery" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "other_deductions" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "net_pay" DECIMAL(18,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payslips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salary_advances" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "employee_name" VARCHAR(200) NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "reason" TEXT,
    "installments" INTEGER NOT NULL DEFAULT 1,
    "amount_recovered" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "status" "SalaryAdvanceStatus" NOT NULL DEFAULT 'requested',
    "requested_by" TEXT NOT NULL,
    "approved_by" TEXT,
    "approved_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "salary_advances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "roster_entries_company_id_idx" ON "roster_entries"("company_id");

-- CreateIndex
CREATE INDEX "roster_entries_date_idx" ON "roster_entries"("date");

-- CreateIndex
CREATE UNIQUE INDEX "roster_entries_employee_id_date_key" ON "roster_entries"("employee_id", "date");

-- CreateIndex
CREATE INDEX "payroll_runs_company_id_idx" ON "payroll_runs"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_runs_company_id_period_year_period_month_key" ON "payroll_runs"("company_id", "period_year", "period_month");

-- CreateIndex
CREATE INDEX "payslips_employee_id_idx" ON "payslips"("employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "payslips_payroll_run_id_employee_id_key" ON "payslips"("payroll_run_id", "employee_id");

-- CreateIndex
CREATE INDEX "salary_advances_company_id_idx" ON "salary_advances"("company_id");

-- CreateIndex
CREATE INDEX "salary_advances_employee_id_idx" ON "salary_advances"("employee_id");

-- AddForeignKey
ALTER TABLE "roster_entries" ADD CONSTRAINT "roster_entries_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_payroll_run_id_fkey" FOREIGN KEY ("payroll_run_id") REFERENCES "payroll_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
