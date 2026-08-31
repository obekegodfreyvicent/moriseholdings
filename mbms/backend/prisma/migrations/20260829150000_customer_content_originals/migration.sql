-- Content localisation for customer-typed profile fields (29 August 2026):
-- customers.name and customers.address are stored in English; when the
-- customer typed them in another language, keep the source language and the
-- original wording so an admin reads English and the storefront can show the
-- customer their own words back (same shape as delivery_addresses).

-- AlterTable
ALTER TABLE "customers" ADD COLUMN "source_language" VARCHAR(12) NOT NULL DEFAULT 'en',
ADD COLUMN "name_original" TEXT,
ADD COLUMN "address_original" TEXT;
