-- AlterTable
ALTER TABLE "permissions" ADD COLUMN     "domain" VARCHAR(30) NOT NULL DEFAULT 'general';

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
