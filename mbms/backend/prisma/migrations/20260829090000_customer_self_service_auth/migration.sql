-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "self_registered" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "google_linked" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "customer_password_reset_tokens" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "token_hash" VARCHAR(255) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "customer_password_reset_tokens_customer_id_idx" ON "customer_password_reset_tokens"("customer_id");

-- CreateIndex
CREATE INDEX "customer_password_reset_tokens_token_hash_idx" ON "customer_password_reset_tokens"("token_hash");

-- AddForeignKey
ALTER TABLE "customer_password_reset_tokens" ADD CONSTRAINT "customer_password_reset_tokens_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
