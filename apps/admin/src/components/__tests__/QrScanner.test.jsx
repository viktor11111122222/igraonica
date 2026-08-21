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

beforeEach(() => {
  h.onSuccess = null;
  h.start.mockReset().mockImplementation(async (cfg, opts, onSuccess) => {
    h.onSuccess = onSuccess;
  });
  h.stop.mockReset().mockResolvedValue(undefined);
  h.clear.mockReset();
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

  // Kod stoji pred objektivom i cita se vise puta u sekundi. Drugo citanje bi
  // bila odjava deteta koje je upravo prijavljeno.
  test('jedno paljenje kamere daje tacno jedan rezultat', async () => {
    const onScan = vi.fn();
    render(<QrScanner active onScan={onScan} />);
    await waitFor(() => expect(h.start).toHaveBeenCalled());

    skeniraj('IGR-5424914B');
    skeniraj('IGR-5424914B');
    skeniraj('IGR-5424914B');

    expect(onScan).toHaveBeenCalledTimes(1);
  });

  // Ni drugo dete ne sme da prodje samo od sebe - radnik izmedju dva deteta
  // gleda ishod prvog.
  test('ni drugi kod ne prolazi bez ponovnog paljenja', async () => {
    const onScan = vi.fn();
    render(<QrScanner active onScan={onScan} />);
    await waitFor(() => expect(h.start).toHaveBeenCalled());

    skeniraj('IGR-5424914B');
    skeniraj('IGR-C1B0D3C0');

    expect(onScan).toHaveBeenCalledTimes(1);
    expect(onScan).toHaveBeenCalledWith('IGR-5424914B');
  });

  test('ponovo upaljena kamera opet cita', async () => {
    const onScan = vi.fn();
    const { rerender } = render(<QrScanner active onScan={onScan} />);
    await waitFor(() => expect(h.start).toHaveBeenCalled());
    skeniraj('IGR-5424914B');

    rerender(<QrScanner active={false} onScan={onScan} />);
    h.start.mockClear();
    rerender(<QrScanner active onScan={onScan} />);
    await waitFor(() => expect(h.start).toHaveBeenCalled());

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

// iOS Safari ne postavlja navigator.mediaDevices dok stranica nije na HTTPS-u
// sa sertifikatom kojem uredjaj veruje. Skener tada ne dobija nikakvu gresku,
// pa mora sam da prepozna da kamere nema.
describe('QrScanner - kada pregledac uopste ne nudi kameru', () => {
  function bezKamere() {
    Object.defineProperty(navigator, 'mediaDevices', {
      value: undefined,
      configurable: true,
      writable: true,
    });
  }

  test('bez HTTPS-a poruka upucuje na https adresu', async () => {
    bezKamere();
    Object.defineProperty(window, 'isSecureContext', {
      value: false,
      configurable: true,
    });

    render(<QrScanner active onScan={vi.fn()} onError={vi.fn()} />);

    expect(await screen.findByText(/HTTPS/i)).toBeInTheDocument();
  });

  test('na HTTPS-u poruka upucuje na sertifikat', async () => {
    bezKamere();
    Object.defineProperty(window, 'isSecureContext', {
      value: true,
      configurable: true,
    });

    render(<QrScanner active onScan={vi.fn()} onError={vi.fn()} />);

    expect(await screen.findByText(/sertifikat/i)).toBeInTheDocument();
  });

  test('biblioteka se ne dovlaci kad kamere nema', async () => {
    bezKamere();
    const onError = vi.fn();

    render(<QrScanner active onScan={vi.fn()} onError={onError} />);

    await waitFor(() => expect(onError).toHaveBeenCalled());
    expect(h.start).not.toHaveBeenCalled();
  });
});
