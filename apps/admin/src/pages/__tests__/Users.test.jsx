import { describe, test, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Users from '../Users';
import { get, post, patch, del } from '../../lib/api';

vi.mock('../../lib/api', () => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  del: vi.fn(),
}));

vi.mock('../../components/Layout', () => ({
  PageHeader: ({ title, children }) => (
    <div>
      <h1>{title}</h1>
      {children}
    </div>
  ),
}));

vi.mock('../../components/AssignPackage', () => ({
  default: ({ user, onClose }) => (
    <div role="dialog" aria-label="Dodela paketa">
      {user.firstName}
      <button onClick={onClose}>Zatvori dodelu</button>
    </div>
  ),
}));

const roditelj = {
  id: 'u1',
  firstName: 'Ana',
  lastName: 'Petrovic',
  email: 'ana@primer.rs',
  phone: '060111222',
  role: 'PARENT',
  isActive: true,
  createdAt: '2026-01-10T10:00:00.000Z',
};

const odgovor = (users = [roditelj]) => ({
  users,
  pagination: { page: 1, pages: 1, total: users.length },
});

const prikazi = () => render(<MemoryRouter><Users /></MemoryRouter>);

beforeEach(() => {
  get.mockReset().mockResolvedValue(odgovor());
  post.mockReset().mockResolvedValue({});
  patch.mockReset().mockResolvedValue({});
  del.mockReset().mockResolvedValue({});
});

describe('Users - lista', () => {
  test('prikazuje naloge sa servera', async () => {
    prikazi();
    expect(await screen.findByText('Ana Petrovic')).toBeInTheDocument();
    expect(screen.getByText('ana@primer.rs')).toBeInTheDocument();
  });

  test('prazna lista nudi jasnu poruku', async () => {
    get.mockResolvedValue(odgovor([]));
    prikazi();
    expect(await screen.findByText('Nema naloga')).toBeInTheDocument();
  });

  test('deaktiviran nalog je oznacen i nema dugme za deaktivaciju', async () => {
    get.mockResolvedValue(odgovor([{ ...roditelj, isActive: false }]));
    prikazi();

    expect(await screen.findByText('Deaktiviran')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Deaktiviraj' })).toBeNull();
  });

  test('pretraga se salje tek kada se kucanje smiri', async () => {
    const user = userEvent.setup();
    prikazi();
    await screen.findByText('Ana Petrovic');

    await user.type(screen.getByPlaceholderText(/Pretraga/), 'ana');

    await waitFor(() =>
      expect(get).toHaveBeenCalledWith(expect.stringContaining('search=ana'))
    );
  });

  test('filter po ulozi ide u zahtev', async () => {
    const user = userEvent.setup();
    prikazi();
    await screen.findByText('Ana Petrovic');

    await user.selectOptions(screen.getByRole('combobox'), 'ADMIN');

    await waitFor(() =>
      expect(get).toHaveBeenCalledWith(expect.stringContaining('role=ADMIN'))
    );
  });
});

describe('Users - prozor za nalog', () => {
  // Ovo je bio kvar: dugme stoji u podnozju modala, dakle van <form>, pa je
  // pregledac preskakao required, minLength i proveru email-a.
  test('dugme "Sacuvaj" pripada formi, pa provera polja radi', async () => {
    const user = userEvent.setup();
    prikazi();
    await screen.findByText('Ana Petrovic');

    await user.click(screen.getByRole('button', { name: 'Nov nalog' }));

    const sacuvaj = screen.getByRole('button', { name: 'Sacuvaj' });
    expect(sacuvaj.form).not.toBeNull();
    expect(sacuvaj.form.id).toBe('nalog-forma');
  });

  test('prazna forma se ne salje na server', async () => {
    const user = userEvent.setup();
    prikazi();
    await screen.findByText('Ana Petrovic');
    await user.click(screen.getByRole('button', { name: 'Nov nalog' }));

    await user.click(screen.getByRole('button', { name: 'Sacuvaj' }));

    expect(post).not.toHaveBeenCalled();
  });

  test('nov nalog se salje sa svim poljima', async () => {
    const user = userEvent.setup();
    prikazi();
    await screen.findByText('Ana Petrovic');
    await user.click(screen.getByRole('button', { name: 'Nov nalog' }));

    const dijalog = screen.getByRole('dialog');
    await user.type(within(dijalog).getByLabelText('Ime'), 'Marko');
    await user.type(within(dijalog).getByLabelText('Prezime'), 'Markovic');
    await user.type(within(dijalog).getByLabelText('Email'), 'marko@primer.rs');
    await user.type(within(dijalog).getByLabelText('Lozinka'), 'tajna123');
    await user.click(screen.getByRole('button', { name: 'Sacuvaj' }));

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/users', expect.objectContaining({
        firstName: 'Marko',
        lastName: 'Markovic',
        email: 'marko@primer.rs',
        password: 'tajna123',
        role: 'PARENT',
      }))
    );
  });

  test('izmena ne dira email i ne trazi lozinku', async () => {
    const user = userEvent.setup();
    prikazi();
    await screen.findByText('Ana Petrovic');

    await user.click(screen.getByRole('button', { name: 'Izmeni' }));

    const dijalog = screen.getByRole('dialog');
    expect(within(dijalog).getByLabelText('Email')).toBeDisabled();
    expect(within(dijalog).queryByLabelText('Lozinka')).toBeNull();

    await user.clear(within(dijalog).getByLabelText('Ime'));
    await user.type(within(dijalog).getByLabelText('Ime'), 'Anja');
    await user.click(screen.getByRole('button', { name: 'Sacuvaj' }));

    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith('/users/u1', {
        firstName: 'Anja',
        lastName: 'Petrovic',
        phone: '060111222',
        role: 'PARENT',
      })
    );
  });

  test('greska sa servera ostaje u prozoru', async () => {
    post.mockRejectedValue(new Error('Email je vec zauzet.'));
    const user = userEvent.setup();
    prikazi();
    await screen.findByText('Ana Petrovic');
    await user.click(screen.getByRole('button', { name: 'Nov nalog' }));

    const dijalog = screen.getByRole('dialog');
    await user.type(within(dijalog).getByLabelText('Ime'), 'Marko');
    await user.type(within(dijalog).getByLabelText('Prezime'), 'Markovic');
    await user.type(within(dijalog).getByLabelText('Email'), 'marko@primer.rs');
    await user.type(within(dijalog).getByLabelText('Lozinka'), 'tajna123');
    await user.click(screen.getByRole('button', { name: 'Sacuvaj' }));

    expect(await within(dijalog).findByText('Email je vec zauzet.')).toBeInTheDocument();
  });
});

