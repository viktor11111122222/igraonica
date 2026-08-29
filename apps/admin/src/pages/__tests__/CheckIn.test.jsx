import { describe, test, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CheckIn from '../CheckIn';
import { get, post } from '../../lib/api';
import { __resetActiveVisits } from '../../hooks/useActiveVisits';

vi.mock('../../lib/api', () => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  del: vi.fn(),
}));

// Kamera ne postoji u testu; `start` zadrzava callback da test moze da
// "skenira" kad hoce.
const h = vi.hoisted(() => ({
  onSuccess: null,
  start: vi.fn(),
  stop: vi.fn(),
  getCameras: vi.fn(),
}));

vi.mock('html5-qrcode', () => {
  const Html5Qrcode = vi.fn(function FakeScanner() {
    return { start: h.start, stop: h.stop, clear: vi.fn() };
  });
  // Skener prvo pita koje kamere postoje - na racunaru ih zna biti vise.
  Html5Qrcode.getCameras = h.getCameras;
  return { Html5Qrcode };
});

const KOD = 'IGR-5424914B';

// Dete koje je vec u igraonici. Smer se cita iz ovog spiska, pa je ovo jedini
// ulaz koji odlucuje da li ce skeniranje biti prijava ili odjava.
const poseta = {
  id: 'v1',
  checkedInAt: '2026-08-21T09:00:00.000Z',
  currentDurationMinutes: 45,
  userPackage: { remainingHours: 8 },
  child: {
    firstName: 'Ana',
    lastName: 'Petrovic',
    qrCode: KOD,
    parent: { firstName: 'Jelena', lastName: 'Petrovic' },
  },
};

// Ceo ekran razlikuje rucni citac od coveka po razmaku izmedju znakova, pa
// vreme mora da bude pod kontrolom. Podrazumevano tece ljudskom brzinom - inace
// bi `userEvent.type`, koji kuca trenutno, bio prepoznat kao citac.
let sada;
let korak;

beforeEach(() => {
  // Izvor prisutnih je deljen modul; bez ovoga stanje curi iz testa u test.
  __resetActiveVisits();

  sada = 1_000_000;
  korak = 500;
  vi.spyOn(Date, 'now').mockImplementation(() => (sada += korak));

  h.onSuccess = null;
  h.start.mockReset().mockImplementation(async (cfg, opts, onSuccess) => {
    h.onSuccess = onSuccess;
  });
  h.stop.mockReset().mockResolvedValue(undefined);
  h.getCameras.mockReset().mockResolvedValue([{ id: 'cam-back', label: 'Back Camera' }]);

  get.mockResolvedValue({ visits: [] });
  post.mockResolvedValue({ message: 'Ana Petrovic je prijavljen/a.', remainingHours: 12 });
});

// Citac sa kase "otkuca" kod za nekoliko milisekundi, bilo gde na strani.
function skenirajCitacem(kod) {
  korak = 5;
  for (const znak of kod) {
    document.body.dispatchEvent(
      new KeyboardEvent('keydown', { key: znak, bubbles: true, cancelable: true })
    );
  }
  korak = 500;
}

async function ukljuciKameru(user) {
  await user.click(screen.getByRole('button', { name: 'Skeniraj kamerom' }));
  await waitFor(() => expect(h.start).toHaveBeenCalled());
}

