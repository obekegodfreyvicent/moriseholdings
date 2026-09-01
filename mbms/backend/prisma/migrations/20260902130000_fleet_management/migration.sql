-- Fleet & Vehicle Management (2 September 2026): a fleet register on top of
-- (optionally linked to) the Asset module — vehicles, driver assignments,
-- odometer history, fuel logs, service schedules & records, statutory
-- renewals, accident records and a rolled-up expense log. DDL only; demo
-- rows are seeded in prisma/seed.ts.

-- CreateEnum
CREATE TYPE "VehicleStatus" AS ENUM ('active', 'in_service', 'off_road', 'sold', 'written_off');
CREATE TYPE "VehicleOwnershipType" AS ENUM ('owned', 'leased', 'financed', 'hired');
CREATE TYPE "FuelType" AS ENUM ('petrol', 'diesel', 'electric', 'hybrid', 'lpg', 'cng');
CREATE TYPE "VehicleAssignmentStatus" AS ENUM ('active', 'ended');
CREATE TYPE "ServiceRecordKind" AS ENUM ('service', 'repair');
CREATE TYPE "VehicleRenewalType" AS ENUM ('road_licence', 'inspection_certificate', 'psv_permit', 'insurance', 'road_worthiness', 'other');
CREATE TYPE "AccidentSeverity" AS ENUM ('minor', 'moderate', 'major', 'total_loss');
CREATE TYPE "VehicleExpenseCategory" AS ENUM ('fuel', 'service', 'repair', 'licence', 'insurance', 'tyres', 'toll', 'fine', 'parking', 'other');

-- CreateTable
CREATE TABLE "vehicles" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "branch_id" TEXT,
    "asset_id" TEXT,
    "registration_number" VARCHAR(30) NOT NULL,
    "make" VARCHAR(80) NOT NULL,
    "model" VARCHAR(80) NOT NULL,
    "year" INTEGER,
    "vin" VARCHAR(60),
    "colour" VARCHAR(40),
    "fuel_type" "FuelType" NOT NULL DEFAULT 'diesel',
    "ownership_type" "VehicleOwnershipType" NOT NULL DEFAULT 'owned',
    "owner_name" VARCHAR(150),
    "acquisition_date" DATE,
    "current_odometer" INTEGER NOT NULL DEFAULT 0,
    "odometer_unit" VARCHAR(5) NOT NULL DEFAULT 'km',
    "last_location_text" TEXT,
    "last_location_at" TIMESTAMP(3),
    "status" "VehicleStatus" NOT NULL DEFAULT 'active',
    "notes" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_driver_assignments" (
    "id" TEXT NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "driver_employee_id" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "status" "VehicleAssignmentStatus" NOT NULL DEFAULT 'active',
    "note" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vehicle_driver_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_odometer_readings" (
    "id" TEXT NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "reading_date" DATE NOT NULL,
    "odometer" INTEGER NOT NULL,
    "source" VARCHAR(20) NOT NULL DEFAULT 'manual',
    "note" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vehicle_odometer_readings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fuel_logs" (
    "id" TEXT NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "log_date" DATE NOT NULL,
    "litres" DECIMAL(10,2) NOT NULL,
    "cost" DECIMAL(18,2) NOT NULL,
    "odometer" INTEGER,
    "fuel_station" VARCHAR(120),
    "filled_to_full" BOOLEAN NOT NULL DEFAULT true,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fuel_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_schedules" (
    "id" TEXT NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "interval_km" INTEGER,
    "interval_days" INTEGER,
    "last_service_odometer" INTEGER,
    "last_service_date" DATE,
    "next_due_odometer" INTEGER,
    "next_due_date" DATE,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_records" (
    "id" TEXT NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "schedule_id" TEXT,
    "service_date" DATE NOT NULL,
    "odometer" INTEGER,
    "kind" "ServiceRecordKind" NOT NULL DEFAULT 'service',
    "description" TEXT NOT NULL,
    "cost" DECIMAL(18,2),
    "provider" VARCHAR(150),
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_renewals" (
    "id" TEXT NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "renewal_type" "VehicleRenewalType" NOT NULL,
    "reference" VARCHAR(120),
    "issue_date" DATE,
    "expiry_date" DATE NOT NULL,
    "cost" DECIMAL(18,2),
    "provider" VARCHAR(150),
    "note" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vehicle_renewals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accident_records" (
    "id" TEXT NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "accident_date" DATE NOT NULL,
    "location" TEXT,
    "severity" "AccidentSeverity" NOT NULL,
    "description" TEXT NOT NULL,
    "driver_employee_id" TEXT,
    "third_party_involved" BOOLEAN NOT NULL DEFAULT false,
    "estimated_cost" DECIMAL(18,2),
    "insurance_claim_reference" VARCHAR(120),
    "police_report_reference" VARCHAR(120),
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accident_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_expenses" (
    "id" TEXT NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "expense_date" DATE NOT NULL,
    "category" "VehicleExpenseCategory" NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "odometer" INTEGER,
    "reference" VARCHAR(120),
    "note" TEXT,
    "source_type" VARCHAR(20),
    "source_id" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vehicle_expenses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vehicles_asset_id_key" ON "vehicles"("asset_id");
CREATE UNIQUE INDEX "vehicles_company_id_registration_number_key" ON "vehicles"("company_id", "registration_number");
CREATE INDEX "vehicles_company_id_idx" ON "vehicles"("company_id");
CREATE INDEX "vehicle_driver_assignments_vehicle_id_idx" ON "vehicle_driver_assignments"("vehicle_id");
CREATE INDEX "vehicle_odometer_readings_vehicle_id_idx" ON "vehicle_odometer_readings"("vehicle_id");
CREATE INDEX "fuel_logs_vehicle_id_idx" ON "fuel_logs"("vehicle_id");
CREATE INDEX "service_schedules_vehicle_id_idx" ON "service_schedules"("vehicle_id");
CREATE INDEX "service_records_vehicle_id_idx" ON "service_records"("vehicle_id");
CREATE INDEX "vehicle_renewals_vehicle_id_idx" ON "vehicle_renewals"("vehicle_id");
CREATE INDEX "accident_records_vehicle_id_idx" ON "accident_records"("vehicle_id");
CREATE INDEX "vehicle_expenses_vehicle_id_idx" ON "vehicle_expenses"("vehicle_id");

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "vehicle_driver_assignments" ADD CONSTRAINT "vehicle_driver_assignments_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "vehicle_odometer_readings" ADD CONSTRAINT "vehicle_odometer_readings_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fuel_logs" ADD CONSTRAINT "fuel_logs_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "service_schedules" ADD CONSTRAINT "service_schedules_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "service_records" ADD CONSTRAINT "service_records_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "service_records" ADD CONSTRAINT "service_records_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "service_schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "vehicle_renewals" ADD CONSTRAINT "vehicle_renewals_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "accident_records" ADD CONSTRAINT "accident_records_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "vehicle_expenses" ADD CONSTRAINT "vehicle_expenses_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
