// Datumi se svuda racunaju u lokalnoj zoni.
// Pazi: date.toISOString() vraca UTC, pa bi posle ponoci (kod nas UTC+1/+2)
// "danas" bio jucerasnji datum. Zato rucno sastavljamo kljuc.
export function toKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Kljuc danasnjeg dana, u istom formatu u kom backend vraca kljuceve nedelje.
export function todayKey() {
  return toKey(new Date());
}

// 0 = ponedeljak, kako to ocekuje backend (JS getDay() ima 0 = nedelja).
export function dayIndex(date) {
  const js = date.getDay();
  return js === 0 ? 6 : js - 1;
}

// Broj dana u mesecu; month je 1-12.
export function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

// Uzrast u punim godinama.
export function ageInYears(dateOfBirth) {
  const today = new Date();
  const birth = new Date(dateOfBirth);
  let years = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) years--;
  return years;
}

// 1 godina, 2 godine, 5 godina.
export function yearsLabel(n) {
  const last = n % 10;
  const last2 = n % 100;
  if (last === 1 && last2 !== 11) return `${n} godina`;
  if (last >= 2 && last <= 4 && (last2 < 12 || last2 > 14)) return `${n} godine`;
  return `${n} godina`;
}

// Svi dani meseca kom pripada prosledjeni datum.
export function monthDates(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const count = new Date(year, month + 1, 0).getDate();
  return Array.from({ length: count }, (_, i) => new Date(year, month, i + 1));
}
