-- Salary structures, allowances, overtime and bonuses (1 September 2026).

-- CreateEnum
CREATE TYPE "SalaryComponentType" AS ENUM ('basic', 'allowance', 'overtime', 'bonus');

-- CreateTable
CREATE TABLE "salary_components" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "type" "SalaryComponentType" NOT NULL,
    "label" VARCHAR(120) NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "recurring" BOOLEAN NOT NULL DEFAULT true,
    "period_year" INTEGER,
    "period_month" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "salary_components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payslip_components" (
    "id" TEXT NOT NULL,
    "payslip_id" TEXT NOT NULL,
    "type" "SalaryComponentType" NOT NULL,
    "label" VARCHAR(120) NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "payslip_components_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "salary_components_company_id_idx" ON "salary_components"("company_id");

-- CreateIndex
CREATE INDEX "salary_components_employee_id_idx" ON "salary_components"("employee_id");

-- CreateIndex
CREATE INDEX "payslip_components_payslip_id_idx" ON "payslip_components"("payslip_id");

-- AddForeignKey
ALTER TABLE "payslip_components" ADD CONSTRAINT "payslip_components_payslip_id_fkey" FOREIGN KEY ("payslip_id") REFERENCES "payslips"("id") ON DELETE CASCADE ON UPDATE CASCADE;
