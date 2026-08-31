-- CreateEnum
CREATE TYPE "JournalEntryType" AS ENUM ('standard', 'adjusting', 'closing');

-- CreateEnum
CREATE TYPE "ARInvoiceStatus" AS ENUM ('draft', 'posted', 'partially_paid', 'paid', 'overdue', 'void');

-- CreateEnum
CREATE TYPE "CreditDebitNoteStatus" AS ENUM ('issued', 'applied');

-- CreateEnum
CREATE TYPE "APInvoiceStatus" AS ENUM ('draft', 'pending_approval', 'approved', 'partially_paid', 'paid', 'overdue', 'void');

-- CreateEnum
CREATE TYPE "ReconciliationStatus" AS ENUM ('open', 'reconciled');

-- AlterTable
ALTER TABLE "journal_entries" ADD COLUMN     "entry_type" "JournalEntryType" NOT NULL DEFAULT 'standard';

-- CreateTable
CREATE TABLE "customer_invoices" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "invoice_number" VARCHAR(50) NOT NULL,
    "invoice_date" DATE NOT NULL,
    "due_date" DATE NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "subtotal" DECIMAL(18,2) NOT NULL,
    "tax_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(18,2) NOT NULL,
    "amount_paid" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "status" "ARInvoiceStatus" NOT NULL DEFAULT 'draft',
    "ar_account_id" TEXT,
    "revenue_account_id" TEXT,
    "financial_period_id" TEXT,
    "journal_entry_id" TEXT,
    "reminders_sent_count" INTEGER NOT NULL DEFAULT 0,
    "last_reminder_sent_at" TIMESTAMP(3),
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_invoice_items" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "description" VARCHAR(255) NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL DEFAULT 1,
    "unit_price" DECIMAL(18,2) NOT NULL,
    "line_total" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "customer_invoice_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_payments" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "payment_date" DATE NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "method" VARCHAR(50),
    "reference" VARCHAR(150),
    "bank_account_id" TEXT,
    "journal_entry_id" TEXT,
    "received_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_payment_applications" (
    "id" TEXT NOT NULL,
    "payment_id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "amount_applied" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "customer_payment_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_credit_notes" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "credit_note_number" VARCHAR(50) NOT NULL,
    "credit_date" DATE NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "reason" TEXT,
    "applied_to_invoice_id" TEXT,
    "status" "CreditDebitNoteStatus" NOT NULL DEFAULT 'issued',
    "journal_entry_id" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_credit_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_debit_notes" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "debit_note_number" VARCHAR(50) NOT NULL,
    "debit_date" DATE NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "reason" TEXT,
    "journal_entry_id" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_debit_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_invoices" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "invoice_number" VARCHAR(50) NOT NULL,
    "invoice_date" DATE NOT NULL,
    "due_date" DATE NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "subtotal" DECIMAL(18,2) NOT NULL,
    "tax_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(18,2) NOT NULL,
    "amount_paid" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "status" "APInvoiceStatus" NOT NULL DEFAULT 'draft',
    "ap_account_id" TEXT,
    "expense_account_id" TEXT,
    "financial_period_id" TEXT,
    "journal_entry_id" TEXT,
    "approved_by" TEXT,
    "approved_at" TIMESTAMP(3),
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_invoice_items" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "description" VARCHAR(255) NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL DEFAULT 1,
    "unit_price" DECIMAL(18,2) NOT NULL,
    "line_total" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "supplier_invoice_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_payments" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "payment_date" DATE NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "method" VARCHAR(50),
    "reference" VARCHAR(150),
    "bank_account_id" TEXT,
    "journal_entry_id" TEXT,
    "paid_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_payment_applications" (
    "id" TEXT NOT NULL,
    "payment_id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "amount_applied" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "supplier_payment_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_credit_notes" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "credit_note_number" VARCHAR(50) NOT NULL,
    "credit_date" DATE NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "reason" TEXT,
    "applied_to_invoice_id" TEXT,
    "status" "CreditDebitNoteStatus" NOT NULL DEFAULT 'issued',
    "journal_entry_id" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_credit_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_reconciliations" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "as_of_date" DATE NOT NULL,
    "statement_balance" DECIMAL(18,2) NOT NULL,
    "ledger_balance" DECIMAL(18,2) NOT NULL,
    "variance" DECIMAL(18,2) NOT NULL,
    "notes" TEXT,
    "status" "ReconciliationStatus" NOT NULL DEFAULT 'open',
    "reconciled_by" TEXT,
    "reconciled_at" TIMESTAMP(3),
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_reconciliations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budgets" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "financial_period_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "budgeted_amount" DECIMAL(18,2) NOT NULL,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "budgets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "customer_invoices_company_id_idx" ON "customer_invoices"("company_id");

-- CreateIndex
CREATE INDEX "customer_invoices_customer_id_idx" ON "customer_invoices"("customer_id");

-- CreateIndex
CREATE INDEX "customer_invoices_status_idx" ON "customer_invoices"("status");

-- CreateIndex
CREATE UNIQUE INDEX "customer_invoices_company_id_invoice_number_key" ON "customer_invoices"("company_id", "invoice_number");

-- CreateIndex
CREATE INDEX "customer_invoice_items_invoice_id_idx" ON "customer_invoice_items"("invoice_id");

-- CreateIndex
CREATE INDEX "customer_payments_company_id_idx" ON "customer_payments"("company_id");

-- CreateIndex
CREATE INDEX "customer_payments_customer_id_idx" ON "customer_payments"("customer_id");

-- CreateIndex
CREATE INDEX "customer_payment_applications_payment_id_idx" ON "customer_payment_applications"("payment_id");

-- CreateIndex
CREATE INDEX "customer_payment_applications_invoice_id_idx" ON "customer_payment_applications"("invoice_id");

-- CreateIndex
CREATE INDEX "customer_credit_notes_company_id_idx" ON "customer_credit_notes"("company_id");

-- CreateIndex
CREATE INDEX "customer_credit_notes_customer_id_idx" ON "customer_credit_notes"("customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "customer_credit_notes_company_id_credit_note_number_key" ON "customer_credit_notes"("company_id", "credit_note_number");

-- CreateIndex
CREATE INDEX "customer_debit_notes_company_id_idx" ON "customer_debit_notes"("company_id");

-- CreateIndex
CREATE INDEX "customer_debit_notes_customer_id_idx" ON "customer_debit_notes"("customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "customer_debit_notes_company_id_debit_note_number_key" ON "customer_debit_notes"("company_id", "debit_note_number");

-- CreateIndex
CREATE INDEX "supplier_invoices_company_id_idx" ON "supplier_invoices"("company_id");

-- CreateIndex
CREATE INDEX "supplier_invoices_supplier_id_idx" ON "supplier_invoices"("supplier_id");

-- CreateIndex
CREATE INDEX "supplier_invoices_status_idx" ON "supplier_invoices"("status");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_invoices_company_id_invoice_number_key" ON "supplier_invoices"("company_id", "invoice_number");

-- CreateIndex
CREATE INDEX "supplier_invoice_items_invoice_id_idx" ON "supplier_invoice_items"("invoice_id");

-- CreateIndex
CREATE INDEX "supplier_payments_company_id_idx" ON "supplier_payments"("company_id");

-- CreateIndex
CREATE INDEX "supplier_payments_supplier_id_idx" ON "supplier_payments"("supplier_id");

-- CreateIndex
CREATE INDEX "supplier_payment_applications_payment_id_idx" ON "supplier_payment_applications"("payment_id");

-- CreateIndex
CREATE INDEX "supplier_payment_applications_invoice_id_idx" ON "supplier_payment_applications"("invoice_id");

-- CreateIndex
CREATE INDEX "supplier_credit_notes_company_id_idx" ON "supplier_credit_notes"("company_id");

-- CreateIndex
CREATE INDEX "supplier_credit_notes_supplier_id_idx" ON "supplier_credit_notes"("supplier_id");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_credit_notes_company_id_credit_note_number_key" ON "supplier_credit_notes"("company_id", "credit_note_number");

-- CreateIndex
CREATE INDEX "account_reconciliations_company_id_idx" ON "account_reconciliations"("company_id");

-- CreateIndex
CREATE INDEX "account_reconciliations_account_id_idx" ON "account_reconciliations"("account_id");

-- CreateIndex
CREATE INDEX "budgets_company_id_idx" ON "budgets"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "budgets_financial_period_id_account_id_key" ON "budgets"("financial_period_id", "account_id");

-- AddForeignKey
ALTER TABLE "customer_invoice_items" ADD CONSTRAINT "customer_invoice_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "customer_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_payment_applications" ADD CONSTRAINT "customer_payment_applications_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "customer_payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_payment_applications" ADD CONSTRAINT "customer_payment_applications_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "customer_invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_invoice_items" ADD CONSTRAINT "supplier_invoice_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "supplier_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_payment_applications" ADD CONSTRAINT "supplier_payment_applications_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "supplier_payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_payment_applications" ADD CONSTRAINT "supplier_payment_applications_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "supplier_invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

