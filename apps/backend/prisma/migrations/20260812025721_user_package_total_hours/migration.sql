-- Dodeljeni paket pamti svoj ukupan broj sati, umesto da ga cita iz sablona.
-- Bez ovoga izmena paketa u adminu unazad kvari racunicu vec dodeljenih
-- paketa: "iskorisceno" se racuna kao ukupno - preostalo, pa promena ukupnog
-- broja sati menja i iskorisceno, iako se nista nije potrosilo.
ALTER TABLE "user_packages" ADD COLUMN "total_hours" DECIMAL(10,2);

-- Za postojece redove uzmi trenutnu vrednost iz sablona; bolja procena ne
-- postoji, a preostali sati ne smeju da premase ukupne.
UPDATE "user_packages" up
SET "total_hours" = GREATEST(p."total_hours", up."remaining_hours")
FROM "packages" p
WHERE up."package_id" = p."id";

UPDATE "user_packages" SET "total_hours" = "remaining_hours" WHERE "total_hours" IS NULL;

ALTER TABLE "user_packages" ALTER COLUMN "total_hours" SET NOT NULL;
