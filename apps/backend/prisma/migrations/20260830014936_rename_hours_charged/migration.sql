-- Kolona nosi naplacene sate, ne "skinute sa paketa": kad paket ne pokrije ceo
-- boravak, ovde stoji pun iznos, a razlika je u `debt_hours`. Staro ime je
-- navodilo na pogresno citanje u izvestajima.
--
-- Rucno pisana migracija: Prisma bi za promenu imena predlozila brisanje i
-- dodavanje kolone, sto bi odnelo podatke o svim dosadasnjim posetama.
ALTER TABLE "visits" RENAME COLUMN "hours_deducted" TO "hours_charged";
