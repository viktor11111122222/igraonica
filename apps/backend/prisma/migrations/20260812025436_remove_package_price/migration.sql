-- Cena se ne vodi u aplikaciji: naplata ide preko racuna, van sistema.
-- Aplikacija sluzi samo za pracenje paketa i sati.
ALTER TABLE "packages" DROP COLUMN "price";
