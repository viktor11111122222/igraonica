-- Jedno dete moze imati najvise jednu otvorenu posetu.
--
-- Provera "da li je vec prijavljeno" je do sada bila citanje pa upis, bez
-- brave izmedju. Dva skeniranja u istom trenutku (dva radnika, ili dupli
-- dodir) prolazila su oba i pravila dve otvorene posete za isto dete - pa se
-- dete pojavljivalo dvaput medju prisutnima, a odjava je zatvarala samo jednu.
--
-- Delimicni jedinstveni indeks to sprecava na nivou baze, gde trke nema.
-- Prisma ne ume da opise delimicni indeks u schema.prisma, pa ide rucno.
CREATE UNIQUE INDEX "visits_one_open_per_child"
  ON "visits" ("child_id")
  WHERE "status" = 'CHECKED_IN';
