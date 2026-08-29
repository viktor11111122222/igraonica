-- AlterEnum
ALTER TYPE "EventType" ADD VALUE 'OTHER';

-- AlterTable
ALTER TABLE "events" ADD COLUMN     "custom_type" TEXT;
