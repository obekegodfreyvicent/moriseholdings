-- CreateEnum
CREATE TYPE "AccountSubType" AS ENUM ('cash', 'bank', 'receivable', 'payable');

-- AlterTable
ALTER TABLE "accounts" ADD COLUMN     "account_sub_type" "AccountSubType";
