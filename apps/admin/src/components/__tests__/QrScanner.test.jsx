import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, act, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import QrScanner from '../QrScanner';

// Kamera se ne moze pokrenuti u testu, pa se biblioteka zamenjuje. `start`
// zadrzava callback, da test moze da "skenira" kad hoce.
const h = vi.hoisted(() => ({
  onSuccess: null,
  start: vi.fn(),
  stop: vi.fn(),
  clear: vi.fn(),
  getCameras: vi.fn(),
}));

// Namerno obicna funkcija, ne strelasta: komponenta je zove sa `new`, a
// strelaste funkcije ne mogu da budu konstruktori.
vi.mock('html5-qrcode', () => {
  const Html5Qrcode = vi.fn(function FakeScanner() {
    return { start: h.start, stop: h.stop, clear: h.clear };
  });
  Html5Qrcode.getCameras = h.getCameras;
  return { Html5Qrcode };
});

// Spisak za birac se posle pokretanja kupi iz enumerateDevices - to ne trazi
// pristup, pa je i u testu odvojeno od `getCameras`.
function uredjaji(...kamere) {
  navigator.mediaDevices.enumerateDevices = vi
    .fn()
    .mockResolvedValue(kamere.map((k) => ({ kind: 'videoinput', deviceId: k.id, label: k.label })));
}

const KAMERA_ZADNJA = { id: 'cam-back', label: 'Back Camera' };
const KAMERA_PREDNJA = { id: 'cam-front', label: 'Front Camera' };
const KAMERA_USB = { id: 'cam-usb', label: 'Logitech USB Camera' };

