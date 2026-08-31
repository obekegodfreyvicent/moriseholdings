-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('pending', 'assigned', 'picked_up', 'in_transit', 'delivered', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "DeliveryKind" AS ENUM ('goods', 'invoice');

-- CreateEnum
CREATE TYPE "DeliveryProofType" AS ENUM ('none', 'signature', 'photo', 'otp');

-- CreateTable
CREATE TABLE "delivery_drivers" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "employee_id" TEXT,
    "name" VARCHAR(160) NOT NULL,
    "phone" VARCHAR(30),
    "license_number" VARCHAR(60),
    "vehicle_reg" VARCHAR(30),
    "vehicle_type" VARCHAR(40),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delivery_drivers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deliveries" (
    "id" TEXT NOT NULL,
    "delivery_number" VARCHAR(40) NOT NULL,
    "company_id" TEXT NOT NULL,
    "origin_company_id" TEXT NOT NULL,
    "origin_branch_id" TEXT,
    "customer_id" TEXT NOT NULL,
    "order_id" TEXT,
    "invoice_id" TEXT,
    "kind" "DeliveryKind" NOT NULL DEFAULT 'goods',
    "status" "DeliveryStatus" NOT NULL DEFAULT 'pending',
    "driver_id" TEXT,
    "drop_address" TEXT NOT NULL,
    "drop_contact_name" VARCHAR(160),
    "drop_contact_phone" VARCHAR(30),
    "instructions" TEXT,
    "scheduled_date" DATE,
    "delivery_fee" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "assigned_at" TIMESTAMP(3),
    "picked_up_at" TIMESTAMP(3),
    "in_transit_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "failure_reason" TEXT,
    "proof_type" "DeliveryProofType" NOT NULL DEFAULT 'none',
    "proof_reference" TEXT,
    "recipient_name" VARCHAR(160),
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_events" (
    "id" TEXT NOT NULL,
    "delivery_id" TEXT NOT NULL,
    "status" "DeliveryStatus" NOT NULL,
    "note" TEXT,
    "location_text" TEXT,
    "recorded_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "delivery_drivers_company_id_idx" ON "delivery_drivers"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "deliveries_order_id_key" ON "deliveries"("order_id");

-- CreateIndex
CREATE INDEX "deliveries_company_id_idx" ON "deliveries"("company_id");

-- CreateIndex
CREATE INDEX "deliveries_origin_company_id_idx" ON "deliveries"("origin_company_id");

-- CreateIndex
CREATE INDEX "deliveries_customer_id_idx" ON "deliveries"("customer_id");

-- CreateIndex
CREATE INDEX "deliveries_order_id_idx" ON "deliveries"("order_id");

-- CreateIndex
CREATE INDEX "deliveries_invoice_id_idx" ON "deliveries"("invoice_id");

-- CreateIndex
CREATE INDEX "deliveries_status_idx" ON "deliveries"("status");

-- CreateIndex
CREATE UNIQUE INDEX "deliveries_company_id_delivery_number_key" ON "deliveries"("company_id", "delivery_number");

-- CreateIndex
CREATE INDEX "delivery_events_delivery_id_idx" ON "delivery_events"("delivery_id");

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "delivery_drivers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_events" ADD CONSTRAINT "delivery_events_delivery_id_fkey" FOREIGN KEY ("delivery_id") REFERENCES "deliveries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

