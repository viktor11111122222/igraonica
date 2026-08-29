import { describe, test, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import UserDetail from '../UserDetail';
import { get, post } from '../../lib/api';

vi.mock('../../lib/api', () => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('../../components/Layout', () => ({
  PageHeader: ({ title, subtitle, children }) => (
    <div><h1>{title}</h1><p>{subtitle}</p>{children}</div>
  ),
}));
vi.mock('../../components/AssignPackage', () => ({
  default: ({ onClose }) => (
    <div role="dialog" aria-label="Dodela paketa">
      <button onClick={onClose}>Zatvori</button>
    </div>
  ),
}));

const SUTRA = new Date(Date.now() + 30 * 864e5).toISOString();
const JUCE = new Date(Date.now() - 864e5).toISOString();

const paket = {
  id: 'up1',
  isActive: true,
  expiresAt: SUTRA,
  totalHours: 10,
  remainingHours: 6,
  assignedAt: '2026-08-01T10:00:00.000Z',
  package: { name: 'Paket 10h' },
};

const roditelj = {
  id: 'u1',
  firstName: 'Ana',
  lastName: 'Petrovic',
  email: 'ana@primer.rs',
  phone: '060111222',
  children: [{ id: 'c1', firstName: 'Lena', lastName: 'Petrovic', dateOfBirth: '2020-05-10', qrCode: 'IGR-B4F46AB6' }],
  userPackages: [paket],
};

function odgovori(user = roditelj) {
  get.mockImplementation((path) => {
    if (path === '/users/u1') return Promise.resolve({ user });
    if (path.includes('/adjustments')) return Promise.resolve({ adjustments: [] });
    return Promise.resolve({});
  });
}

const prikazi = () =>
  render(
    <MemoryRouter initialEntries={['/korisnici/u1']}>
      <Routes>
        <Route path="/korisnici/:id" element={<UserDetail />} />
      </Routes>
    </MemoryRouter>
  );

beforeEach(() => {
  get.mockReset();
  post.mockReset().mockResolvedValue({});
  odgovori();
});

describe('UserDetail - pregled', () => {
  test('prikazuje roditelja sa kontaktom', async () => {
    prikazi();

    expect(await screen.findByRole('heading', { name: 'Ana Petrovic' })).toBeInTheDocument();
    expect(screen.getByText(/ana@primer.rs/)).toBeInTheDocument();
  });

  test('zbir sati ide preko svih paketa koji vaze', async () => {
    odgovori({
      ...roditelj,
      userPackages: [paket, { ...paket, id: 'up2', totalHours: 5, remainingHours: 1 }],
    });
    prikazi();

    await screen.findByRole('heading', { name: 'Ana Petrovic' });
    expect(screen.getByText('15,0 h')).toBeInTheDocument();
    expect(screen.getByText('7,0 h')).toBeInTheDocument();
    expect(screen.getByText('8,0 h')).toBeInTheDocument();
    expect(screen.getByText('2 paketa koja vaze')).toBeInTheDocument();
  });

  test('istekao paket se ne racuna u zbir', async () => {
    odgovori({ ...roditelj, userPackages: [{ ...paket, expiresAt: JUCE }] });
    prikazi();

    await screen.findByRole('heading', { name: 'Ana Petrovic' });
    expect(screen.getByText('Istekao')).toBeInTheDocument();
    expect(screen.getByText('0 paketa koja vaze')).toBeInTheDocument();
  });

  test('potroseni paket je oznacen', async () => {
    odgovori({ ...roditelj, userPackages: [{ ...paket, remainingHours: 0 }] });
    prikazi();

    expect(await screen.findByText('Potroseni sati')).toBeInTheDocument();
  });

  test('deaktiviran paket je oznacen', async () => {
    odgovori({ ...roditelj, userPackages: [{ ...paket, isActive: false }] });
    prikazi();

    expect(await screen.findByText('Neaktivan')).toBeInTheDocument();
  });

  test('prikazuje decu roditelja', async () => {
    prikazi();
    expect(await screen.findByText('Lena Petrovic')).toBeInTheDocument();
    expect(screen.getByText('IGR-B4F46AB6')).toBeInTheDocument();
  });

  test('roditelj bez dece to i kaze', async () => {
    odgovori({ ...roditelj, children: [] });
    prikazi();

    expect(await screen.findByText('Nema dece')).toBeInTheDocument();
  });

  test('roditelj bez paketa nudi dodelu', async () => {
    odgovori({ ...roditelj, userPackages: [] });
    prikazi();

    expect(await screen.findByText('Nema paketa')).toBeInTheDocument();
  });

  test('nepostojeci korisnik daje jasnu poruku', async () => {
    get.mockRejectedValue(new Error('Korisnik nije pronadjen.'));
    prikazi();

    expect(await screen.findByText('Korisnik nije pronadjen.')).toBeInTheDocument();
  });
});

describe('UserDetail - korekcija sati', () => {
  test('dugme "Sacuvaj" pripada formi', async () => {
    const user = userEvent.setup();
    prikazi();
    await screen.findByRole('heading', { name: 'Ana Petrovic' });

    await user.click(screen.getByRole('button', { name: 'Koriguj sate' }));

    expect(screen.getByRole('button', { name: 'Sacuvaj' }).form?.id).toBe('sati-forma');
  });

  test('korekcija salje broj sati i razlog', async () => {
    const user = userEvent.setup();
    prikazi();
    await screen.findByRole('heading', { name: 'Ana Petrovic' });
    await user.click(screen.getByRole('button', { name: 'Koriguj sate' }));

    const dijalog = screen.getByRole('dialog');
    await user.type(within(dijalog).getByLabelText('Promena sati'), '-1.5');
    await user.type(within(dijalog).getByLabelText('Razlog'), 'greska pri odjavi');
    await user.click(screen.getByRole('button', { name: 'Sacuvaj' }));

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/packages/up1/adjust-hours', {
        hours: -1.5,
        reason: 'greska pri odjavi',
      })
    );
  });

  test('bez unetog broja dugme je zakljucano', async () => {
    const user = userEvent.setup();
    prikazi();
    await screen.findByRole('heading', { name: 'Ana Petrovic' });

    await user.click(screen.getByRole('button', { name: 'Koriguj sate' }));

    expect(screen.getByRole('button', { name: 'Sacuvaj' })).toBeDisabled();
  });

  test('greska sa servera ostaje u prozoru', async () => {
    post.mockRejectedValue(new Error('Sati ne mogu ispod nule.'));
    const user = userEvent.setup();
    prikazi();
    await screen.findByRole('heading', { name: 'Ana Petrovic' });
    await user.click(screen.getByRole('button', { name: 'Koriguj sate' }));

    const dijalog = screen.getByRole('dialog');
    await user.type(within(dijalog).getByLabelText('Promena sati'), '-100');
    await user.click(screen.getByRole('button', { name: 'Sacuvaj' }));

    expect(await screen.findAllByText('Sati ne mogu ispod nule.')).not.toHaveLength(0);
  });
});

