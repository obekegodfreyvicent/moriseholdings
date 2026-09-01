-- Inventory Management (1 September 2026): warehouses, stock locations,
-- per-warehouse balances, batch / expiry / serial tracking, transfers,
-- returns, min / max stock levels. DDL only — the MAIN-warehouse backfill
-- and per-warehouse balance seeding run in prisma/seed.ts (and lazily in
-- InventoryService), matching this project's "data goes in the seed, not a
-- migration" convention.

-- AlterEnum
ALTER TYPE "StockMovementType" ADD VALUE 'adjustment';
ALTER TYPE "StockMovementType" ADD VALUE 'transfer_out';
ALTER TYPE "StockMovementType" ADD VALUE 'transfer_in';
ALTER TYPE "StockMovementType" ADD VALUE 'return';

-- CreateEnum
CREATE TYPE "SerialStatus" AS ENUM ('in_stock', 'issued', 'returned', 'scrapped');

-- AlterTable
ALTER TABLE "products"
  ADD COLUMN "min_stock_level" INTEGER,
  ADD COLUMN "max_stock_level" INTEGER,
  ADD COLUMN "track_batches" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "track_serials" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "stock_movements"
  ADD COLUMN "warehouse_id" TEXT,
  ADD COLUMN "counterparty_warehouse_id" TEXT,
  ADD COLUMN "batch_number" VARCHAR(80);

-- CreateTable
CREATE TABLE "warehouses" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "branch_id" TEXT,
    "code" VARCHAR(30) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "address" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_locations" (
    "id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_balances" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_batches" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "batch_number" VARCHAR(80) NOT NULL,
    "expiry_date" DATE,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_serials" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "serial_number" VARCHAR(120) NOT NULL,
    "status" "SerialStatus" NOT NULL DEFAULT 'in_stock',
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_serials_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "warehouses_company_id_code_key" ON "warehouses"("company_id", "code");
CREATE INDEX "warehouses_company_id_idx" ON "warehouses"("company_id");
CREATE UNIQUE INDEX "stock_locations_warehouse_id_code_key" ON "stock_locations"("warehouse_id", "code");
CREATE INDEX "stock_locations_warehouse_id_idx" ON "stock_locations"("warehouse_id");
CREATE UNIQUE INDEX "stock_balances_product_id_warehouse_id_key" ON "stock_balances"("product_id", "warehouse_id");
CREATE INDEX "stock_balances_company_id_idx" ON "stock_balances"("company_id");
CREATE INDEX "stock_balances_warehouse_id_idx" ON "stock_balances"("warehouse_id");
CREATE UNIQUE INDEX "stock_batches_product_id_warehouse_id_batch_number_key" ON "stock_batches"("product_id", "warehouse_id", "batch_number");
CREATE INDEX "stock_batches_company_id_idx" ON "stock_batches"("company_id");
CREATE INDEX "stock_batches_product_id_idx" ON "stock_batches"("product_id");
CREATE UNIQUE INDEX "stock_serials_product_id_serial_number_key" ON "stock_serials"("product_id", "serial_number");
CREATE INDEX "stock_serials_company_id_idx" ON "stock_serials"("company_id");
CREATE INDEX "stock_serials_product_id_idx" ON "stock_serials"("product_id");
CREATE INDEX "stock_movements_warehouse_id_idx" ON "stock_movements"("warehouse_id");

-- AddForeignKey
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "stock_locations" ADD CONSTRAINT "stock_locations_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stock_balances" ADD CONSTRAINT "stock_balances_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stock_balances" ADD CONSTRAINT "stock_balances_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stock_batches" ADD CONSTRAINT "stock_batches_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stock_serials" ADD CONSTRAINT "stock_serials_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
