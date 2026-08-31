-- Content localisation (29 August 2026): the order cancellation reason a
-- customer types is stored in English, with the customer's exact original
-- and its source language kept — the same shape delivery_addresses /
-- support_tickets / customers already use.
ALTER TABLE "orders"
  ADD COLUMN "cancellation_reason_original" TEXT,
  ADD COLUMN "cancellation_source_language" VARCHAR(12);
