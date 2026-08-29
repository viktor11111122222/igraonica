-- AlterTable
ALTER TABLE "users" ADD COLUMN     "debt_hours" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "visits" ADD COLUMN     "debt_hours" DECIMAL(10,2);

-- Naplata vise ne zaokruzuje na korak minuta i nema najmanju naplatu u
-- minutima: boravak se racuna u punim satima, sa pragom minuta preko punog
-- sata. Stare vrednosti se brisu da ne bi visile u bazi bez ijednog citaoca.
DELETE FROM "settings" WHERE "key" IN ('rounding_minutes', 'minimum_charge_minutes');
