-- Supplier Management: multi-contact list, suspension, evaluation and performance (1 September 2026).

-- AlterEnum
ALTER TYPE "SupplierStatus" ADD VALUE 'suspended';

-- AlterTable
ALTER TABLE "suppliers"
  ADD COLUMN "suspension_reason" TEXT,
  ADD COLUMN "suspended_until" DATE;

-- CreateTable
CREATE TABLE "supplier_contacts" (
    "id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "title" VARCHAR(120),
    "email" VARCHAR(255),
    "phone" VARCHAR(40),
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_evaluations" (
    "id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "period_label" VARCHAR(40) NOT NULL,
    "delivery_score" INTEGER NOT NULL,
    "quality_score" INTEGER NOT NULL,
    "price_score" INTEGER NOT NULL,
    "communication_score" INTEGER NOT NULL,
    "compliance_score" INTEGER NOT NULL,
    "overall_score" DECIMAL(4,2) NOT NULL,
    "comments" TEXT,
    "evaluated_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "supplier_contacts_supplier_id_idx" ON "supplier_contacts"("supplier_id");

-- CreateIndex
CREATE INDEX "supplier_evaluations_supplier_id_idx" ON "supplier_evaluations"("supplier_id");

-- CreateIndex
CREATE INDEX "supplier_evaluations_company_id_idx" ON "supplier_evaluations"("company_id");

-- AddForeignKey
ALTER TABLE "supplier_contacts" ADD CONSTRAINT "supplier_contacts_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_evaluations" ADD CONSTRAINT "supplier_evaluations_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
