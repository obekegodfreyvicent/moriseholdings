-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('good', 'service');

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "product_type" "ProductType" NOT NULL DEFAULT 'good';
