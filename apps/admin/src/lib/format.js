// Formatiranje datuma, vremena i brojeva - sve u sr-RS.

export function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('sr-RS', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function formatDateTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('sr-RS', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleTimeString('sr-RS', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Datumi se svuda racunaju u lokalnoj zoni. toISOString() bi vratio UTC, pa bi
// posle ponoci (kod nas UTC+1/+2) "danas" bio jucerasnji datum.
export function toKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function todayKey() {
  return toKey(new Date());
}

// "2026-08-12" -> Date u lokalnoj zoni (new Date(string) bi bio UTC ponoc).
export function fromKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// Ponedeljak nedelje kojoj pripada datum.
export function mondayOf(date) {
  const d = new Date(date);
  const js = d.getDay();
  d.setDate(d.getDate() - (js === 0 ? 6 : js - 1));
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

// 0 = ponedeljak, kako to ocekuje backend (JS getDay() ima 0 = nedelja).
export function dayIndex(date) {
  const js = date.getDay();
  return js === 0 ? 6 : js - 1;
}

export function formatHours(value) {
  const n = Number(value ?? 0);
  return `${n.toFixed(1).replace('.', ',')} h`;
}

export function formatDuration(minutes) {
  if (minutes == null) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

export function initials(firstName = '', lastName = '') {
  return `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase();
}

export function ageInYears(dateOfBirth) {
  const today = new Date();
  const birth = new Date(dateOfBirth);
  let years = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) years--;
  return years;
}

export const DAY_NAMES = [
  'Ponedeljak',
  'Utorak',
  'Sreda',
  'Cetvrtak',
  'Petak',
  'Subota',
  'Nedelja',
];

export const DAY_SHORT = ['Pon', 'Uto', 'Sre', 'Cet', 'Pet', 'Sub', 'Ned'];

export const MEALS = [
  { key: 'BREAKFAST', label: 'Dorucak' },
  { key: 'SNACK_MORNING', label: 'Uzina' },
  { key: 'LUNCH', label: 'Rucak' },
  { key: 'SNACK_AFTERNOON', label: 'Popodnevna uzina' },
];

export const RESERVATION_TYPES = [
  { key: 'BIRTHDAY', label: 'Rodjendan' },
  { key: 'PRIVATE_EVENT', label: 'Privatna proslava' },
  { key: 'GROUP_BOOKING', label: 'Grupna poseta' },
];

export const RESERVATION_STATUSES = [
  { key: 'PENDING', label: 'Na cekanju', tone: 'amber' },
  { key: 'CONFIRMED', label: 'Potvrdjeno', tone: 'green' },
  { key: 'CANCELLED', label: 'Otkazano', tone: 'red' },
];

export const VISIT_STATUSES = {
  CHECKED_IN: { label: 'U igraonici', tone: 'green' },
  CHECKED_OUT: { label: 'Odjavljen', tone: 'gray' },
  AUTO_CLOSED: { label: 'Auto-zatvoreno', tone: 'amber' },
};
