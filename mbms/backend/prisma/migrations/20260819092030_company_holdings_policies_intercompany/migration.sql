-- CreateEnum
CREATE TYPE "InterCompanyTransactionType" AS ENUM ('loan', 'transfer', 'service_charge', 'cost_allocation', 'other');

-- CreateEnum
CREATE TYPE "InterCompanyTransactionStatus" AS ENUM ('draft', 'posted');

-- CreateTable
CREATE TABLE "company_policies" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "policy_type" VARCHAR(100),
    "document_reference" VARCHAR(150),
    "effective_date" DATE,
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inter_company_transactions" (
    "id" TEXT NOT NULL,
    "from_company_id" TEXT NOT NULL,
    "to_company_id" TEXT NOT NULL,
    "transaction_type" "InterCompanyTransactionType" NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "description" TEXT,
    "transaction_date" DATE NOT NULL,
    "status" "InterCompanyTransactionStatus" NOT NULL DEFAULT 'draft',
    "from_account_id" TEXT,
    "from_clearing_account_id" TEXT,
    "to_clearing_account_id" TEXT,
    "to_account_id" TEXT,
    "from_journal_entry_id" TEXT,
    "to_journal_entry_id" TEXT,
    "created_by" TEXT NOT NULL,
    "posted_by" TEXT,
    "posted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inter_company_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "company_policies_company_id_idx" ON "company_policies"("company_id");

-- CreateIndex
CREATE INDEX "inter_company_transactions_from_company_id_idx" ON "inter_company_transactions"("from_company_id");

-- CreateIndex
CREATE INDEX "inter_company_transactions_to_company_id_idx" ON "inter_company_transactions"("to_company_id");
