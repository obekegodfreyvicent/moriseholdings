-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('percentage', 'fixed');

-- CreateEnum
CREATE TYPE "DiscountCodeStatus" AS ENUM ('active', 'inactive');

-- CreateEnum
CREATE TYPE "ContentBlockStatus" AS ENUM ('draft', 'published');

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "discount_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
ADD COLUMN     "discount_code" VARCHAR(40);

-- CreateTable
CREATE TABLE "discount_codes" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "description" TEXT,
    "discount_type" "DiscountType" NOT NULL,
    "value" DECIMAL(18,2) NOT NULL,
    "min_order_value" DECIMAL(18,2),
    "max_redemptions" INTEGER,
    "times_redeemed" INTEGER NOT NULL DEFAULT 0,
    "starts_at" TIMESTAMP(3),
    "ends_at" TIMESTAMP(3),
    "status" "DiscountCodeStatus" NOT NULL DEFAULT 'active',
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "discount_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promo_banners" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "heading" VARCHAR(160) NOT NULL,
    "body" TEXT,
    "link_url" VARCHAR(500),
    "link_label" VARCHAR(80),
    "placement" VARCHAR(40) NOT NULL DEFAULT 'storefront_home',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "starts_at" TIMESTAMP(3),
    "ends_at" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "promo_banners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_blocks" (
    "id" TEXT NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "body" TEXT NOT NULL,
    "published_body" TEXT,
    "status" "ContentBlockStatus" NOT NULL DEFAULT 'draft',
    "published_at" TIMESTAMP(3),
    "updated_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "discount_codes_company_id_idx" ON "discount_codes"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "discount_codes_company_id_code_key" ON "discount_codes"("company_id", "code");

-- CreateIndex
CREATE INDEX "promo_banners_company_id_idx" ON "promo_banners"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "content_blocks_slug_key" ON "content_blocks"("slug");
