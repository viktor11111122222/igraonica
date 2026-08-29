/*
  Warnings:

  - You are about to drop the column `ends_at` on the `promo_banners` table. All the data in the column will be lost.
  - You are about to drop the column `starts_at` on the `promo_banners` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "promo_banners_is_active_starts_at_ends_at_idx";

-- AlterTable
ALTER TABLE "promo_banners" DROP COLUMN "ends_at",
DROP COLUMN "starts_at";

-- CreateIndex
CREATE INDEX "promo_banners_is_active_idx" ON "promo_banners"("is_active");
