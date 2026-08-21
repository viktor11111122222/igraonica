import { describe, test, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Packages from '../Packages';
import { get, post, patch, del } from '../../lib/api';

vi.mock('../../lib/api', () => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), del: vi.fn() }));
vi.mock('../../components/Layout', () => ({
  PageHeader: ({ title, children }) => (<div><h1>{title}</h1>{children}</div>),
}));

const paket = {
  id: 'p1',
  name: 'Paket 10h',
  description: 'Za redovne dolaske',
  totalHours: 10,
  validityDays: 30,
};

beforeEach(() => {
  get.mockReset().mockResolvedValue({ packages: [paket] });
  post.mockReset().mockResolvedValue({});
  patch.mockReset().mockResolvedValue({});
  del.mockReset().mockResolvedValue({});
});

describe('Packages - lista', () => {
  test('prikazuje pakete sa satima i rokom', async () => {
    render(<Packages />);

    expect(await screen.findByText('Paket 10h')).toBeInTheDocument();
    expect(screen.getByText('Za redovne dolaske')).toBeInTheDocument();
    expect(screen.getByText('10,0 h')).toBeInTheDocument();
    expect(screen.getByText('30 d')).toBeInTheDocument();
  });

  test('bez paketa nudi da se napravi prvi', async () => {
    get.mockResolvedValue({ packages: [] });
    render(<Packages />);

    expect(await screen.findByText('Nema paketa')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Nov paket' })).toHaveLength(2);
  });
});

describe('Packages - prozor za paket', () => {
  test('dugme "Sacuvaj" pripada formi', async () => {
    const user = userEvent.setup();
    render(<Packages />);
    await screen.findByText('Paket 10h');

    await user.click(screen.getByRole('button', { name: 'Nov paket' }));

    const sacuvaj = screen.getByRole('button', { name: 'Sacuvaj' });
    expect(sacuvaj.form?.id).toBe('paket-forma');
  });

  test('prazna forma se ne salje', async () => {
    const user = userEvent.setup();
    render(<Packages />);
    await screen.findByText('Paket 10h');
    await user.click(screen.getByRole('button', { name: 'Nov paket' }));

    await user.click(screen.getByRole('button', { name: 'Sacuvaj' }));

    expect(post).not.toHaveBeenCalled();
  });

  test('nov paket salje brojeve, ne tekst', async () => {
    const user = userEvent.setup();
    render(<Packages />);
    await screen.findByText('Paket 10h');
    await user.click(screen.getByRole('button', { name: 'Nov paket' }));

    const dijalog = screen.getByRole('dialog');
    await user.type(within(dijalog).getByLabelText('Naziv'), 'Paket 20h');
    await user.type(within(dijalog).getByLabelText('Ukupno sati'), '20');
    await user.click(screen.getByRole('button', { name: 'Sacuvaj' }));

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/packages', {
        name: 'Paket 20h',
        description: undefined,
        totalHours: 20,
        validityDays: 30,
      })
    );
  });

  test('izmena postojeceg ide na patch sa istim id-em', async () => {
    const user = userEvent.setup();
    render(<Packages />);
    await screen.findByText('Paket 10h');

    await user.click(screen.getByRole('button', { name: 'Izmeni' }));
    const dijalog = screen.getByRole('dialog');
    await user.clear(within(dijalog).getByLabelText('Vazenje (dana)'));
    await user.type(within(dijalog).getByLabelText('Vazenje (dana)'), '60');
    await user.click(screen.getByRole('button', { name: 'Sacuvaj' }));

    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith('/packages/p1', expect.objectContaining({ validityDays: 60 }))
    );
  });
});

describe('Packages - deaktivacija', () => {
  test('potvrda brise paket', async () => {
    const user = userEvent.setup();
    render(<Packages />);
    await screen.findByText('Paket 10h');

    await user.click(screen.getByRole('button', { name: 'Deaktiviraj' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Deaktiviraj' }));

    await waitFor(() => expect(del).toHaveBeenCalledWith('/packages/p1'));
  });

  test('greska pri brisanju se vidi u dijalogu', async () => {
    del.mockRejectedValue(new Error('Paket je vec dodeljen.'));
    const user = userEvent.setup();
    render(<Packages />);
    await screen.findByText('Paket 10h');

    await user.click(screen.getByRole('button', { name: 'Deaktiviraj' }));
    const dijalog = screen.getByRole('dialog');
    await user.click(within(dijalog).getByRole('button', { name: 'Deaktiviraj' }));

    expect(await within(dijalog).findByText('Paket je vec dodeljen.')).toBeInTheDocument();
  });
});
