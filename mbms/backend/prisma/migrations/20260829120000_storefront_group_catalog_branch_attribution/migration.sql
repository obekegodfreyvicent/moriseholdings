-- Storefront group catalogue (29 August 2026):
--  * products.branch_id      — the branch of the owning subsidiary that
--                              produces / stocks / fulfils the product
--  * customers.home_branch_id — the branch of the customer's own subsidiary
--                              that serves the account
--  * a real FK from orders.company_id to companies (relation only, the
--    column already existed) so an order can be labelled "sold by <company>"

-- AlterTable
ALTER TABLE "products" ADD COLUMN "branch_id" TEXT;

-- AlterTable
ALTER TABLE "customers" ADD COLUMN "home_branch_id" TEXT;

-- CreateIndex
CREATE INDEX "products_branch_id_idx" ON "products"("branch_id");

-- CreateIndex
CREATE INDEX "customers_home_branch_id_idx" ON "customers"("home_branch_id");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_home_branch_id_fkey" FOREIGN KEY ("home_branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