beforeEach(() => {
  h.onSuccess = null;
  h.start.mockReset().mockImplementation(async (cfg, opts, onSuccess) => {
    h.onSuccess = onSuccess;
  });
  h.stop.mockReset().mockResolvedValue(undefined);
  h.clear.mockReset();
  h.getCameras.mockReset().mockResolvedValue([KAMERA_ZADNJA]);
  localStorage.clear();
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

  // Trazi se zadnja kamera, ali bez nabrajanja - ono je zaseban zahtev za
  // pristup, pa bi jedno skeniranje pitalo za kameru dvaput.
  test('kada je aktivan, trazi zadnju kameru bez nabrajanja', async () => {
    render(<QrScanner active onScan={vi.fn()} />);

    await waitFor(() => expect(h.start).toHaveBeenCalled());
    expect(h.start.mock.calls[0][0]).toEqual({ facingMode: 'environment' });
    expect(h.getCameras).not.toHaveBeenCalled();
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

  // Radnik posle ishoda klikne "Skeniraj sledece" - kamera se gasi pa ponovo
  // pali, kao i ovde. Vodi ga pravo stanje, ne rucni rerender: gasenje i
  // paljenje u istom tiku React sazme u jedan prolaz, sto se u aplikaciji ne
  // desava.
  test('ponovo upaljena kamera opet cita', async () => {
    const user = userEvent.setup();
    const onScan = vi.fn();

    function Ekran() {
      const [ukljucena, setUkljucena] = useState(true);
      return (
        <>
          <QrScanner
            active={ukljucena}
            onScan={(kod) => {
              setUkljucena(false);
              onScan(kod);
            }}
          />
          <button onClick={() => setUkljucena(true)}>Skeniraj sledece</button>
        </>
      );
    }

    render(<Ekran />);
    await waitFor(() => expect(h.start).toHaveBeenCalled());
    skeniraj('IGR-5424914B');
    await waitFor(() => expect(h.stop).toHaveBeenCalled());
    h.start.mockClear();

    await user.click(screen.getByRole('button', { name: 'Skeniraj sledece' }));
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

// Na recepciji racunar cesto ima dve kamere: ugradjenu i USB uperenu u pult.
// Bez izbora pregledac uzme podrazumevanu, koja gleda u radnika.
describe('QrScanner - izbor kamere', () => {
  test('sa jednom kamerom nema sta da se bira', async () => {
    render(<QrScanner active onScan={vi.fn()} />);
    await waitFor(() => expect(h.start).toHaveBeenCalled());

    expect(screen.queryByLabelText('Kamera')).toBeNull();
  });

  test('sa vise kamera nudi izbor', async () => {
    uredjaji(KAMERA_PREDNJA, KAMERA_USB);
    render(<QrScanner active onScan={vi.fn()} />);

    const birac = await screen.findByLabelText('Kamera');
    expect(within(birac).getByText('Logitech USB Camera')).toBeInTheDocument();
    expect(within(birac).getByText('Front Camera')).toBeInTheDocument();
  });

  test('promena kamere je restartuje', async () => {
    const user = userEvent.setup();
    uredjaji(KAMERA_PREDNJA, KAMERA_USB);
    render(<QrScanner active onScan={vi.fn()} />);
    await waitFor(() => expect(h.start).toHaveBeenCalled());
    h.start.mockClear();

    await user.selectOptions(screen.getByLabelText('Kamera'), 'cam-usb');

    await waitFor(() => expect(h.start).toHaveBeenCalledWith('cam-usb', expect.anything(), expect.any(Function), expect.any(Function)));
    expect(h.stop).toHaveBeenCalled();
  });

  // Recepcija koristi istu kameru svaki put - izbor ne treba praviti iznova.
  test('izabrana kamera se pamti do sledeceg puta', async () => {
    const user = userEvent.setup();
    uredjaji(KAMERA_PREDNJA, KAMERA_USB);
    const { unmount } = render(<QrScanner active onScan={vi.fn()} />);
    await screen.findByLabelText('Kamera');
    await user.selectOptions(screen.getByLabelText('Kamera'), 'cam-usb');
    unmount();

    h.start.mockClear();
    render(<QrScanner active onScan={vi.fn()} />);

    await waitFor(() => expect(h.start.mock.calls[0][0]).toBe('cam-usb'));
  });

  // USB kamera izvucena iz pulta: pokretanje puca, pa se tek tada placa
  // nabrajanje i zapamceni izbor se brise.
  test('zapamcena kamera koja vise ne postoji pada na nabrajanje', async () => {
    localStorage.setItem('igraonica_admin_kamera', 'cam-nema-je');
    h.getCameras.mockResolvedValue([KAMERA_PREDNJA, KAMERA_USB]);
    h.start.mockImplementation(async (id, opts, onSuccess) => {
      if (id === 'cam-nema-je') {
        const err = new Error('nema je');
        err.name = 'OverconstrainedError';
        throw err;
      }
      h.onSuccess = onSuccess;
    });

    render(<QrScanner active onScan={vi.fn()} />);

    await waitFor(() => expect(h.start.mock.calls[1][0]).toBe('cam-front'));
  });

  // Nabrajanje kamera je zaseban zahtev za pristup. Kad se zna koja je kamera
  // bila poslednja, pregledac se pita jednom umesto dvaput.
  test('zapamcena kamera se pali bez nabrajanja', async () => {
    localStorage.setItem('igraonica_admin_kamera', 'cam-usb');
    render(<QrScanner active onScan={vi.fn()} />);

    await waitFor(() => expect(h.start).toHaveBeenCalled());
    expect(h.start.mock.calls[0][0]).toBe('cam-usb');
    expect(h.getCameras).not.toHaveBeenCalled();
  });

  // Kamera koju je pregledac sam dao se ne pamti: bez trajne dozvole se
  // `deviceId` menja izmedju poseta, pa bi zapamcen id samo propao.
  test('kamera koju niko nije birao se ne pamti', async () => {
    render(<QrScanner active onScan={vi.fn()} />);

    await waitFor(() => expect(h.start).toHaveBeenCalled());
    expect(localStorage.getItem('igraonica_admin_kamera')).toBeNull();
  });

  test('bez ijedne kamere upucuje na rucni unos', async () => {
    const err = new Error('nema kamere');
    err.name = 'NotFoundError';
    h.start.mockRejectedValue(err);
    const onError = vi.fn();
    render(<QrScanner active onScan={vi.fn()} onError={onError} />);

    expect(await screen.findByText(/nema kamere/i)).toBeInTheDocument();
    expect(onError).toHaveBeenCalled();
  });

  test('odbijena dozvola daje jasnu poruku', async () => {
    const err = new Error('denied');
    err.name = 'NotAllowedError';
    h.start.mockRejectedValue(err);
    render(<QrScanner active onScan={vi.fn()} onError={vi.fn()} />);

    expect(await screen.findByText(/nije dozvoljen/i)).toBeInTheDocument();
  });

  // Zapamcena kamera vise ne postoji, pa se pada na nabrajanje - i ako ni tada
  // nema nijedne, radnik dobija uputstvo umesto praznog ekrana.
  test('bez kamera i posle nabrajanja upucuje na rucni unos', async () => {
    localStorage.setItem('igraonica_admin_kamera', 'cam-usb');
    const err = new Error('nema je');
    err.name = 'OverconstrainedError';
    h.start.mockRejectedValue(err);
    h.getCameras.mockResolvedValue([]);
    render(<QrScanner active onScan={vi.fn()} onError={vi.fn()} />);

    expect(await screen.findByText(/nema kamere/i)).toBeInTheDocument();
  });
});

// Kamera se ne gasi izmedju dece: svako paljenje je nov zahtev za pristup, a
// pregledac koji dozvolu ne pamti pita iznova.
describe('QrScanner - pauza', () => {
  test('bez pauze javlja tacno jedan kod po paljenju', async () => {
    const onScan = vi.fn();
    render(<QrScanner active onScan={onScan} />);
    await waitFor(() => expect(h.start).toHaveBeenCalled());

    skeniraj('ABC123');
    skeniraj('ABC123');
    skeniraj('DEF456');

    expect(onScan).toHaveBeenCalledTimes(1);
    expect(onScan).toHaveBeenCalledWith('ABC123');
  });

  test('dok je pauzirana ne javlja nista, a kamera radi', async () => {
    const onScan = vi.fn();
    const { rerender } = render(<QrScanner active paused onScan={onScan} />);
    await waitFor(() => expect(h.start).toHaveBeenCalled());

    skeniraj('ABC123');
    expect(onScan).not.toHaveBeenCalled();
    expect(h.stop).not.toHaveBeenCalled();

    rerender(<QrScanner active paused={false} onScan={onScan} />);
    skeniraj('ABC123');

    expect(onScan).toHaveBeenCalledWith('ABC123');
  });

  test('skidanje pauze ne restartuje kameru', async () => {
    const onScan = vi.fn();
    const { rerender } = render(<QrScanner active paused onScan={onScan} />);
    await waitFor(() => expect(h.start).toHaveBeenCalled());
    h.start.mockClear();

    rerender(<QrScanner active paused={false} onScan={onScan} />);

    expect(h.start).not.toHaveBeenCalled();
    expect(h.stop).not.toHaveBeenCalled();
  });
});
