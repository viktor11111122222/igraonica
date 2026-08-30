// Naziv tipa rezervacije onako kako ga vidi roditelj.
//
// Isti spisak stoji u panelu (apps/admin/src/lib/format.js). Kod tipa "Drugo"
// osoblje upisuje svoj naziv, pa se prikazuje on - "Drugo" samo po sebi ne
// govori nista.
const NAZIVI = {
  BIRTHDAY: 'Rodjendan',
  PRIVATE_EVENT: 'Privatna proslava',
  GROUP_BOOKING: 'Grupna poseta',
  MONTHLY_EVENT: 'Mesecni dogadjaji',
  OTHER: 'Drugo',
};

function nazivTipa(rezervacija) {
  if (rezervacija.type === 'OTHER') return rezervacija.customType || NAZIVI.OTHER;
  return NAZIVI[rezervacija.type] || NAZIVI.OTHER;
}

module.exports = { NAZIVI, nazivTipa };
