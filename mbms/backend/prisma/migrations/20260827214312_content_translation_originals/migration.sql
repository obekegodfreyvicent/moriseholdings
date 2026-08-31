-- AlterTable
ALTER TABLE "delivery_addresses" ADD COLUMN     "address_line_original" TEXT,
ADD COLUMN     "label_original" TEXT,
ADD COLUMN     "source_language" VARCHAR(12) NOT NULL DEFAULT 'en';

-- AlterTable
ALTER TABLE "support_tickets" ADD COLUMN     "description_original" TEXT,
ADD COLUMN     "source_language" VARCHAR(12) NOT NULL DEFAULT 'en',
ADD COLUMN     "subject_original" TEXT;

-- AlterTable
ALTER TABLE "ticket_messages" ADD COLUMN     "message_original" TEXT,
ADD COLUMN     "source_language" VARCHAR(12) NOT NULL DEFAULT 'en';