describe('CheckIn - kamera', () => {
  test('kamera je iskljucena dok se ne trazi', async () => {
    render(<CheckIn />);
    await waitFor(() => expect(get).toHaveBeenCalledWith('/visits/active'));

    expect(h.start).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Skeniraj kamerom' })).toBeInTheDocument();
  });

  test('dugme ukljucuje i gasi kameru', async () => {
    const user = userEvent.setup();
    render(<CheckIn />);

    await ukljuciKameru(user);
    expect(screen.getByRole('button', { name: 'Ugasi kameru' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Ugasi kameru' }));
    await waitFor(() => expect(h.stop).toHaveBeenCalled());
  });

  // Ovo je sustina: skeniran kod mora da pokrene isti poziv kao rucni unos.
  test('skeniran kod salje prijavu', async () => {
    const user = userEvent.setup();
    render(<CheckIn />);
    await ukljuciKameru(user);

    await h.onSuccess(KOD);

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/visits/check-in', { qrCode: KOD })
    );
  });

  // Sustina drugog skeniranja: isti kod, ali je dete sada unutra.
  test('kod deteta koje je vec unutra salje odjavu', async () => {
    const user = userEvent.setup();
    get.mockResolvedValue({ visits: [poseta] });

    render(<CheckIn />);
    await waitFor(() => expect(get).toHaveBeenCalledWith('/visits/active'));
    await ukljuciKameru(user);

    await h.onSuccess(KOD);

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/visits/check-out', { qrCode: KOD })
    );
  });

  // Bez ovoga bi isti kod pred objektivom odmah okinuo i suprotnu radnju.
  test('kamera se gasi posle jednog citanja', async () => {
    const user = userEvent.setup();
    render(<CheckIn />);
    await ukljuciKameru(user);

    await h.onSuccess(KOD);

    await waitFor(() => expect(h.stop).toHaveBeenCalled());
    expect(
      await screen.findByRole('button', { name: 'Skeniraj kamerom' })
    ).toBeInTheDocument();
  });

  test('rezultat se objavljuje kao status, van forme', async () => {
    const user = userEvent.setup();
    render(<CheckIn />);
    await ukljuciKameru(user);

    await h.onSuccess(KOD);

    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent('Ana Petrovic je prijavljen/a.');
    expect(status).toHaveTextContent('Preostalo');
  });

  test('sa rezultata se jednim dugmetom pali sledece skeniranje', async () => {
    const user = userEvent.setup();
    render(<CheckIn />);
    await ukljuciKameru(user);
    await h.onSuccess(KOD);
    await screen.findByRole('status');
    h.start.mockClear();

    await user.click(screen.getByRole('button', { name: 'Skeniraj sledece' }));

    await waitFor(() => expect(h.start).toHaveBeenCalled());
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  test('posle skeniranja se osvezava lista prisutnih', async () => {
    const user = userEvent.setup();
    render(<CheckIn />);
    await ukljuciKameru(user);
    get.mockClear();

    await h.onSuccess(KOD);

    await waitFor(() => expect(get).toHaveBeenCalledWith('/visits/active'));
  });

  test('odgovor servera se prikazuje radniku', async () => {
    const user = userEvent.setup();
    render(<CheckIn />);
    await ukljuciKameru(user);

    await h.onSuccess(KOD);

    expect(await screen.findByText(/Ana Petrovic je prijavljen/)).toBeInTheDocument();
  });

  test('greska sa servera se prikazuje', async () => {
    const user = userEvent.setup();
    post.mockRejectedValue(new Error('Dete je vec prijavljeno u igraonici.'));

    render(<CheckIn />);
    await ukljuciKameru(user);

    await h.onSuccess(KOD);

    expect(
      await screen.findByText('Dete je vec prijavljeno u igraonici.')
    ).toBeInTheDocument();
  });
});

describe('CheckIn - rucni citac', () => {
  // Sustina: kod stize i kada fokus nije u polju za unos.
  test('kod sa citaca salje prijavu i bez fokusa u polju', async () => {
    render(<CheckIn />);
    await waitFor(() => expect(get).toHaveBeenCalledWith('/visits/active'));

    skenirajCitacem(KOD);

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/visits/check-in', { qrCode: KOD })
    );
  });

  test('drugo citanje istog koda odjavljuje', async () => {
    get.mockResolvedValue({ visits: [poseta] });
    render(<CheckIn />);
    await waitFor(() => expect(get).toHaveBeenCalledWith('/visits/active'));

    skenirajCitacem(KOD);

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/visits/check-out', { qrCode: KOD })
    );
  });

  test('ishod citaca se vidi isto kao ishod kamere', async () => {
    render(<CheckIn />);
    await waitFor(() => expect(get).toHaveBeenCalled());

    skenirajCitacem(KOD);

    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent('Ana Petrovic je prijavljen/a.');
  });

  // Dva citanja u istom dahu ne smeju da posalju dva zahteva - drugi bi odmah
  // odjavio dete koje je prvi prijavio.
  test('dva citanja zaredom salju jedan zahtev', async () => {
    render(<CheckIn />);
    await waitFor(() => expect(get).toHaveBeenCalled());

    skenirajCitacem(KOD);
    skenirajCitacem(KOD);

    await waitFor(() => expect(post).toHaveBeenCalled());
    expect(post).toHaveBeenCalledTimes(1);
  });
});

describe('CheckIn - rucni unos ostaje', () => {
  test('kod unet rukom radi i bez kamere', async () => {
    const user = userEvent.setup();
    render(<CheckIn />);
    await waitFor(() => expect(get).toHaveBeenCalled());

    await user.type(screen.getByPlaceholderText('IGR-XXXXXXXX'), KOD);
    await user.click(screen.getByRole('button', { name: 'Prijavi' }));

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/visits/check-in', { qrCode: KOD })
    );
    expect(h.start).not.toHaveBeenCalled();
  });

  test('dugme nudi odjavu kada je dete vec unutra', async () => {
    const user = userEvent.setup();
    get.mockResolvedValue({ visits: [poseta] });

    render(<CheckIn />);
    await waitFor(() => expect(get).toHaveBeenCalled());

    const polje = screen.getByPlaceholderText('IGR-XXXXXXXX');
    await user.type(polje, KOD);

    // U tabeli prisutnih stoji jos jedno "Odjavi", pa se gleda bas dugme forme.
    const forma = polje.closest('form');
    expect(within(forma).getByRole('button', { name: 'Odjavi' })).toBeInTheDocument();
  });

  test('polje se prazni posle uspesne prijave', async () => {
    const user = userEvent.setup();
    render(<CheckIn />);
    await waitFor(() => expect(get).toHaveBeenCalled());

    const polje = screen.getByPlaceholderText('IGR-XXXXXXXX');
    await user.type(polje, KOD);
    await user.click(screen.getByRole('button', { name: 'Prijavi' }));

    await waitFor(() => expect(polje).toHaveValue(''));
  });
});

