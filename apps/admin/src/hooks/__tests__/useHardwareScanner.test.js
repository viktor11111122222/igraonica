import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import useHardwareScanner from '../useHardwareScanner';

const KOD = 'IGR-00021641';

// Vreme se pomera rucno preko Date.now: ceo hook razlikuje citac od coveka
// bas po razmaku izmedju znakova, pa test mora da drzi taj razmak u ruci.
let sada;

beforeEach(() => {
  sada = 1_000_000;
  vi.spyOn(Date, 'now').mockImplementation(() => sada);
});

afterEach(() => {
  vi.restoreAllMocks();
});

function pritisni(key, razmak = 5) {
  sada += razmak;
  const e = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  document.body.dispatchEvent(e);
  return e;
}

function otkucaj(tekst, razmak = 5) {
  for (const znak of tekst) pritisni(znak, razmak);
}

describe('useHardwareScanner - kako citac kuca', () => {
  test('brza serija sa Enter-om salje kod', () => {
    const onScan = vi.fn();
    renderHook(() => useHardwareScanner(onScan));

    otkucaj(KOD);
    pritisni('Enter');

    expect(onScan).toHaveBeenCalledTimes(1);
    expect(onScan).toHaveBeenCalledWith(KOD);
  });

  // Citac se cesto podesi bez zavrsnog znaka. Oblik koda je fiksan, pa se kraj
  // prepoznaje i bez njega.
  test('serija bez zavrsnog znaka svejedno salje kod', () => {
    const onScan = vi.fn();
    renderHook(() => useHardwareScanner(onScan));

    otkucaj(KOD);

    expect(onScan).toHaveBeenCalledWith(KOD);
  });

  test('Tab kao zavrsni znak ne pravi drugo slanje', () => {
    const onScan = vi.fn();
    renderHook(() => useHardwareScanner(onScan));

    otkucaj(KOD);
    const tab = pritisni('Tab');

    expect(onScan).toHaveBeenCalledTimes(1);
    expect(tab.defaultPrevented).toBe(true);
  });

  // Bez ovoga bi zavrsni Enter drugi put poslao formu, ili kliknuo dugme na
  // kome je slucajno ostao fokus.
  test('zavrsni Enter ne stize do stranice', () => {
    const onScan = vi.fn();
    renderHook(() => useHardwareScanner(onScan));

    otkucaj(KOD);
    const enter = pritisni('Enter');

    expect(enter.defaultPrevented).toBe(true);
    expect(onScan).toHaveBeenCalledTimes(1);
  });

  test('mala slova se dizu na velika', () => {
    const onScan = vi.fn();
    renderHook(() => useHardwareScanner(onScan));

    otkucaj('igr-00021641');

    expect(onScan).toHaveBeenCalledWith(KOD);
  });

  // Poneki citac dopisuje svoj prefiks pre koda.
  test('prefiks citaca se preskace', () => {
    const onScan = vi.fn();
    renderHook(() => useHardwareScanner(onScan));

    otkucaj(`]Q0${KOD}`);

    expect(onScan).toHaveBeenCalledWith(KOD);
  });
});

describe('useHardwareScanner - sta ne sme da okine', () => {
  test('sporo kucanje se ne racuna kao skeniranje', () => {
    const onScan = vi.fn();
    renderHook(() => useHardwareScanner(onScan));

    otkucaj(KOD, 250);
    pritisni('Enter', 250);

    expect(onScan).not.toHaveBeenCalled();
  });

  test('obican Enter prolazi kroz stranicu netaknut', () => {
    const onScan = vi.fn();
    renderHook(() => useHardwareScanner(onScan));

    const enter = pritisni('Enter');

    expect(enter.defaultPrevented).toBe(false);
    expect(onScan).not.toHaveBeenCalled();
  });

  test('precice sa Cmd/Ctrl se ne skupljaju', () => {
    const onScan = vi.fn();
    renderHook(() => useHardwareScanner(onScan));

    for (const znak of KOD) {
      sada += 5;
      document.body.dispatchEvent(
        new KeyboardEvent('keydown', { key: znak, metaKey: true, bubbles: true })
      );
    }

    expect(onScan).not.toHaveBeenCalled();
  });

  test('iskljucen hook ne slusa', () => {
    const onScan = vi.fn();
    renderHook(() => useHardwareScanner(onScan, { enabled: false }));

    otkucaj(KOD);
    pritisni('Enter');

    expect(onScan).not.toHaveBeenCalled();
  });

  test('posle demontiranja nema osluskivanja', () => {
    const onScan = vi.fn();
    const { unmount } = renderHook(() => useHardwareScanner(onScan));

    unmount();
    otkucaj(KOD);

    expect(onScan).not.toHaveBeenCalled();
  });
});
