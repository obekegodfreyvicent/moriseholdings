-- One social channel row per platform (2 September 2026): the CMS / Site
-- Builder now shows a fixed roster of every supported platform, each with at
-- most one manageable channel row. Dedupe any existing rows (keep the one
-- with the lowest sort_order, then the earliest created_at), then enforce it.
DELETE FROM "social_links" a
USING "social_links" b
WHERE a."platform" = b."platform"
  AND (
    a."sort_order" > b."sort_order"
    OR (a."sort_order" = b."sort_order" AND a."created_at" > b."created_at")
    OR (a."sort_order" = b."sort_order" AND a."created_at" = b."created_at" AND a."id" > b."id")
  );

CREATE UNIQUE INDEX "social_links_platform_key" ON "social_links"("platform");
