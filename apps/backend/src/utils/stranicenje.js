// Stranicenje sa gornjom granicom.
//
// Bez granice `?limit=100000` povuce celu tabelu odjednom - dovoljno da jedan
// zahtev zauzme server i memoriju. Sto stavki je vise nego sto ijedan ekran
// prikazuje.
const NAJVISE = 100;
const PODRAZUMEVANO = 20;

function stranicenje(query = {}, podrazumevano = PODRAZUMEVANO) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const trazeno = parseInt(query.limit, 10) || podrazumevano;
  const limit = Math.min(NAJVISE, Math.max(1, trazeno));

  return { page, limit, skip: (page - 1) * limit };
}

module.exports = { stranicenje, NAJVISE };
