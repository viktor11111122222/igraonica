// Vreme u danu kao "HH:MM".
//
// Aktivnosti i rezervacije se cuvaju kao tekst, pa se porede kao minuti od
// ponoci - poredjenje tekstova bi radilo samo dok su oba u istom formatu, a
// "9:00" i "09:00" bi ga oborila.

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

function minutiOdPonoci(vreme) {
  if (!HHMM.test(String(vreme || ''))) return null;
  const [sati, minuti] = String(vreme).split(':').map(Number);
  return sati * 60 + minuti;
}

// Da li je kraj posle pocetka. Nepoznato vreme (ili los format) vraca `true`,
// jer o formatu vec brine svoja provera - ova ne sme da javlja istu gresku
// drugim recima.
function krajPoslePocetka(pocetak, kraj) {
  const p = minutiOdPonoci(pocetak);
  const k = minutiOdPonoci(kraj);
  if (p === null || k === null) return true;
  return k > p;
}

module.exports = { HHMM, minutiOdPonoci, krajPoslePocetka };
