-- Warehouse Management (1 September 2026): warehouse staff, a receiving
-- document (goods_receipts), a picking -> packing -> dispatch job
-- (pick_lists) and a physical count + reconciliation session (stock_counts),
-- plus a functional `kind` on stock locations (bins). DDL only; demo data
-- (a warehouse-manager persona, staff rows, a draft receipt / pick list /
-- count) is seeded in prisma/seed.ts.

-- CreateEnum
CREATE TYPE "StockLocationKind" AS ENUM ('receiving', 'storage', 'picking', 'packing', 'dispatch', 'quarantine');
CREATE TYPE "WarehouseRole" AS ENUM ('manager', 'supervisor', 'receiver', 'picker', 'packer', 'dispatcher');
CREATE TYPE "GoodsReceiptStatus" AS ENUM ('draft', 'received', 'cancelled');
CREATE TYPE "PickListStatus" AS ENUM ('pending', 'picking', 'picked', 'packed', 'dispatched', 'cancelled');
CREATE TYPE "StockCountStatus" AS ENUM ('open', 'counting', 'reconciled', 'cancelled');

-- AlterTable
ALTER TABLE "stock_locations" ADD COLUMN "kind" "StockLocationKind" NOT NULL DEFAULT 'storage';

-- CreateTable
CREATE TABLE "warehouse_staff" (
    "id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "role" "WarehouseRole" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warehouse_staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goods_receipts" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "receipt_number" VARCHAR(40) NOT NULL,
    "supplier_id" TEXT,
    "reference" VARCHAR(100),
    "note" TEXT,
    "status" "GoodsReceiptStatus" NOT NULL DEFAULT 'draft',
    "received_by" TEXT,
    "received_at" TIMESTAMP(3),
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "goods_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goods_receipt_lines" (
    "id" TEXT NOT NULL,
    "receipt_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "batch_number" VARCHAR(80),
    "expiry_date" DATE,
    "location_id" TEXT,
    "note" TEXT,

    CONSTRAINT "goods_receipt_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pick_lists" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "pick_number" VARCHAR(40) NOT NULL,
    "order_id" TEXT,
    "assigned_to_employee_id" TEXT,
    "reference" VARCHAR(100),
    "note" TEXT,
    "status" "PickListStatus" NOT NULL DEFAULT 'pending',
    "picked_at" TIMESTAMP(3),
    "packed_at" TIMESTAMP(3),
    "dispatched_at" TIMESTAMP(3),
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pick_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pick_list_lines" (
    "id" TEXT NOT NULL,
    "pick_list_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "quantity_requested" INTEGER NOT NULL,
    "quantity_picked" INTEGER NOT NULL DEFAULT 0,
    "location_id" TEXT,
    "note" TEXT,

    CONSTRAINT "pick_list_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_counts" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "count_number" VARCHAR(40) NOT NULL,
    "reference" VARCHAR(100),
    "note" TEXT,
    "status" "StockCountStatus" NOT NULL DEFAULT 'open',
    "reconciled_at" TIMESTAMP(3),
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_counts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_count_lines" (
    "id" TEXT NOT NULL,
    "stock_count_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "system_quantity" INTEGER NOT NULL,
    "counted_quantity" INTEGER,
    "variance" INTEGER,
    "location_id" TEXT,

    CONSTRAINT "stock_count_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "warehouse_staff_warehouse_id_employee_id_role_key" ON "warehouse_staff"("warehouse_id", "employee_id", "role");
CREATE INDEX "warehouse_staff_warehouse_id_idx" ON "warehouse_staff"("warehouse_id");
CREATE UNIQUE INDEX "goods_receipts_company_id_receipt_number_key" ON "goods_receipts"("company_id", "receipt_number");
CREATE INDEX "goods_receipts_company_id_idx" ON "goods_receipts"("company_id");
CREATE INDEX "goods_receipts_warehouse_id_idx" ON "goods_receipts"("warehouse_id");
CREATE INDEX "goods_receipt_lines_receipt_id_idx" ON "goods_receipt_lines"("receipt_id");
CREATE UNIQUE INDEX "pick_lists_company_id_pick_number_key" ON "pick_lists"("company_id", "pick_number");
CREATE INDEX "pick_lists_company_id_idx" ON "pick_lists"("company_id");
CREATE INDEX "pick_lists_warehouse_id_idx" ON "pick_lists"("warehouse_id");
CREATE INDEX "pick_list_lines_pick_list_id_idx" ON "pick_list_lines"("pick_list_id");
CREATE UNIQUE INDEX "stock_counts_company_id_count_number_key" ON "stock_counts"("company_id", "count_number");
CREATE INDEX "stock_counts_company_id_idx" ON "stock_counts"("company_id");
CREATE INDEX "stock_counts_warehouse_id_idx" ON "stock_counts"("warehouse_id");
CREATE INDEX "stock_count_lines_stock_count_id_idx" ON "stock_count_lines"("stock_count_id");

-- AddForeignKey
ALTER TABLE "warehouse_staff" ADD CONSTRAINT "warehouse_staff_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "goods_receipt_lines" ADD CONSTRAINT "goods_receipt_lines_receipt_id_fkey" FOREIGN KEY ("receipt_id") REFERENCES "goods_receipts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "goods_receipt_lines" ADD CONSTRAINT "goods_receipt_lines_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pick_lists" ADD CONSTRAINT "pick_lists_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pick_list_lines" ADD CONSTRAINT "pick_list_lines_pick_list_id_fkey" FOREIGN KEY ("pick_list_id") REFERENCES "pick_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pick_list_lines" ADD CONSTRAINT "pick_list_lines_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_counts" ADD CONSTRAINT "stock_counts_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_count_lines" ADD CONSTRAINT "stock_count_lines_stock_count_id_fkey" FOREIGN KEY ("stock_count_id") REFERENCES "stock_counts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stock_count_lines" ADD CONSTRAINT "stock_count_lines_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
