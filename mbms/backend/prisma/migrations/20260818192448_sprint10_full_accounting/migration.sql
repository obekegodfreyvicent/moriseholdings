-- CreateTable
CREATE TABLE "recurring_journal_entries" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" TEXT NOT NULL,
    "last_generated_at" TIMESTAMP(3),
    "times_generated" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recurring_journal_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recurring_journal_entry_items" (
    "id" TEXT NOT NULL,
    "recurring_journal_entry_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "debit_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "credit_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "description" TEXT,

    CONSTRAINT "recurring_journal_entry_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "recurring_journal_entries_company_id_idx" ON "recurring_journal_entries"("company_id");

-- CreateIndex
CREATE INDEX "recurring_journal_entry_items_recurring_journal_entry_id_idx" ON "recurring_journal_entry_items"("recurring_journal_entry_id");

-- AddForeignKey
ALTER TABLE "recurring_journal_entry_items" ADD CONSTRAINT "recurring_journal_entry_items_recurring_journal_entry_id_fkey" FOREIGN KEY ("recurring_journal_entry_id") REFERENCES "recurring_journal_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_journal_entry_items" ADD CONSTRAINT "recurring_journal_entry_items_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
