-- Automatic Staff Identification Card (3 September 2026): one live identity
-- card per actively registered administration staff member. Issued
-- automatically on Employee creation, back-filled in bulk by
-- POST /api/v1/staff-id-cards/generate, deactivated when the employee is set
-- inactive. photo_url is a text reference only (object-storage gap);
-- verification_code backs the printed QR / the verify endpoint.

-- CreateEnum
CREATE TYPE "StaffIdCardStatus" AS ENUM ('active', 'revoked', 'expired');

-- CreateTable
CREATE TABLE "staff_id_cards" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "card_number" VARCHAR(40) NOT NULL,
    "verification_code" VARCHAR(64) NOT NULL,
    "status" "StaffIdCardStatus" NOT NULL DEFAULT 'active',
    "issued_on" DATE NOT NULL,
    "expires_on" DATE NOT NULL,
    "revoked_on" DATE,
    "revoked_reason" TEXT,
    "photo_url" VARCHAR(500),
    "issued_by_user_id" TEXT,
    "reissue_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_id_cards_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "staff_id_cards_employee_id_key" ON "staff_id_cards"("employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "staff_id_cards_card_number_key" ON "staff_id_cards"("card_number");

-- CreateIndex
CREATE UNIQUE INDEX "staff_id_cards_verification_code_key" ON "staff_id_cards"("verification_code");

-- CreateIndex
CREATE INDEX "staff_id_cards_company_id_idx" ON "staff_id_cards"("company_id");

-- CreateIndex
CREATE INDEX "staff_id_cards_status_idx" ON "staff_id_cards"("status");

-- AddForeignKey
ALTER TABLE "staff_id_cards" ADD CONSTRAINT "staff_id_cards_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
