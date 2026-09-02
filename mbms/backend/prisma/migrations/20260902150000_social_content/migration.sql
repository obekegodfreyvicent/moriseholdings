-- Shared social media content (2 September 2026): one canonical record that
-- Admin » CMS / Site Builder pushes to every social channel in a single
-- click, so all channels carry the same information. Singleton — id always
-- "default".
CREATE TABLE "social_content" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "handle" VARCHAR(120),
    "display_name" VARCHAR(120),
    "tagline" VARCHAR(300),
    "is_visible" BOOLEAN NOT NULL DEFAULT true,
    "updated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "social_content_pkey" PRIMARY KEY ("id")
);
