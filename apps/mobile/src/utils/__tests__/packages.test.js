import { isValid, isUsable, summarize } from '../packages';

// Paketi se prave relativno na "sada", da testovi ne istrunu s vremenom.
const danaOdSad = (n) => new Date(Date.now() + n * 24 * 60 * 60 * 1000).toISOString();

const paket = (over = {}) => ({
  id: 'p1',
  isActive: true,
  totalHours: 10,
  remainingHours: 10,
  expiresAt: danaOdSad(30),
  ...over,
});

describe('isValid', () => {
  test('vazi kada je aktivan i rok nije prosao', () => {
    expect(isValid(paket())).toBe(true);
  });

  test('ne vazi kada je neaktivan', () => {
    expect(isValid(paket({ isActive: false }))).toBe(false);
  });

  test('ne vazi kada je rok prosao', () => {
    expect(isValid(paket({ expiresAt: danaOdSad(-1) }))).toBe(false);
  });

  // Potrosen paket i dalje "vazi" - njegovi sati ulaze u racunicu
  // iskorisceno/ukupno, inace bi zbir posle trosenja skakao.
  test('potrosen paket i dalje vazi', () => {
    expect(isValid(paket({ remainingHours: 0 }))).toBe(true);
  });
});

describe('isUsable', () => {
  test('moze da se koristi dok ima preostalih sati', () => {
    expect(isUsable(paket({ remainingHours: 2 }))).toBe(true);
  });

  test('ne moze kada je potrosen', () => {
    expect(isUsable(paket({ remainingHours: 0 }))).toBe(false);
  });

  test('ne moze kada je istekao, iako ima sati', () => {
    expect(isUsable(paket({ remainingHours: 5, expiresAt: danaOdSad(-1) }))).toBe(false);
  });
});

describe('summarize', () => {
  test('prazna lista daje nule i hasAny false', () => {
    const s = summarize([]);
    expect(s.total).toBe(0);
    expect(s.remaining).toBe(0);
    expect(s.spent).toBe(0);
    expect(s.progress).toBe(0);
    expect(s.hasAny).toBe(false);
    expect(s.current).toBeNull();
    expect(s.expiresAt).toBeNull();
  });

  test('bez argumenta ne puca', () => {
    expect(summarize().total).toBe(0);
  });

  test('racuna ukupno, preostalo i iskorisceno', () => {
    const s = summarize([paket({ totalHours: 15, remainingHours: 12.5 })]);
    expect(s.total).toBe(15);
    expect(s.remaining).toBe(12.5);
    expect(s.spent).toBe(2.5);
    expect(s.progress).toBeCloseTo(12.5 / 15);
  });

  // Roditelj moze da dokupi paket pre nego sto stari istekne.
  test('sabira vise paketa koji vaze', () => {
    const s = summarize([
      paket({ id: 'a', totalHours: 10, remainingHours: 4 }),
      paket({ id: 'b', totalHours: 20, remainingHours: 20 }),
    ]);
    expect(s.total).toBe(30);
    expect(s.remaining).toBe(24);
    expect(s.spent).toBe(6);
  });

  test('istekli i neaktivni paketi ne ulaze u zbir', () => {
    const s = summarize([
      paket({ id: 'vazi', totalHours: 10, remainingHours: 10 }),
      paket({ id: 'istekao', totalHours: 99, remainingHours: 99, expiresAt: danaOdSad(-5) }),
      paket({ id: 'neaktivan', totalHours: 50, remainingHours: 50, isActive: false }),
    ]);
    expect(s.total).toBe(10);
    expect(s.packages).toHaveLength(1);
  });

  // Isti redosled koji backend koristi pri prijavi deteta.
  test('current je paket koji prvi istice', () => {
    const s = summarize([
      paket({ id: 'kasnije', expiresAt: danaOdSad(60) }),
      paket({ id: 'prvi', expiresAt: danaOdSad(5) }),
      paket({ id: 'srednji', expiresAt: danaOdSad(20) }),
    ]);
    expect(s.current.id).toBe('prvi');
    expect(s.expiresAt).toBe(s.current.expiresAt);
    expect(s.usable.map((p) => p.id)).toEqual(['prvi', 'srednji', 'kasnije']);
  });

  test('potrosen paket ostaje u zbiru ali ne i medju upotrebljivima', () => {
    const s = summarize([
      paket({ id: 'prazan', totalHours: 10, remainingHours: 0, expiresAt: danaOdSad(5) }),
      paket({ id: 'pun', totalHours: 10, remainingHours: 10, expiresAt: danaOdSad(40) }),
    ]);
    expect(s.total).toBe(20);
    expect(s.spent).toBe(10);
    expect(s.usableCount).toBe(1);
    expect(s.current.id).toBe('pun');
  });

  test('sve potroseno daje progress 0 i current null', () => {
    const s = summarize([paket({ totalHours: 10, remainingHours: 0 })]);
    expect(s.progress).toBe(0);
    expect(s.spent).toBe(10);
    expect(s.current).toBeNull();
  });

  test('brojevi kao stringovi (Decimal iz baze) se racunaju ispravno', () => {
    const s = summarize([paket({ totalHours: '15.00', remainingHours: '12.50' })]);
    expect(s.total).toBe(15);
    expect(s.remaining).toBe(12.5);
    expect(s.spent).toBe(2.5);
  });

  test('iskorisceno nikad nije negativno', () => {
    const s = summarize([paket({ totalHours: 10, remainingHours: 12 })]);
    expect(s.spent).toBe(0);
  });
});
