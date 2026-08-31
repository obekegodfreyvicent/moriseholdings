-- Site disclaimer (30 August 2026): the statements shown on the full-page
-- disclaimer gate a signed-out visitor acknowledges before the corporate
-- landing page. Admin-managed, same shape as faq_items.
CREATE TABLE "disclaimer_items" (
    "id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_visible" BOOLEAN NOT NULL DEFAULT true,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "disclaimer_items_pkey" PRIMARY KEY ("id")
);
