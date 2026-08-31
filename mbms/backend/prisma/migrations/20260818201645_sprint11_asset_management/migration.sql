-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('active', 'disposal_requested', 'disposal_approved', 'disposed');

-- CreateEnum
CREATE TYPE "DepreciationMethod" AS ENUM ('none', 'straight_line');

-- CreateEnum
CREATE TYPE "DisposalMethod" AS ENUM ('sale', 'write_off');

-- CreateTable
CREATE TABLE "assets" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "branch_id" TEXT,
    "department_id" TEXT,
    "asset_number" VARCHAR(50) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "category" VARCHAR(100),
    "description" TEXT,
    "custodian_employee_id" TEXT,
    "purchase_date" DATE NOT NULL,
    "purchase_cost" DECIMAL(18,2) NOT NULL,
    "accumulated_depreciation" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "depreciation_method" "DepreciationMethod" NOT NULL DEFAULT 'none',
    "useful_life_years" INTEGER,
    "salvage_value" DECIMAL(18,2) DEFAULT 0,
    "asset_account_id" TEXT,
    "depreciation_expense_account_id" TEXT,
    "accumulated_depreciation_account_id" TEXT,
    "insurer" VARCHAR(150),
    "insurance_policy_number" VARCHAR(100),
    "insurance_expiry_date" DATE,
    "document_reference" VARCHAR(150),
    "status" "AssetStatus" NOT NULL DEFAULT 'active',
    "disposal_requested_by" TEXT,
    "disposal_requested_at" TIMESTAMP(3),
    "disposal_request_reason" TEXT,
    "disposal_approved_by" TEXT,
    "disposal_approved_at" TIMESTAMP(3),
    "inspection_notes" TEXT,
    "disposal_method" "DisposalMethod",
    "disposal_proceeds" DECIMAL(18,2),
    "disposed_at" TIMESTAMP(3),
    "disposal_journal_entry_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_maintenance_records" (
    "id" TEXT NOT NULL,
    "asset_id" TEXT NOT NULL,
    "maintenance_date" DATE NOT NULL,
    "description" TEXT NOT NULL,
    "cost" DECIMAL(18,2),
    "performed_by" TEXT NOT NULL,
    "journal_entry_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_maintenance_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "assets_company_id_idx" ON "assets"("company_id");

-- CreateIndex
CREATE INDEX "assets_status_idx" ON "assets"("status");

-- CreateIndex
CREATE UNIQUE INDEX "assets_company_id_asset_number_key" ON "assets"("company_id", "asset_number");

-- CreateIndex
CREATE INDEX "asset_maintenance_records_asset_id_idx" ON "asset_maintenance_records"("asset_id");

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_asset_account_id_fkey" FOREIGN KEY ("asset_account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_depreciation_expense_account_id_fkey" FOREIGN KEY ("depreciation_expense_account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_accumulated_depreciation_account_id_fkey" FOREIGN KEY ("accumulated_depreciation_account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_maintenance_records" ADD CONSTRAINT "asset_maintenance_records_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
