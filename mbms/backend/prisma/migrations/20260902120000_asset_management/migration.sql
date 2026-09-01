-- Asset Management (2 September 2026): first-class asset categories with
-- depreciation defaults, purchase / supplier information on the asset,
-- periodic inspections, first-class insurance policies, and an append-only
-- asset-history event log. DDL only; demo rows (categories, an inspection,
-- an insurance policy, backfilled 'registered' events) are seeded in
-- prisma/seed.ts.

-- CreateEnum
CREATE TYPE "AssetCondition" AS ENUM ('excellent', 'good', 'fair', 'poor', 'unserviceable');
CREATE TYPE "InsurancePolicyStatus" AS ENUM ('active', 'expired', 'cancelled');
CREATE TYPE "AssetEventType" AS ENUM ('registered', 'updated', 'transferred', 'depreciation', 'maintenance', 'inspection', 'insurance_added', 'insurance_updated', 'disposal_requested', 'disposal_approved', 'disposed');

-- AlterTable
ALTER TABLE "assets"
  ADD COLUMN "category_id" TEXT,
  ADD COLUMN "supplier_id" TEXT,
  ADD COLUMN "purchase_reference" VARCHAR(100),
  ADD COLUMN "warranty_expiry_date" DATE;

-- CreateTable
CREATE TABLE "asset_categories" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "default_depreciation_method" "DepreciationMethod" NOT NULL DEFAULT 'none',
    "default_useful_life_years" INTEGER,
    "default_salvage_percent" DECIMAL(5,2),
    "note" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asset_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_inspections" (
    "id" TEXT NOT NULL,
    "asset_id" TEXT NOT NULL,
    "inspection_date" DATE NOT NULL,
    "inspector_employee_id" TEXT,
    "condition" "AssetCondition" NOT NULL,
    "findings" TEXT,
    "action_required" TEXT,
    "next_inspection_date" DATE,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_inspections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_insurance_policies" (
    "id" TEXT NOT NULL,
    "asset_id" TEXT NOT NULL,
    "insurer" VARCHAR(150) NOT NULL,
    "policy_number" VARCHAR(100) NOT NULL,
    "coverage_amount" DECIMAL(18,2) NOT NULL,
    "premium" DECIMAL(18,2),
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "status" "InsurancePolicyStatus" NOT NULL DEFAULT 'active',
    "note" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asset_insurance_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_events" (
    "id" TEXT NOT NULL,
    "asset_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "event_type" "AssetEventType" NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "summary" VARCHAR(255) NOT NULL,
    "detail" JSONB,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "asset_categories_company_id_code_key" ON "asset_categories"("company_id", "code");
CREATE INDEX "asset_categories_company_id_idx" ON "asset_categories"("company_id");
CREATE INDEX "asset_inspections_asset_id_idx" ON "asset_inspections"("asset_id");
CREATE INDEX "asset_insurance_policies_asset_id_idx" ON "asset_insurance_policies"("asset_id");
CREATE INDEX "asset_events_asset_id_idx" ON "asset_events"("asset_id");
CREATE INDEX "asset_events_company_id_idx" ON "asset_events"("company_id");

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "asset_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "assets" ADD CONSTRAINT "assets_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "asset_inspections" ADD CONSTRAINT "asset_inspections_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "asset_insurance_policies" ADD CONSTRAINT "asset_insurance_policies_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "asset_events" ADD CONSTRAINT "asset_events_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
