-- DropForeignKey
ALTER TABLE "customer_invoice_items" DROP CONSTRAINT "customer_invoice_items_invoice_id_fkey";

-- DropForeignKey
ALTER TABLE "customer_payment_applications" DROP CONSTRAINT "customer_payment_applications_invoice_id_fkey";

-- DropForeignKey
ALTER TABLE "customer_payment_applications" DROP CONSTRAINT "customer_payment_applications_payment_id_fkey";

-- AlterTable
ALTER TABLE "customer_credit_notes" ADD COLUMN     "financial_period_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "customer_debit_notes" ADD COLUMN     "financial_period_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "supplier_credit_notes" ADD COLUMN     "financial_period_id" TEXT NOT NULL;

-- DropTable
DROP TABLE "customer_invoice_items";

-- DropTable
DROP TABLE "customer_invoices";

-- DropTable
DROP TABLE "customer_payment_applications";

-- DropTable
DROP TABLE "customer_payments";

-- DropEnum
DROP TYPE "ARInvoiceStatus";