describe('UserDetail - istorija korekcija', () => {
  test('paket bez korekcija to i kaze', async () => {
    const user = userEvent.setup();
    prikazi();
    await screen.findByRole('heading', { name: 'Ana Petrovic' });

    await user.click(screen.getByRole('button', { name: 'Istorija' }));

    expect(await screen.findByText('Nema korekcija')).toBeInTheDocument();
  });

  test('greska pri ucitavanju istorije se prikazuje', async () => {
    get.mockImplementation((path) =>
      path.includes('/adjustments')
        ? Promise.reject(new Error('Nema veze sa serverom.'))
        : Promise.resolve({ user: roditelj })
    );
    const user = userEvent.setup();
    prikazi();
    await screen.findByRole('heading', { name: 'Ana Petrovic' });

    await user.click(screen.getByRole('button', { name: 'Istorija' }));

    const dijalog = await screen.findByRole('dialog', { name: 'Istorija korekcija' });
    expect(within(dijalog).getByText('Nema veze sa serverom.')).toBeInTheDocument();
    // Neuspelo ucitavanje ne sme da izgleda kao "nema korekcija".
    expect(within(dijalog).queryByText('Nema korekcija')).toBeNull();
  });
});

describe('UserDetail - dodela paketa', () => {
  test('otvara prozor za dodelu', async () => {
    const user = userEvent.setup();
    prikazi();
    await screen.findByRole('heading', { name: 'Ana Petrovic' });

    await user.click(screen.getByRole('button', { name: 'Dodeli paket' }));

    expect(screen.getByRole('dialog', { name: 'Dodela paketa' })).toBeInTheDocument();
  });
});

