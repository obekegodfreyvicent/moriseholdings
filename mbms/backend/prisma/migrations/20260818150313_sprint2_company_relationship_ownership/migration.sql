-- CreateEnum
CREATE TYPE "CompanyRelationship" AS ENUM ('subsidiary', 'associate');

-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "ownership_percent" DECIMAL(5,2),
ADD COLUMN     "relationship_type" "CompanyRelationship";
