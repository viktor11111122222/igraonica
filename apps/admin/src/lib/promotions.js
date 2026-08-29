// Prikaz akcija. Stoji van stranice jer je i stranica i test koriste, a
// stranica sme da izvozi samo komponentu (fast refresh).

export function danas() {
  return new Date().toISOString().split('T')[0];
}

// Koliko je popust, u obliku u kom se cita. Opisne akcije nemaju broj - sve
// pise u nazivu, pa se tu ne izmislja vrednost.
export function popustLabel(p) {
  if (p.discountType === 'TEXT') return '—';
  if (p.discountType === 'AMOUNT') return `${p.discountValue} RSD`;
  return `${p.discountValue}%`;
}

// Stanje se ne cuva u bazi nego se racuna iz datuma - inace bi neko morao
// rucno da gasi svaku akciju kad istekne.
export function stanje(p, dan = danas()) {
  if (!p.isActive) return { key: 'off', label: 'Iskljucena' };
  if (p.dateTo < dan) return { key: 'past', label: 'Istekla' };
  if (p.dateFrom > dan) return { key: 'future', label: 'Zakazana' };
  return { key: 'live', label: 'Traje' };
}
