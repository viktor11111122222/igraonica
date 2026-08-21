import { describe, test, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Reservations from '../Reservations';
import { get, post, patch, del } from '../../lib/api';

vi.mock('../../lib/api', () => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), del: vi.fn() }));
vi.mock('../../components/Layout', () => ({
  PageHeader: ({ title, children }) => (<div><h1>{title}</h1>{children}</div>),
}));

const rezervacija = {
  id: 'r1',
  type: 'BIRTHDAY',
  title: 'Rodjendan',
  date: '2026-09-05',
  startTime: '17:00',
  endTime: '20:00',
  guestCount: 15,
  childName: 'Lena',
  childAge: 6,
  contactPhone: '060111222',
  notes: null,
  isFullDay: false,
  status: 'PENDING',
};

const odgovor = (reservations = [rezervacija]) => ({
  reservations,
  pagination: { page: 1, pages: 1, total: reservations.length },
});

beforeEach(() => {
  get.mockReset().mockResolvedValue(odgovor());
  post.mockReset().mockResolvedValue({});
  patch.mockReset().mockResolvedValue({});
  del.mockReset().mockResolvedValue({});
});

describe('Reservations - lista', () => {
  test('prikazuje rezervaciju sa tipom, datumom i gostima', async () => {
    render(<Reservations />);

    expect(await screen.findByText('Rodjendan')).toBeInTheDocument();
    expect(screen.getAllByText('Rodjendan').length).toBeGreaterThan(0);
    expect(screen.getByText('05.09.2026.')).toBeInTheDocument();
    expect(screen.getByText('15')).toBeInTheDocument();
    // Ime i uzrast su u istom redu, razdvojeni u dva cvora.
    expect(screen.getByText(/Lena, 6 god\./)).toBeInTheDocument();
  });

  test('bez gostiju stoji crtica', async () => {
    get.mockResolvedValue(odgovor([{ ...rezervacija, guestCount: null }]));
    render(<Reservations />);

    await screen.findByText('Rodjendan');
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  test('prazna lista nudi da se napravi rezervacija', async () => {
    get.mockResolvedValue(odgovor([]));
    render(<Reservations />);

    expect(await screen.findByText('Nema rezervacija')).toBeInTheDocument();
  });

  test('filteri idu u zahtev', async () => {
    const user = userEvent.setup();
    render(<Reservations />);
    await screen.findByText('05.09.2026.');

    const [status, tip] = screen.getAllByRole('combobox');
    await user.selectOptions(status, 'CONFIRMED');
    await waitFor(() => expect(get).toHaveBeenCalledWith(expect.stringContaining('status=CONFIRMED')));

    await user.selectOptions(tip, 'GROUP_BOOKING');
    await waitFor(() => expect(get).toHaveBeenCalledWith(expect.stringContaining('type=GROUP_BOOKING')));
  });
});

describe('Reservations - status', () => {
  test('potvrda menja status', async () => {
    const user = userEvent.setup();
    render(<Reservations />);
    await screen.findByText('05.09.2026.');

    await user.click(screen.getByRole('button', { name: 'Potvrdi' }));

    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith('/reservations/r1', { status: 'CONFIRMED' })
    );
  });

  test('vec potvrdjena rezervacija nema dugme "Potvrdi"', async () => {
    get.mockResolvedValue(odgovor([{ ...rezervacija, status: 'CONFIRMED' }]));
    render(<Reservations />);

    await screen.findByText('05.09.2026.');
    expect(screen.queryByRole('button', { name: 'Potvrdi' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Otkazi' })).toBeInTheDocument();
  });

  test('otkazana rezervacija nema dugme "Otkazi"', async () => {
    get.mockResolvedValue(odgovor([{ ...rezervacija, status: 'CANCELLED' }]));
    render(<Reservations />);

    await screen.findByText('05.09.2026.');
    expect(screen.queryByRole('button', { name: 'Otkazi' })).toBeNull();
  });
});

describe('Reservations - prozor', () => {
  test('dugme "Sacuvaj" pripada formi', async () => {
    const user = userEvent.setup();
    render(<Reservations />);
    await screen.findByText('05.09.2026.');

    await user.click(screen.getByRole('button', { name: 'Nova rezervacija' }));

    expect(screen.getByRole('button', { name: 'Sacuvaj' }).form?.id).toBe('rezervacija-forma');
  });

  test('prazna forma se ne salje', async () => {
    const user = userEvent.setup();
    render(<Reservations />);
    await screen.findByText('05.09.2026.');
    await user.click(screen.getByRole('button', { name: 'Nova rezervacija' }));

    await user.click(screen.getByRole('button', { name: 'Sacuvaj' }));

    expect(post).not.toHaveBeenCalled();
  });

  test('nova rezervacija salje brojeve kao brojeve', async () => {
    const user = userEvent.setup();
    render(<Reservations />);
    await screen.findByText('05.09.2026.');
    await user.click(screen.getByRole('button', { name: 'Nova rezervacija' }));

    const dijalog = screen.getByRole('dialog');
    await user.type(within(dijalog).getByLabelText('Naziv'), 'Proslava');
    await user.type(within(dijalog).getByLabelText('Broj gostiju'), '25');
    await user.click(screen.getByRole('button', { name: 'Sacuvaj' }));

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/reservations', expect.objectContaining({
        title: 'Proslava',
        guestCount: 25,
      }))
    );
  });

  // Prazna neobavezna polja ne smeju da odu kao prazan tekst.
  test('neuneta polja se ne salju', async () => {
    const user = userEvent.setup();
    render(<Reservations />);
    await screen.findByText('05.09.2026.');
    await user.click(screen.getByRole('button', { name: 'Nova rezervacija' }));

    const dijalog = screen.getByRole('dialog');
    await user.type(within(dijalog).getByLabelText('Naziv'), 'Proslava');
    await user.click(screen.getByRole('button', { name: 'Sacuvaj' }));

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/reservations', expect.objectContaining({
        guestCount: undefined,
        childName: undefined,
        contactPhone: undefined,
        notes: undefined,
      }))
    );
  });
});

describe('Reservations - brisanje', () => {
  test('potvrda brise rezervaciju', async () => {
    const user = userEvent.setup();
    render(<Reservations />);
    await screen.findByText('05.09.2026.');

    await user.click(screen.getByRole('button', { name: 'Obrisi' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Obrisi' }));

    await waitFor(() => expect(del).toHaveBeenCalledWith('/reservations/r1'));
  });

  test('greska pri brisanju se vidi u dijalogu', async () => {
    del.mockRejectedValue(new Error('Rezervacija je vec obrisana.'));
    const user = userEvent.setup();
    render(<Reservations />);
    await screen.findByText('05.09.2026.');

    await user.click(screen.getByRole('button', { name: 'Obrisi' }));
    const dijalog = screen.getByRole('dialog');
    await user.click(within(dijalog).getByRole('button', { name: 'Obrisi' }));

    expect(await within(dijalog).findByText('Rezervacija je vec obrisana.')).toBeInTheDocument();
  });
});
