const { startOfDay, endOfDay, addDays, toKey } = require('../src/utils/day');

// Ovi pomocnici postoje zato sto je dashboard racunao dan po UTC-u, pa je kod
// nas (UTC+1/+2) "danas" pocinjalo u 01:00 ili 02:00.

describe('startOfDay', () => {
  test('vraca lokalnu ponoc', () => {
    const d = startOfDay(new Date(2026, 7, 13, 15, 42, 30, 500));

    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(7);
    expect(d.getDate()).toBe(13);
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
    expect(d.getSeconds()).toBe(0);
    expect(d.getMilliseconds()).toBe(0);
  });

  test('ne menja prosledjeni datum', () => {
    const original = new Date(2026, 7, 13, 15, 42);
    startOfDay(original);
    expect(original.getHours()).toBe(15);
  });

  test('bez argumenta radi sa danasnjim danom', () => {
    const d = startOfDay();
    expect(d.getHours()).toBe(0);
    expect(toKey(d)).toBe(toKey(new Date()));
  });

  // Vreme tik posle ponoci mora da ostane u istom danu. Sa UTC racunicom bi
  // kod nas ispalo da pripada prethodnom danu.
  test('pola jedan ujutru pripada tom istom danu', () => {
    const d = startOfDay(new Date(2026, 7, 13, 0, 30));
    expect(toKey(d)).toBe('2026-08-13');
  });
});

describe('endOfDay', () => {
  test('vraca poslednji trenutak dana', () => {
    const d = endOfDay(new Date(2026, 7, 13, 8, 0));

    expect(d.getHours()).toBe(23);
    expect(d.getMinutes()).toBe(59);
    expect(d.getSeconds()).toBe(59);
    expect(d.getMilliseconds()).toBe(999);
    expect(d.getDate()).toBe(13);
  });

  test('pocetak i kraj dana obuhvataju ponoc i 23:59', () => {
    const dan = new Date(2026, 7, 13, 12, 0);
    const pocetak = startOfDay(dan);
    const kraj = endOfDay(dan);

    const uPolaJedan = new Date(2026, 7, 13, 0, 30);
    const predPonoc = new Date(2026, 7, 13, 23, 45);

    expect(uPolaJedan >= pocetak && uPolaJedan <= kraj).toBe(true);
    expect(predPonoc >= pocetak && predPonoc <= kraj).toBe(true);
  });

  test('juce i sutra ispadaju iz opsega', () => {
    const dan = new Date(2026, 7, 13, 12, 0);
    const pocetak = startOfDay(dan);
    const kraj = endOfDay(dan);

    const juce = new Date(2026, 7, 12, 23, 59);
    const sutra = new Date(2026, 7, 14, 0, 1);

    expect(juce >= pocetak).toBe(false);
    expect(sutra <= kraj).toBe(false);
  });
});

describe('addDays', () => {
  test('pomera napred i nazad', () => {
    expect(toKey(addDays(new Date(2026, 7, 13), 1))).toBe('2026-08-14');
    expect(toKey(addDays(new Date(2026, 7, 13), -1))).toBe('2026-08-12');
    expect(toKey(addDays(new Date(2026, 7, 13), -6))).toBe('2026-08-07');
  });

  test('prelazi granicu meseca i godine', () => {
    expect(toKey(addDays(new Date(2026, 7, 31), 1))).toBe('2026-09-01');
    expect(toKey(addDays(new Date(2026, 11, 31), 1))).toBe('2027-01-01');
  });

  test('ne menja prosledjeni datum', () => {
    const original = new Date(2026, 7, 13);
    addDays(original, 5);
    expect(toKey(original)).toBe('2026-08-13');
  });
});

describe('toKey', () => {
  test('formatira sa vodecim nulama', () => {
    expect(toKey(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(toKey(new Date(2026, 11, 31))).toBe('2026-12-31');
  });

  // Zbog ovoga se ne koristi toISOString: kod nas bi vece posle 22h ispalo
  // kao sutrasnji dan.
  test('vece ostaje u istom danu', () => {
    expect(toKey(new Date(2026, 7, 13, 23, 30))).toBe('2026-08-13');
  });

  test('rano jutro ostaje u istom danu', () => {
    expect(toKey(new Date(2026, 7, 13, 0, 15))).toBe('2026-08-13');
  });

  test('prima i Date i vrednost iz baze', () => {
    const d = new Date(2026, 7, 13, 10, 0);
    expect(toKey(d)).toBe(toKey(new Date(d.getTime())));
  });
});
