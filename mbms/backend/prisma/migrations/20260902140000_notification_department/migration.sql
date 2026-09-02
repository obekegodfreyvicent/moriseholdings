-- Notifications & Alerts: route mirrored alert notifications by department
-- (2 September 2026). Nullable; null = company-wide / no department dimension.
ALTER TABLE "notifications" ADD COLUMN "department_id" TEXT;
CREATE INDEX "notifications_user_id_department_id_idx" ON "notifications"("user_id", "department_id");
