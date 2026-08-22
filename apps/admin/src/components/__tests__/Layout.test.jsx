import { describe, test, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Layout, { PageHeader } from '../Layout';

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    user: { firstName: 'Vicko', lastName: 'Vicko', role: 'ADMIN' },
    logout: vi.fn(),
  }),
}));

const setTheme = vi.fn();
let tekucaTema = 'light';
vi.mock('../../context/ThemeContext', () => ({
  useTheme: () => ({ theme: tekucaTema, setTheme }),
}));

let brojPrisutnih = 0;
vi.mock('../../hooks/useActiveVisits', () => ({
  useActiveVisits: () => ({ count: brojPrisutnih, visits: [], loading: false, error: '' }),
}));

vi.mock('../../assets/logo.png', () => ({ default: 'logo.png' }));

// Zvono ima svoj test; ovde se samo ne dira mreza.
vi.mock('../Notifications', () => ({ default: () => null }));

function Strana() {
  return <PageHeader title="Prijave" subtitle="Skeniranje QR koda" />;
}

function prikazi(putanja = '/prijave') {
  return render(
    <MemoryRouter initialEntries={[putanja]}>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/prijave" element={<Strana />} />
          <Route path="/deca" element={<PageHeader title="Deca" />} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  brojPrisutnih = 0;
  tekucaTema = 'light';
  setTheme.mockReset();
  document.body.style.overflow = '';
});

describe('Layout - navigacija', () => {
  test('prikazuje sve grupe menija', () => {
    prikazi();
    for (const grupa of ['Pregled', 'Ljudi', 'Ponuda', 'Sadrzaj', 'Sistem']) {
      expect(screen.getByText(grupa)).toBeInTheDocument();
    }
  });

  test('tekuca stranica je oznacena', () => {
    const { container } = prikazi();
    const aktivna = container.querySelector('.nav-item.active');
    expect(aktivna).toHaveTextContent('Prijave');
  });

  test('korisnik i njegova rola stoje u podnozju', () => {
    prikazi();
    expect(screen.getByText('Vicko Vicko')).toBeInTheDocument();
    expect(screen.getByText('ADMIN')).toBeInTheDocument();
    expect(screen.getByText('VV')).toBeInTheDocument();
  });
});

describe('Layout - znacka sa brojem prisutnih', () => {
  test('kada nema nikoga, znacke nema', () => {
    const { container } = prikazi();
    expect(container.querySelector('.nav-badge')).toBeNull();
  });

  test('broj dece stoji uz "Prijave"', () => {
    brojPrisutnih = 5;
    const { container } = prikazi();
    expect(container.querySelector('.nav-badge')).toHaveTextContent('5');
  });
});

describe('Layout - fioka na telefonu', () => {
  test('meni je zatvoren dok se ne trazi', () => {
    const { container } = prikazi();
    expect(container.querySelector('.shell')).not.toHaveClass('menu-open');
  });

  test('dugme otvara meni i zakljucava skrol stranice', async () => {
    const user = userEvent.setup();
    const { container } = prikazi();

    await user.click(screen.getByRole('button', { name: 'Meni' }));

    expect(container.querySelector('.shell')).toHaveClass('menu-open');
    expect(document.body.style.overflow).toBe('hidden');
  });

  test('zatamnjenje zatvara meni i vraca skrol', async () => {
    const user = userEvent.setup();
    const { container } = prikazi();
    await user.click(screen.getByRole('button', { name: 'Meni' }));

    await user.click(screen.getByRole('button', { name: 'Zatvori meni' }));

    expect(container.querySelector('.shell')).not.toHaveClass('menu-open');
    expect(document.body.style.overflow).toBe('');
  });

  // Izbor stavke vodi na drugu stranicu - fioka tu vise nema sta da radi.
  test('odlazak na drugu stranicu zatvara fioku', async () => {
    const user = userEvent.setup();
    const { container } = prikazi();
    await user.click(screen.getByRole('button', { name: 'Meni' }));

    await user.click(screen.getByRole('link', { name: /Deca/ }));

    expect(container.querySelector('.shell')).not.toHaveClass('menu-open');
  });
});

describe('Layout - tema', () => {
  test('nudi suprotnu temu od tekuce', async () => {
    const user = userEvent.setup();
    prikazi();

    await user.click(screen.getByRole('button', { name: /Tamna tema/ }));
    expect(setTheme).toHaveBeenCalledWith('dark');
  });

  test('u tamnoj temi nudi povratak na svetlu', async () => {
    tekucaTema = 'dark';
    const user = userEvent.setup();
    prikazi();

    await user.click(screen.getByRole('button', { name: /Svetla tema/ }));
    expect(setTheme).toHaveBeenCalledWith('light');
  });
});

describe('PageHeader', () => {
  test('prikazuje naslov i podnaslov', () => {
    prikazi();
    expect(screen.getByRole('heading', { name: 'Prijave' })).toBeInTheDocument();
    expect(screen.getByText('Skeniranje QR koda')).toBeInTheDocument();
  });

  test('van Layout-a radi i bez dugmeta za meni', () => {
    render(<PageHeader title="Samostalno" />);
    expect(screen.getByRole('heading', { name: 'Samostalno' })).toBeInTheDocument();
  });
});
