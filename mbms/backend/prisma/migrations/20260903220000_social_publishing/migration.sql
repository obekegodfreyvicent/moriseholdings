-- Social Media Publishing (3 September 2026) — the Admin "Social Publishing"
-- section: a mini Buffer / Hootsuite. Write one master post, fan it out to
-- many connected channels in one click with per-platform caption overrides,
-- publish now or schedule, and track per-platform success / failure. The
-- platform publish itself is simulated in this proof-of-concept (no real
-- OAuth or platform API); the connection / post / target / partial-failure /
-- retry / dashboard shape is real. See docx/24.

-- CreateEnum
CREATE TYPE "SocialPostStatus" AS ENUM ('draft', 'scheduled', 'publishing', 'published', 'partially_failed', 'failed');
CREATE TYPE "SocialTargetStatus" AS ENUM ('pending', 'publishing', 'success', 'failed', 'skipped');
CREATE TYPE "SocialMediaType" AS ENUM ('none', 'image', 'video', 'link');

-- CreateTable
CREATE TABLE "social_connections" (
    "platform" "SocialPlatform" NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'connected',
    "account_label" VARCHAR(160),
    "connected_by" TEXT NOT NULL,
    "connected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "token_expires_at" TIMESTAMP(3),
    "access_token_ref" VARCHAR(120),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "social_connections_pkey" PRIMARY KEY ("platform")
);

-- CreateTable
CREATE TABLE "social_posts" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(160),
    "body_master" TEXT NOT NULL,
    "media_type" "SocialMediaType" NOT NULL DEFAULT 'none',
    "media_url" VARCHAR(1000),
    "link_url" VARCHAR(1000),
    "status" "SocialPostStatus" NOT NULL DEFAULT 'draft',
    "scheduled_for" TIMESTAMP(3),
    "published_at" TIMESTAMP(3),
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "social_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_post_targets" (
    "id" TEXT NOT NULL,
    "post_id" TEXT NOT NULL,
    "platform" "SocialPlatform" NOT NULL,
    "caption" TEXT,
    "status" "SocialTargetStatus" NOT NULL DEFAULT 'pending',
    "external_id" VARCHAR(120),
    "external_url" VARCHAR(1000),
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_attempt_at" TIMESTAMP(3),
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "social_post_targets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "social_posts_status_idx" ON "social_posts"("status");
CREATE INDEX "social_post_targets_post_id_idx" ON "social_post_targets"("post_id");
CREATE UNIQUE INDEX "social_post_targets_post_id_platform_key" ON "social_post_targets"("post_id", "platform");

-- AddForeignKey
ALTER TABLE "social_post_targets" ADD CONSTRAINT "social_post_targets_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "social_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
