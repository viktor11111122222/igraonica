-- DropForeignKey
ALTER TABLE "blog_posts" DROP CONSTRAINT "blog_posts_author_id_fkey";

-- DropForeignKey
ALTER TABLE "visits" DROP CONSTRAINT "visits_checked_in_by_fkey";

-- AlterTable
ALTER TABLE "blog_posts" ALTER COLUMN "author_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "visits" ALTER COLUMN "checked_in_by" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "visits" ADD CONSTRAINT "visits_checked_in_by_fkey" FOREIGN KEY ("checked_in_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
