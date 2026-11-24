-- AlterTable
ALTER TABLE "users" ADD COLUMN     "consent_reminder" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "contact_reminder_hidden_at" TIMESTAMP(3);
