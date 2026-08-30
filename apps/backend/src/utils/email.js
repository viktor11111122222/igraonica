// Email je jedinstven bez obzira na velika slova: "Ana@x.rs" i "ana@x.rs" su
// isti nalog. Bez ovoga bi se pravila dva naloga, a prijava sa drugacije
// otkucanim slovima ne bi prosla.
function normalizujEmail(email) {
  return String(email ?? '').trim().toLowerCase();
}

// Trazenje po emailu ignorise velika slova, pa i nalozi upisani pre ovog
// pravila mogu da se prijave.
function poEmailu(email) {
  return { email: { equals: normalizujEmail(email), mode: 'insensitive' } };
}

module.exports = { normalizujEmail, poEmailu };
