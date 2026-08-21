import { describe, test, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Children from '../Children';
import { get } from '../../lib/api';

vi.mock('../../lib/api', () => ({ get: vi.fn() }));
vi.mock('../../components/Layout', () => ({ PageHeader: ({ title }) => <h1>{title}</h1> }));
vi.mock('../../components/AssignPackage', () => ({
  default: ({ user, childName, onClose }) => (
    <div role="dialog" aria-label="Dodela paketa">
      {user.firstName} · {childName}
      <button onClick={onClose}>Zatvori</button>
    </div>
  ),
}));

const dete = {
  id: 'c1',
  firstName: 'Lena',
  lastName: 'Petrovic',
  dateOfBirth: '2020-05-10',
  qrCode: 'IGR-B4F46AB6',
  allergies: 'Kikiriki',
  parentRemainingHours: 7.5,
  parent: { id: 'u1', firstName: 'Ana', lastName: 'Petrovic' },
};

const odgovor = (children = [dete]) => ({
  children,
  pagination: { page: 1, pages: 1, total: children.length },
});

const prikazi = () => render(<MemoryRouter><Children /></MemoryRouter>);

beforeEach(() => {
  get.mockReset().mockResolvedValue(odgovor());
});

describe('Children', () => {
  test('prikazuje dete sa QR kodom i uzrastom', async () => {
    prikazi();

    expect(await screen.findByText('Lena Petrovic')).toBeInTheDocument();
    expect(screen.getByText('IGR-B4F46AB6')).toBeInTheDocument();
    expect(screen.getByText('Kikiriki')).toBeInTheDocument();
  });

  test('roditelj vodi na svoju stranicu', async () => {
    prikazi();

    const veza = await screen.findByRole('link', { name: 'Ana Petrovic' });
    expect(veza).toHaveAttribute('href', '/korisnici/u1');
  });

  test('dete bez alergija ima crticu, ne prazno polje', async () => {
    get.mockResolvedValue(odgovor([{ ...dete, allergies: null }]));
    prikazi();

    await screen.findByText('Lena Petrovic');
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  // Osoblje pri prijavi mora odmah da vidi da roditelj nema sati.
  test('roditelj bez sati je jasno oznacen', async () => {
    get.mockResolvedValue(odgovor([{ ...dete, parentRemainingHours: 0 }]));
    prikazi();

    expect(await screen.findByText('nema sati')).toBeInTheDocument();
  });

  test('roditelj sa satima ih prikazuje', async () => {
    prikazi();
    expect(await screen.findByText('7,5 h')).toBeInTheDocument();
  });

  test('pretraga se salje tek kada se kucanje smiri', async () => {
    const user = userEvent.setup();
    prikazi();
    await screen.findByText('Lena Petrovic');

    await user.type(screen.getByPlaceholderText(/Pretraga/), 'IGR-B4');

    await waitFor(() =>
      expect(get).toHaveBeenCalledWith(expect.stringContaining('search=IGR-B4'))
    );
  });

  test('ponistavanje prazni pretragu', async () => {
    const user = userEvent.setup();
    prikazi();
    await screen.findByText('Lena Petrovic');
    const polje = screen.getByPlaceholderText(/Pretraga/);
    await user.type(polje, 'lena');

    await user.click(await screen.findByRole('button', { name: 'Ponisti' }));

    expect(polje).toHaveValue('');
  });

  test('prazna lista javlja da nista ne odgovara', async () => {
    get.mockResolvedValue(odgovor([]));
    prikazi();

    expect(await screen.findByText('Nema dece')).toBeInTheDocument();
  });

  // Paket se vodi na roditelja, pa dodela sa deteta mora da posalje roditelja.
  test('dodela paketa sa deteta salje roditelja i ime deteta', async () => {
    const user = userEvent.setup();
    prikazi();
    await screen.findByText('Lena Petrovic');

    await user.click(screen.getByRole('button', { name: '+ Paket' }));

    const dijalog = screen.getByRole('dialog', { name: 'Dodela paketa' });
    expect(dijalog).toHaveTextContent('Ana · Lena');
  });

  test('greska pri ucitavanju se prikazuje', async () => {
    get.mockRejectedValue(new Error('Nema veze sa serverom.'));
    prikazi();

    expect(await screen.findByText('Nema veze sa serverom.')).toBeInTheDocument();
  });
});