describe('Users - deaktivacija', () => {
  test('potvrda salje brisanje i osvezava listu', async () => {
    const user = userEvent.setup();
    prikazi();
    await screen.findByText('Ana Petrovic');

    await user.click(screen.getByRole('button', { name: 'Deaktiviraj' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Deaktiviraj' }));

    await waitFor(() => expect(del).toHaveBeenCalledWith('/users/u1'));
  });

  // Ovo je bio kvar: poruka je isla u traku na stranici, iza otvorenog dijaloga.
  test('greska pri deaktivaciji se vidi u dijalogu', async () => {
    del.mockRejectedValue(new Error('Nalog ima aktivne posete.'));
    const user = userEvent.setup();
    prikazi();
    await screen.findByText('Ana Petrovic');

    await user.click(screen.getByRole('button', { name: 'Deaktiviraj' }));
    const dijalog = screen.getByRole('dialog');
    await user.click(within(dijalog).getByRole('button', { name: 'Deaktiviraj' }));

    expect(await within(dijalog).findByText('Nalog ima aktivne posete.')).toBeInTheDocument();
  });
});

describe('Users - dodela paketa', () => {
  test('paket se nudi samo roditeljima', async () => {
    get.mockResolvedValue(odgovor([{ ...roditelj, role: 'ADMIN' }]));
    prikazi();
    await screen.findByText('Ana Petrovic');

    expect(screen.queryByRole('button', { name: '+ Paket' })).toBeNull();
  });

  test('otvara prozor za dodelu paketa', async () => {
    const user = userEvent.setup();
    prikazi();
    await screen.findByText('Ana Petrovic');

    await user.click(screen.getByRole('button', { name: '+ Paket' }));

    expect(screen.getByRole('dialog', { name: 'Dodela paketa' })).toBeInTheDocument();
  });
});