// Dete bez paketa ulazi, ali boravak ide roditelju u minus. Radnik to mora da
// vidi na traci ishoda - inace se minus otkrije tek kad neko pogleda nalog.
describe('CheckIn - minus sati', () => {
  async function prijaviRucno(user) {
    await user.type(screen.getByPlaceholderText('IGR-XXXXXXXX'), KOD);
    await user.click(screen.getByRole('button', { name: 'Prijavi' }));
  }

  test('prijava bez paketa javlja da boravak ide u minus', async () => {
    post.mockResolvedValue({
      message: 'Ana Petrovic je prijavljen/a.',
      remainingHours: 0,
      withoutPackage: true,
      debtHours: 0,
    });
    const user = userEvent.setup();
    render(<CheckIn />);
    await waitFor(() => expect(get).toHaveBeenCalledWith('/visits/active'));

    await prijaviRucno(user);

    expect(await screen.findByText(/nema aktivan paket/i)).toBeInTheDocument();
    // Bez paketa "Preostalo: 0 h" bi bilo obmanjujuce.
    expect(screen.queryByText(/Preostalo/)).toBeNull();
  });

  test('prijava sa paketom ne pominje minus', async () => {
    post.mockResolvedValue({
      message: 'Ana Petrovic je prijavljen/a.',
      remainingHours: 12,
      withoutPackage: false,
      debtHours: 0,
    });
    const user = userEvent.setup();
    render(<CheckIn />);
    await waitFor(() => expect(get).toHaveBeenCalledWith('/visits/active'));

    await prijaviRucno(user);

    await screen.findByText('Ana Petrovic je prijavljen/a.');
    expect(screen.queryByText(/minus/i)).toBeNull();
  });

  test('odjava pokazuje koliko je dodato i koliko roditelj duguje', async () => {
    get.mockResolvedValue({ visits: [poseta] });
    post.mockResolvedValue({
      message: 'Ana Petrovic je odjavljen/a.',
      duration: { raw: 130, charged: 120, hoursDeducted: 2 },
      remainingHours: 0,
      debtAdded: 2,
      debtHours: 5,
    });
    const user = userEvent.setup();
    render(<CheckIn />);
    await waitFor(() => expect(get).toHaveBeenCalledWith('/visits/active'));

    const polje = screen.getByPlaceholderText('IGR-XXXXXXXX');
    await user.type(polje, KOD);
    // "Odjavi" postoji i u spisku prisutnih, pa se cilja dugme u formi.
    await user.click(within(polje.closest('form')).getByRole('button', { name: 'Odjavi' }));

    expect(await screen.findByText(/Minus ukupno/)).toBeInTheDocument();
    expect(screen.getByText(/Ova poseta: \+2,0 h/)).toBeInTheDocument();
  });

  // Stari minus se vidi i kad je ovaj boravak pokriven paketom - roditelj je
  // bas tada na pultu.
  test('odjava sa pokricem i dalje pokazuje stari minus', async () => {
    get.mockResolvedValue({ visits: [poseta] });
    post.mockResolvedValue({
      message: 'Ana Petrovic je odjavljen/a.',
      duration: { raw: 70, charged: 60, hoursDeducted: 1 },
      remainingHours: 7,
      debtAdded: 0,
      debtHours: 3,
    });
    const user = userEvent.setup();
    render(<CheckIn />);
    await waitFor(() => expect(get).toHaveBeenCalledWith('/visits/active'));

    const polje = screen.getByPlaceholderText('IGR-XXXXXXXX');
    await user.type(polje, KOD);
    // "Odjavi" postoji i u spisku prisutnih, pa se cilja dugme u formi.
    await user.click(within(polje.closest('form')).getByRole('button', { name: 'Odjavi' }));

    expect(await screen.findByText(/Minus ukupno: 3,0 h/)).toBeInTheDocument();
    expect(screen.queryByText(/Ova poseta/)).toBeNull();
    expect(screen.getByText(/Preostalo: 7,0 h/)).toBeInTheDocument();
  });
});