// Minus sati nastaju kad dete udje bez paketa. Panel ih pokazuje i nudi
// "Naplaceno" - naplata se desava na pultu, panel je samo evidencija.
describe('UserDetail - minus sati', () => {
  const uMinusu = { ...roditelj, debtHours: '3.00' };

  test('bez minusa nema ni brojke ni dugmeta', async () => {
    prikazi();

    await screen.findByRole('heading', { name: 'Ana Petrovic' });
    expect(screen.queryByText('Minus sati')).toBeNull();
    expect(screen.queryByRole('button', { name: /Naplati minus/ })).toBeNull();
  });

  test('minus se prikazuje kao negativan broj sati', async () => {
    odgovori(uMinusu);
    prikazi();

    await screen.findByRole('heading', { name: 'Ana Petrovic' });
    expect(screen.getByText('Minus sati')).toBeInTheDocument();
    expect(screen.getByText('-3,0 h')).toBeInTheDocument();
  });

  // Dugme stoji uz sam iznos, ne u zaglavlju stranice: na telefonu zaglavlje
  // vec nosi "Nazad" i "Dodeli paket", pa je treca akcija isterivala naslov sa
  // ekrana i gurala stranicu bocno.
  test('naplata stoji u plocici sa minusom, ne u zaglavlju', async () => {
    odgovori(uMinusu);
    prikazi();
    await screen.findByRole('heading', { name: 'Ana Petrovic' });

    const dugme = screen.getByRole('button', { name: /Naplati minus/ });
    expect(dugme.closest('.stat')).not.toBeNull();
  });

  test('naplata trazi potvrdu pa salje zahtev', async () => {
    odgovori(uMinusu);
    const user = userEvent.setup();
    prikazi();
    await screen.findByRole('heading', { name: 'Ana Petrovic' });

    await user.click(screen.getByRole('button', { name: /Naplati minus/ }));

    const dijalog = screen.getByRole('dialog');
    expect(within(dijalog).getByText(/tek kad roditelj plati/)).toBeInTheDocument();
    await user.click(within(dijalog).getByRole('button', { name: 'Naplaceno' }));

    await waitFor(() => expect(post).toHaveBeenCalledWith('/users/u1/settle-debt'));
  });

  test('odustajanje ne salje nista', async () => {
    odgovori(uMinusu);
    const user = userEvent.setup();
    prikazi();
    await screen.findByRole('heading', { name: 'Ana Petrovic' });

    await user.click(screen.getByRole('button', { name: /Naplati minus/ }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Odustani' }));

    expect(post).not.toHaveBeenCalled();
  });

  test('greska pri naplati se vidi u dijalogu', async () => {
    odgovori(uMinusu);
    post.mockRejectedValue(new Error('Minus sati su se promenili u medjuvremenu, proverite iznos.'));
    const user = userEvent.setup();
    prikazi();
    await screen.findByRole('heading', { name: 'Ana Petrovic' });

    await user.click(screen.getByRole('button', { name: /Naplati minus/ }));
    const dijalog = screen.getByRole('dialog');
    await user.click(within(dijalog).getByRole('button', { name: 'Naplaceno' }));

    expect(await within(dijalog).findByText(/promenili u medjuvremenu/)).toBeInTheDocument();
  });
});
