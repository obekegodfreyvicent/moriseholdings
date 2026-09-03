-- Customer confirmation of receipt on a delivered order (3 September 2026).
-- Once an administrator marks the order `delivered`, the storefront shows a
-- "Confirm receipt" button; the customer clicks it to attest the goods /
-- services arrived in good condition, which auto-issues the Morise e-Stamp
-- on the order's invoice. `delivered_at` is stamped when the order reaches
-- `delivered` (staff status advance, or a completed Morise Logistics
-- delivery).
ALTER TABLE "orders" ADD COLUMN "delivered_at" TIMESTAMP(3);
ALTER TABLE "orders" ADD COLUMN "customer_receipt_confirmed_at" TIMESTAMP(3);
ALTER TABLE "orders" ADD COLUMN "customer_receipt_condition" VARCHAR(20);
ALTER TABLE "orders" ADD COLUMN "customer_receipt_note" TEXT;

-- Back-fill delivered_at for orders already in a delivered state so the
-- confirmation prompt has a sensible date to show.
UPDATE "orders" SET "delivered_at" = "updated_at" WHERE "status" = 'delivered' AND "delivered_at" IS NULL;
