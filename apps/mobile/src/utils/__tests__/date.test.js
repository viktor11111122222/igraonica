import { toKey, todayKey, fromKey, dayIndex, daysInMonth, ageInYears, yearsLabel, monthDates, formatTime} from '../date';

describe('toKey', () => {
  test('formatira kao YYYY-MM-DD sa vodecim nulama', () => {
    expect(toKey(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(toKey(new Date(2026, 11, 31))).toBe('2026-12-31');
  });

  // Ovo je razlog zasto toKey ne koristi toISOString. Datum se sastavlja iz
  // lokalnih komponenti, pa istocno od Grinica ponoc ne "pobegne" na juce.
  // Test prolazi u svakoj vremenskoj zoni jer se oslanja na lokalne gettere.
  test('koristi lokalni datum, ne UTC', () => {
    const tridesetMinutaPoslePonoci = new Date(2026, 2, 1, 0, 30);
    expect(toKey(tridesetMinutaPoslePonoci)).toBe('2026-03-01');
  });

  test('poslednji minut dana i dalje pripada tom danu', () => {
    expect(toKey(new Date(2026, 7, 12, 23, 59, 59))).toBe('2026-08-12');
  });
});

describe('todayKey', () => {
  test('vraca danasnji datum u istom formatu', () => {
    expect(todayKey()).toBe(toKey(new Date()));
    expect(todayKey()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('fromKey', () => {
  test('vraca lokalnu ponoc, ne UTC ponoc', () => {
    const d = fromKey('2026-08-12');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(7);
    expect(d.getDate()).toBe(12);
    expect(d.getHours()).toBe(0);
  });

  test('u paru sa toKey vraca isti kljuc', () => {
    for (const key of ['2026-01-01', '2026-06-15', '2026-12-31']) {
      expect(toKey(fromKey(key))).toBe(key);
    }
  });
});

describe('dayIndex', () => {
  // Backend ocekuje 0 = ponedeljak, dok JS getDay() ima 0 = nedelja.
  test('ponedeljak je 0, nedelja je 6', () => {
    expect(dayIndex(fromKey('2026-08-10'))).toBe(0); // ponedeljak
    expect(dayIndex(fromKey('2026-08-16'))).toBe(6); // nedelja
  });

  test('pokriva celu nedelju redom', () => {
    const dani = ['2026-08-10', '2026-08-11', '2026-08-12', '2026-08-13', '2026-08-14', '2026-08-15', '2026-08-16'];
    expect(dani.map((k) => dayIndex(fromKey(k)))).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });
});

describe('daysInMonth', () => {
  test('racuna duzinu meseca', () => {
    expect(daysInMonth(2026, 1)).toBe(31);
    expect(daysInMonth(2026, 4)).toBe(30);
    expect(daysInMonth(2026, 8)).toBe(31);
  });

  test('hvata prestupnu godinu', () => {
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2000, 2)).toBe(29);
    expect(daysInMonth(1900, 2)).toBe(28);
  });
});

describe('ageInYears', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 7, 12));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('racuna pune godine', () => {
    expect(ageInYears('2020-08-12')).toBe(6);
    expect(ageInYears('2021-01-01')).toBe(5);
  });

  test('ne racuna godinu ciji rodjendan jos nije prosao', () => {
    expect(ageInYears('2020-08-13')).toBe(5);
    expect(ageInYears('2020-12-31')).toBe(5);
  });

  test('rodjendan bas danas se racuna', () => {
    expect(ageInYears('2024-08-12')).toBe(2);
  });

  test('beba mladja od godinu dana ima 0', () => {
    expect(ageInYears('2026-03-01')).toBe(0);
  });
});

describe('yearsLabel', () => {
  test('jednina za brojeve koji se zavrsavaju na 1', () => {
    expect(yearsLabel(1)).toBe('1 godina');
    expect(yearsLabel(21)).toBe('21 godina');
  });

  test('mnozina "godine" za 2, 3 i 4', () => {
    expect(yearsLabel(2)).toBe('2 godine');
    expect(yearsLabel(3)).toBe('3 godine');
    expect(yearsLabel(4)).toBe('4 godine');
    expect(yearsLabel(22)).toBe('22 godine');
  });

  test('mnozina "godina" za 5 i vise', () => {
    expect(yearsLabel(5)).toBe('5 godina');
    expect(yearsLabel(0)).toBe('0 godina');
  });

  // 11-14 su izuzetak: iako se zavrsavaju na 1-4, idu uz "godina".
  test('brojevi 11-14 su izuzetak', () => {
    expect(yearsLabel(11)).toBe('11 godina');
    expect(yearsLabel(12)).toBe('12 godina');
    expect(yearsLabel(13)).toBe('13 godina');
    expect(yearsLabel(14)).toBe('14 godina');
  });
});

describe('monthDates', () => {
  test('vraca sve dane meseca kom datum pripada', () => {
    const dani = monthDates(new Date(2026, 7, 12));
    expect(dani).toHaveLength(31);
    expect(toKey(dani[0])).toBe('2026-08-01');
    expect(toKey(dani[30])).toBe('2026-08-31');
  });

  test('radi i za februar prestupne godine', () => {
    const dani = monthDates(new Date(2024, 1, 10));
    expect(dani).toHaveLength(29);
    expect(toKey(dani[28])).toBe('2024-02-29');
  });
});

describe('formatTime', () => {
  test('daje sat i minut', () => {
    expect(formatTime('2026-08-22T15:22:00')).toMatch(/15[:.]22/);
  });

  test('prazna vrednost ne daje "Invalid Date"', () => {
    expect(formatTime(null)).toBe('');
    expect(formatTime(undefined)).toBe('');
    expect(formatTime('')).toBe('');
  });
});
