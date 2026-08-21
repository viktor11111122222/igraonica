import { describe, test, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AssignPackage from '../AssignPackage';
import { get, post } from '../../lib/api';

vi.mock('../../lib/api', () => ({ get: vi.fn(), post: vi.fn() }));

const roditelj = { id: 'u1', firstName: 'Ana', lastName: 'Petrovic' };
const paketi = [
  { id: 'p1', name: 'Paket 10h', description: 'Za redovne', totalHours: 10, validityDays: 30 },
  { id: 'p2', name: 'Paket 20h', totalHours: 20, validityDays: 60 },
];

const prikazi = (props = {}) =>
  render(<AssignPackage user={roditelj} onClose={vi.fn()} onDone={vi.fn()} {...props} />);

beforeEach(() => {
  get.mockReset().mockResolvedValue({ packages: paketi });
  post.mockReset().mockResolvedValue({});
});

describe('AssignPackage', () => {
  test('nudi pakete sa satima i rokom', async () => {
    prikazi();

    expect(await screen.findByText('Paket 10h')).toBeInTheDocument();
    expect(screen.getByText('10,0 h')).toBeInTheDocument();
    expect(screen.getByText('vazi 30 dana')).toBeInTheDocument();
  });

  // Paket se vodi na roditelja, pa i kada se dodela pokrece sa deteta mora biti
  // jasno cije sate dete trosi.
  test('sa deteta objasnjava da paket ide na roditelja', async () => {
    prikazi({ childName: 'Lena' });

    expect(await screen.findByText(/Lena/)).toBeInTheDocument();
    expect(screen.getByText('Ana Petrovic')).toBeInTheDocument();
  });

  test('bez deteta pise cije sate koriste deca', async () => {
    prikazi();
    expect(await screen.findByText(/Sate koriste sva/)).toBeInTheDocument();
  });

  test('dok paket nije izabran, dodela je zakljucana', async () => {
    prikazi();
    await screen.findByText('Paket 10h');

    expect(screen.getByRole('button', { name: 'Dodeli paket' })).toBeDisabled();
  });

  // Kada postoji samo jedan paket, nema sta da se bira.
  test('jedan paket se bira sam', async () => {
    get.mockResolvedValue({ packages: [paketi[0]] });
    prikazi();

    await screen.findByText('Paket 10h');
    expect(screen.getByRole('button', { name: 'Dodeli paket' })).toBeEnabled();
  });

  test('dodela salje izabrani paket i napomenu', async () => {
    const onDone = vi.fn();
    const onClose = vi.fn();
    const user = userEvent.setup();
    prikazi({ onDone, onClose });
    await screen.findByText('Paket 20h');

    await user.click(screen.getByText('Paket 20h'));
    await user.type(screen.getByLabelText(/Napomena/), 'poklon sati');
    await user.click(screen.getByRole('button', { name: 'Dodeli paket' }));

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/packages/assign', {
        userId: 'u1',
        packageId: 'p2',
        notes: 'poklon sati',
      })
    );
    expect(onDone).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  test('prazna napomena se ne salje kao prazan tekst', async () => {
    const user = userEvent.setup();
    prikazi();
    await screen.findByText('Paket 10h');

    await user.click(screen.getByText('Paket 10h'));
    await user.click(screen.getByRole('button', { name: 'Dodeli paket' }));

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/packages/assign', expect.objectContaining({ notes: undefined }))
    );
  });

  test('bez ijednog paketa upucuje na stranicu Paketi', async () => {
    get.mockResolvedValue({ packages: [] });
    prikazi();

    expect(await screen.findByText(/Napravite ga na stranici Paketi/)).toBeInTheDocument();
  });

  test('greska pri ucitavanju paketa se prikazuje', async () => {
    get.mockRejectedValue(new Error('Nema veze sa serverom.'));
    prikazi();

    expect(await screen.findByText('Nema veze sa serverom.')).toBeInTheDocument();
  });

  test('greska pri dodeli ostavlja prozor otvoren', async () => {
    post.mockRejectedValue(new Error('Roditelj vec ima ovaj paket.'));
    const onClose = vi.fn();
    const user = userEvent.setup();
    prikazi({ onClose });
    await screen.findByText('Paket 10h');

    await user.click(screen.getByText('Paket 10h'));
    await user.click(screen.getByRole('button', { name: 'Dodeli paket' }));

    expect(await screen.findByText('Roditelj vec ima ovaj paket.')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});
