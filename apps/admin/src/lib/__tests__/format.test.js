import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  toKey,
  todayKey,
  fromKey,
  mondayOf,
  addDays,
  dayIndex,
  formatHours,
  formatDuration,
  initials,
  ageInYears,
  formatDate,
  DAY_NAMES,
  DAY_SHORT,
  MEALS,
} from '../format';

describe('toKey', () => {
  test('formatira kao YYYY-MM-DD sa vodecim nulama', () => {
    expect(toKey(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(toKey(new Date(2026, 11, 31))).toBe('2026-12-31');
  });

  // Razlog zasto se ne koristi toISOString: istocno od Grinica bi ponoc
  // "pobegla" na prethodni dan.
  test('koristi lokalni datum, ne UTC', () => {
    expect(toKey(new Date(2026, 2, 1, 0, 30))).toBe('2026-03-01');
  });
});

describe('fromKey', () => {
  test('vraca lokalnu ponoc', () => {
    const d = fromKey('2026-08-12');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(7);
    expect(d.getDate()).toBe(12);
    expect(d.getHours()).toBe(0);
  });

  test('u paru sa toKey vraca isti kljuc', () => {
    expect(toKey(fromKey('2026-08-12'))).toBe('2026-08-12');
  });
});

describe('todayKey', () => {
  test('vraca danasnji datum', () => {
    expect(todayKey()).toBe(toKey(new Date()));
  });
});

describe('mondayOf', () => {
  // Nedelja u jelovniku ide od ponedeljka, isto kao na backendu.
  test('vraca ponedeljak te nedelje', () => {
    expect(toKey(mondayOf(fromKey('2026-08-12')))).toBe('2026-08-10'); // sreda
    expect(toKey(mondayOf(fromKey('2026-08-10')))).toBe('2026-08-10'); // vec ponedeljak
    expect(toKey(mondayOf(fromKey('2026-08-15')))).toBe('2026-08-10'); // subota
  });

  // Nedelja je kraj nedelje, ne pocetak - najlakse mesto za gresku.
  test('nedelja pripada nedelji koja je pocela ranije', () => {
    expect(toKey(mondayOf(fromKey('2026-08-16')))).toBe('2026-08-10');
  });

  test('radi preko granice meseca', () => {
    expect(toKey(mondayOf(fromKey('2026-09-01')))).toBe('2026-08-31');
  });

  test('nulira vreme', () => {
    const d = mondayOf(new Date(2026, 7, 12, 15, 30));
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
  });
});

describe('addDays', () => {
  test('pomera datum napred i nazad', () => {
    expect(toKey(addDays(fromKey('2026-08-12'), 1))).toBe('2026-08-13');
    expect(toKey(addDays(fromKey('2026-08-12'), -1))).toBe('2026-08-11');
    expect(toKey(addDays(fromKey('2026-08-12'), 7))).toBe('2026-08-19');
  });

  test('prelazi granicu meseca i godine', () => {
    expect(toKey(addDays(fromKey('2026-08-31'), 1))).toBe('2026-09-01');
    expect(toKey(addDays(fromKey('2026-12-31'), 1))).toBe('2027-01-01');
  });

  test('ne menja prosledjeni datum', () => {
    const original = fromKey('2026-08-12');
    addDays(original, 5);
    expect(toKey(original)).toBe('2026-08-12');
  });
});

describe('dayIndex', () => {
  // Mora da se poklapa sa backendom i sa mobilnom aplikacijom.
  test('ponedeljak je 0, nedelja je 6', () => {
    expect(dayIndex(fromKey('2026-08-10'))).toBe(0);
    expect(dayIndex(fromKey('2026-08-16'))).toBe(6);
  });

  test('pokriva celu nedelju', () => {
    const kljucevi = ['2026-08-10', '2026-08-11', '2026-08-12', '2026-08-13', '2026-08-14', '2026-08-15', '2026-08-16'];
    expect(kljucevi.map((k) => dayIndex(fromKey(k)))).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });
});

describe('formatHours', () => {
  test('jedna decimala sa zarezom', () => {
    expect(formatHours(12.5)).toBe('12,5 h');
    expect(formatHours(20)).toBe('20,0 h');
  });

  test('prazna vrednost je 0', () => {
    expect(formatHours(null)).toBe('0,0 h');
    expect(formatHours(undefined)).toBe('0,0 h');
  });

  // Prisma Decimal stize kao string.
  test('prihvata string iz baze', () => {
    expect(formatHours('12.50')).toBe('12,5 h');
  });
});

describe('formatDuration', () => {
  test('samo minuti kada je manje od sata', () => {
    expect(formatDuration(45)).toBe('45 min');
    expect(formatDuration(0)).toBe('0 min');
  });

  test('pun sat bez minuta', () => {
    expect(formatDuration(60)).toBe('1 h');
    expect(formatDuration(120)).toBe('2 h');
  });

  test('sati i minuti', () => {
    expect(formatDuration(90)).toBe('1 h 30 min');
    expect(formatDuration(155)).toBe('2 h 35 min');
  });

  test('prazna vrednost daje crticu', () => {
    expect(formatDuration(null)).toBe('—');
    expect(formatDuration(undefined)).toBe('—');
  });
});

describe('initials', () => {
  test('prvo slovo imena i prezimena, velikim slovom', () => {
    expect(initials('Marko', 'Markovic')).toBe('MM');
    expect(initials('ana', 'anic')).toBe('AA');
  });

  test('podnosi nedostajuce vrednosti', () => {
    expect(initials('Marko')).toBe('M');
    expect(initials()).toBe('');
    expect(initials('', '')).toBe('');
  });
});

describe('ageInYears', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 12));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('racuna pune godine', () => {
    expect(ageInYears('2020-08-12')).toBe(6);
  });

  test('ne racuna godinu ciji rodjendan jos nije prosao', () => {
    expect(ageInYears('2020-08-13')).toBe(5);
    expect(ageInYears('2020-12-01')).toBe(5);
  });

  // Ista funkcija postoji i u mobilnoj aplikaciji - rezultat mora da se
  // poklapa, inace bi uzrast deteta bio razlicit u panelu i u aplikaciji.
  test('slaze se sa mobilnom racunicom za granicni slucaj', () => {
    expect(ageInYears('2024-08-12')).toBe(2);
  });
});

describe('formatDate', () => {
  test('prazna vrednost daje crticu', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDate('')).toBe('—');
  });

  test('formatira datum', () => {
    expect(formatDate('2026-08-12T10:00:00.000Z')).toMatch(/2026/);
  });
});

describe('konstante', () => {
  test('dani idu od ponedeljka i ima ih sedam', () => {
    expect(DAY_NAMES).toHaveLength(7);
    expect(DAY_NAMES[0]).toBe('Ponedeljak');
    expect(DAY_NAMES[6]).toBe('Nedelja');
    expect(DAY_SHORT).toHaveLength(7);
    expect(DAY_SHORT[0]).toBe('Pon');
  });

  // Redosled i kljucevi moraju da prate MealType enum sa backenda, inace
  // jelovnik u panelu i u aplikaciji ne bi bio isti.
  test('obroci prate backend enum', () => {
    expect(MEALS.map((m) => m.key)).toEqual([
      'BREAKFAST',
      'SNACK_MORNING',
      'LUNCH',
      'SNACK_AFTERNOON',
    ]);
    expect(MEALS.map((m) => m.label)).toEqual([
      'Dorucak',
      'Uzina',
      'Rucak',
      'Popodnevna uzina',
    ]);
  });
});
