-- CreateEnum
CREATE TYPE "ExpenseStatus" AS ENUM ('submitted', 'manager_approved', 'finance_approved', 'rejected', 'paid');

-- CreateTable
CREATE TABLE "expenses" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "branch_id" TEXT,
    "department_id" TEXT,
    "submitted_by" TEXT NOT NULL,
    "category" VARCHAR(100),
    "description" TEXT,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "expense_date" DATE NOT NULL,
    "receipt_reference" VARCHAR(150),
    "expense_account_id" TEXT NOT NULL,
    "status" "ExpenseStatus" NOT NULL DEFAULT 'submitted',
    "manager_approved_by" TEXT,
    "manager_approved_at" TIMESTAMP(3),
    "finance_approved_by" TEXT,
    "finance_approved_at" TIMESTAMP(3),
    "rejected_by" TEXT,
    "rejected_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "paid_by" TEXT,
    "paid_at" TIMESTAMP(3),
    "journal_entry_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "expenses_company_id_idx" ON "expenses"("company_id");

-- CreateIndex
CREATE INDEX "expenses_submitted_by_idx" ON "expenses"("submitted_by");

-- CreateIndex
CREATE INDEX "expenses_status_idx" ON "expenses"("status");

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_expense_account_id_fkey" FOREIGN KEY ("expense_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
