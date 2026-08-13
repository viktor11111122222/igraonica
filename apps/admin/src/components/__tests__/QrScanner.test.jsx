import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import QrScanner from '../QrScanner';

// Kamera se ne moze pokrenuti u testu, pa se biblioteka zamenjuje. `start`
// zadrzava callback, da test moze da "skenira" kad hoce.
const h = vi.hoisted(() => ({
  onSuccess: null,
  start: vi.fn(),
  stop: vi.fn(),
  clear: vi.fn(),
}));

// Namerno obicna funkcija, ne strelasta: komponenta je zove sa `new`, a
// strelaste funkcije ne mogu da budu konstruktori.
vi.mock('html5-qrcode', () => ({
  Html5Qrcode: vi.fn(function FakeScanner() {
    return { start: h.start, stop: h.stop, clear: h.clear };
  }),
}));

// Vreme se kontrolise preko Date.now, NE preko vi.useFakeTimers: waitFor
// prepozna lazne tajmere i predje na rezim u kom pravi tajmeri ne okidaju, pa
// cekanje na pokretanje kamere nikad ne prodje.
let sada;

beforeEach(() => {
  h.onSuccess = null;
  h.start.mockReset().mockImplementation(async (cfg, opts, onSuccess) => {
    h.onSuccess = onSuccess;
  });
  h.stop.mockReset().mockResolvedValue(undefined);
  h.clear.mockReset();

  sada = new Date(2026, 7, 13, 12, 0, 0).getTime();
  vi.spyOn(Date, 'now').mockImplementation(() => sada);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// Skeniranje se okida iz callbacka biblioteke, van React-a.
const skeniraj = (kod) => act(() => h.onSuccess(kod));

describe('QrScanner - ukljucivanje', () => {
  test('dok nije aktivan, kamera se ne pokrece', () => {
    render(<QrScanner active={false} onScan={vi.fn()} />);
    expect(h.start).not.toHaveBeenCalled();
  });

  test('kada je aktivan, pokrece zadnju kameru', async () => {
    render(<QrScanner active onScan={vi.fn()} />);

    await waitFor(() => expect(h.start).toHaveBeenCalled());
    expect(h.start.mock.calls[0][0]).toEqual({ facingMode: 'environment' });
  });

  test('gasi kameru kada se ekran napusti', async () => {
    const { unmount } = render(<QrScanner active onScan={vi.fn()} />);
    await waitFor(() => expect(h.start).toHaveBeenCalled());

    unmount();
    await waitFor(() => expect(h.stop).toHaveBeenCalled());
  });
});

describe('QrScanner - citanje koda', () => {
  test('procitan kod se prosledjuje dalje', async () => {
    const onScan = vi.fn();
    render(<QrScanner active onScan={onScan} />);
    await waitFor(() => expect(h.start).toHaveBeenCalled());

    skeniraj('IGR-5424914B');

    expect(onScan).toHaveBeenCalledWith('IGR-5424914B');
  });

  test('kod se cisti od razmaka i vodi na velika slova', async () => {
    const onScan = vi.fn();
    render(<QrScanner active onScan={onScan} />);
    await waitFor(() => expect(h.start).toHaveBeenCalled());

    skeniraj('  igr-5424914b  ');

    expect(onScan).toHaveBeenCalledWith('IGR-5424914B');
  });

  test('prazan rezultat se ignorise', async () => {
    const onScan = vi.fn();
    render(<QrScanner active onScan={onScan} />);
    await waitFor(() => expect(h.start).toHaveBeenCalled());

    skeniraj('   ');

    expect(onScan).not.toHaveBeenCalled();
  });

  // Kod stoji pred kamerom i cita se vise puta u sekundi. Bez pauze bi se
  // odmah posle prijave okinula i odjava.
  test('isti kod se ne salje dvaput za redom', async () => {
    const onScan = vi.fn();
    render(<QrScanner active onScan={onScan} />);
    await waitFor(() => expect(h.start).toHaveBeenCalled());

    skeniraj('IGR-5424914B');
    skeniraj('IGR-5424914B');
    skeniraj('IGR-5424914B');

    expect(onScan).toHaveBeenCalledTimes(1);
  });

  test('posle pauze isti kod moze ponovo', async () => {
    const onScan = vi.fn();
    render(<QrScanner active onScan={onScan} />);
    await waitFor(() => expect(h.start).toHaveBeenCalled());

    skeniraj('IGR-5424914B');
    sada += 4000; // 4s kasnije, pauza je 3s
    skeniraj('IGR-5424914B');

    expect(onScan).toHaveBeenCalledTimes(2);
  });

  // Drugo dete odmah posle prvog ne sme da ceka pauzu.
  test('drugi kod prolazi odmah', async () => {
    const onScan = vi.fn();
    render(<QrScanner active onScan={onScan} />);
    await waitFor(() => expect(h.start).toHaveBeenCalled());

    skeniraj('IGR-5424914B');
    skeniraj('IGR-C1B0D3C0');

    expect(onScan).toHaveBeenCalledTimes(2);
    expect(onScan).toHaveBeenLastCalledWith('IGR-C1B0D3C0');
  });
});

describe('QrScanner - kada kamera zakaze', () => {
  test('odbijena dozvola daje jasnu poruku', async () => {
    const err = new Error('denied');
    err.name = 'NotAllowedError';
    h.start.mockRejectedValue(err);
    const onError = vi.fn();

    render(<QrScanner active onScan={vi.fn()} onError={onError} />);

    expect(await screen.findByText(/nije dozvoljen/i)).toBeInTheDocument();
    expect(onError).toHaveBeenCalledWith(expect.stringContaining('rucno'));
  });

  test('nedostupna kamera upucuje na rucni unos', async () => {
    h.start.mockRejectedValue(new Error('no camera'));
    const onError = vi.fn();

    render(<QrScanner active onScan={vi.fn()} onError={onError} />);

    expect(await screen.findByText(/Unesite kod rucno/i)).toBeInTheDocument();
    expect(onError).toHaveBeenCalled();
  });
});
