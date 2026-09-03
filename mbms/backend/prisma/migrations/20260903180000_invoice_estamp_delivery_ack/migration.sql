-- Morise e-Stamp on a customer-acknowledged delivery (3 September 2026).
-- After a delivery is `delivered`, the customer confirms — through the
-- portal — that the goods / services arrived in good condition. A "good"
-- acknowledgement automatically stamps the order's invoice with a Morise
-- e-Stamp (stamp_number MOR-ESTAMP-YYYY-NNNNNN); a damaged / incomplete /
-- not-received acknowledgement opens a delivery exception and issues no
-- stamp.

-- Invoice e-Stamp
ALTER TABLE "invoices" ADD COLUMN "stamped_at" TIMESTAMP(3);
ALTER TABLE "invoices" ADD COLUMN "stamp_number" VARCHAR(40);
ALTER TABLE "invoices" ADD COLUMN "stamp_condition" VARCHAR(20);
CREATE UNIQUE INDEX "invoices_stamp_number_key" ON "invoices"("stamp_number");

-- Delivery customer acknowledgement
ALTER TABLE "deliveries" ADD COLUMN "customer_ack_condition" VARCHAR(20);
ALTER TABLE "deliveries" ADD COLUMN "customer_ack_at" TIMESTAMP(3);
ALTER TABLE "deliveries" ADD COLUMN "customer_ack_note" TEXT;
ALTER TABLE "deliveries" ADD COLUMN "customer_ack_by" TEXT;
ALTER TABLE "deliveries" ADD COLUMN "exception_opened_at" TIMESTAMP(3);
