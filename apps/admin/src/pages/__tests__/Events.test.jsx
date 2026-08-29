import { describe, test, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Events from '../Events';
import { get, post, patch, del } from '../../lib/api';

vi.mock('../../lib/api', () => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), del: vi.fn() }));
vi.mock('../../components/Layout', () => ({
  PageHeader: ({ title, children }) => (<div><h1>{title}</h1>{children}</div>),
}));

const dogadjaj = {
  id: 'd1',
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

const odgovor = (events = [dogadjaj]) => ({
  events,
  pagination: { page: 1, pages: 1, total: events.length },
});

beforeEach(() => {
  get.mockReset().mockResolvedValue(odgovor());
  post.mockReset().mockResolvedValue({});
  patch.mockReset().mockResolvedValue({});
  del.mockReset().mockResolvedValue({});
});

describe('Events - lista', () => {
  test('prikazuje dogadjaj sa tipom, datumom i gostima', async () => {
    render(<Events />);

    expect(await screen.findByText('Rodjendan')).toBeInTheDocument();
    expect(screen.getByText('05.09.2026.')).toBeInTheDocument();
    expect(screen.getByText('15')).toBeInTheDocument();
    // Ime i uzrast su u istom redu, razdvojeni u dva cvora.
    expect(screen.getByText(/Lena, 6 god\./)).toBeInTheDocument();
  });

  // Dogadjaji imaju svoju rutu; da su isla na /reservations, roditelji bi ih
  // videli u mobilnoj aplikaciji.
  test('cita iz /events, ne iz /reservations', async () => {
    render(<Events />);

    await screen.findByText('05.09.2026.');
    expect(get).toHaveBeenCalledWith(expect.stringContaining('/events?'));
    expect(get).not.toHaveBeenCalledWith(expect.stringContaining('/reservations'));
  });

  test('bez gostiju stoji crtica', async () => {
    get.mockResolvedValue(odgovor([{ ...dogadjaj, guestCount: null }]));
    render(<Events />);

    await screen.findByText('Rodjendan');
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  test('prazna lista nudi da se napravi dogadjaj', async () => {
    get.mockResolvedValue(odgovor([]));
    render(<Events />);

    expect(await screen.findByText('Nema dogadjaja')).toBeInTheDocument();
  });

  test('filteri idu u zahtev', async () => {
    const user = userEvent.setup();
    render(<Events />);
    await screen.findByText('05.09.2026.');

    const [status, tip] = screen.getAllByRole('combobox');
    await user.selectOptions(status, 'CONFIRMED');
    await waitFor(() => expect(get).toHaveBeenCalledWith(expect.stringContaining('status=CONFIRMED')));

    await user.selectOptions(tip, 'GROUP_BOOKING');
    await waitFor(() => expect(get).toHaveBeenCalledWith(expect.stringContaining('type=GROUP_BOOKING')));
  });
});

describe('Events - status', () => {
  test('potvrda menja status', async () => {
    const user = userEvent.setup();
    render(<Events />);
    await screen.findByText('05.09.2026.');

    await user.click(screen.getByRole('button', { name: 'Potvrdi' }));

    await waitFor(() => expect(patch).toHaveBeenCalledWith('/events/d1', { status: 'CONFIRMED' }));
  });

  test('vec potvrdjen dogadjaj nema dugme "Potvrdi"', async () => {
    get.mockResolvedValue(odgovor([{ ...dogadjaj, status: 'CONFIRMED' }]));
    render(<Events />);

    await screen.findByText('05.09.2026.');
    expect(screen.queryByRole('button', { name: 'Potvrdi' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Otkazi' })).toBeInTheDocument();
  });

  test('otkazan dogadjaj nema dugme "Otkazi"', async () => {
    get.mockResolvedValue(odgovor([{ ...dogadjaj, status: 'CANCELLED' }]));
    render(<Events />);

    await screen.findByText('05.09.2026.');
    expect(screen.queryByRole('button', { name: 'Otkazi' })).toBeNull();
  });
});

describe('Events - prozor', () => {
  test('dugme "Sacuvaj" pripada formi', async () => {
    const user = userEvent.setup();
    render(<Events />);
    await screen.findByText('05.09.2026.');

    await user.click(screen.getByRole('button', { name: 'Novi dogadjaj' }));

    expect(screen.getByRole('button', { name: 'Sacuvaj' }).form?.id).toBe('dogadjaj-forma');
  });

  test('prazna forma se ne salje', async () => {
    const user = userEvent.setup();
    render(<Events />);
    await screen.findByText('05.09.2026.');
    await user.click(screen.getByRole('button', { name: 'Novi dogadjaj' }));

    await user.click(screen.getByRole('button', { name: 'Sacuvaj' }));

    expect(post).not.toHaveBeenCalled();
  });

  test('novi dogadjaj salje brojeve kao brojeve', async () => {
    const user = userEvent.setup();
    render(<Events />);
    await screen.findByText('05.09.2026.');
    await user.click(screen.getByRole('button', { name: 'Novi dogadjaj' }));

    const dijalog = screen.getByRole('dialog');
    await user.type(within(dijalog).getByLabelText('Naziv'), 'Proslava');
    await user.type(within(dijalog).getByLabelText('Broj gostiju'), '25');
    await user.click(screen.getByRole('button', { name: 'Sacuvaj' }));

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/events', expect.objectContaining({
        title: 'Proslava',
        guestCount: 25,
      }))
    );
  });

  // Prazna neobavezna polja ne smeju da odu kao prazan tekst.
  test('neuneta polja se ne salju', async () => {
    const user = userEvent.setup();
    render(<Events />);
    await screen.findByText('05.09.2026.');
    await user.click(screen.getByRole('button', { name: 'Novi dogadjaj' }));

    const dijalog = screen.getByRole('dialog');
    await user.type(within(dijalog).getByLabelText('Naziv'), 'Proslava');
    await user.click(screen.getByRole('button', { name: 'Sacuvaj' }));

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/events', expect.objectContaining({
        guestCount: undefined,
        childName: undefined,
        contactPhone: undefined,
        notes: undefined,
      }))
    );
  });
});

describe('Events - brisanje', () => {
  test('potvrda brise dogadjaj', async () => {
    const user = userEvent.setup();
    render(<Events />);
    await screen.findByText('05.09.2026.');

    await user.click(screen.getByRole('button', { name: 'Obrisi' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Obrisi' }));

    await waitFor(() => expect(del).toHaveBeenCalledWith('/events/d1'));
  });

  test('greska pri brisanju se vidi u dijalogu', async () => {
    del.mockRejectedValue(new Error('Dogadjaj je vec obrisan.'));
    const user = userEvent.setup();
    render(<Events />);
    await screen.findByText('05.09.2026.');

    await user.click(screen.getByRole('button', { name: 'Obrisi' }));
    const dijalog = screen.getByRole('dialog');
    await user.click(within(dijalog).getByRole('button', { name: 'Obrisi' }));

    expect(await within(dijalog).findByText('Dogadjaj je vec obrisan.')).toBeInTheDocument();
  });
});

// Tip "Drugo" postoji da osoblje ne ceka izmenu koda za svaku novu vrstu.
describe('Events - sopstveni tip', () => {
  test('tabela prikazuje upisani naziv umesto "Drugo"', async () => {
    get.mockResolvedValue(odgovor([{ ...dogadjaj, type: 'OTHER', customType: 'Radionica slikanja' }]));
    render(<Events />);

    await screen.findByText('05.09.2026.');
    // "Drugo" i dalje stoji u filteru, pa se gleda samo tabela.
    const tabela = screen.getByRole('table');
    expect(within(tabela).getByText('Radionica slikanja')).toBeInTheDocument();
    expect(within(tabela).queryByText('Drugo')).toBeNull();
  });

  test('polje za naziv tipa se vidi tek kad se izabere "Drugo"', async () => {
    const user = userEvent.setup();
    render(<Events />);
    await screen.findByText('05.09.2026.');
    await user.click(screen.getByRole('button', { name: 'Novi dogadjaj' }));

    const dijalog = screen.getByRole('dialog');
    expect(within(dijalog).queryByLabelText('Naziv tipa')).toBeNull();

    await user.selectOptions(within(dijalog).getByLabelText('Tip'), 'OTHER');
    expect(within(dijalog).getByLabelText('Naziv tipa')).toBeInTheDocument();
  });

  test('upisani tip ide u zahtev', async () => {
    const user = userEvent.setup();
    render(<Events />);
    await screen.findByText('05.09.2026.');
    await user.click(screen.getByRole('button', { name: 'Novi dogadjaj' }));

    const dijalog = screen.getByRole('dialog');
    await user.selectOptions(within(dijalog).getByLabelText('Tip'), 'OTHER');
    await user.type(within(dijalog).getByLabelText('Naziv tipa'), 'Radionica slikanja');
    await user.type(within(dijalog).getByLabelText('Naziv'), 'Prva grupa');
    await user.click(screen.getByRole('button', { name: 'Sacuvaj' }));

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/events', expect.objectContaining({
        type: 'OTHER',
        customType: 'Radionica slikanja',
        title: 'Prva grupa',
      }))
    );
  });

  // Prazan naziv tipa zaustavlja slanje jos u pretrazivacu (polje je required).
  test('"Drugo" bez naziva tipa se ne salje', async () => {
    const user = userEvent.setup();
    render(<Events />);
    await screen.findByText('05.09.2026.');
    await user.click(screen.getByRole('button', { name: 'Novi dogadjaj' }));

    const dijalog = screen.getByRole('dialog');
    await user.type(within(dijalog).getByLabelText('Naziv'), 'Prva grupa');
    await user.selectOptions(within(dijalog).getByLabelText('Tip'), 'OTHER');
    await user.click(screen.getByRole('button', { name: 'Sacuvaj' }));

    expect(post).not.toHaveBeenCalled();
  });

  test('tip iz spiska ne salje naziv tipa', async () => {
    const user = userEvent.setup();
    render(<Events />);
    await screen.findByText('05.09.2026.');
    await user.click(screen.getByRole('button', { name: 'Novi dogadjaj' }));

    const dijalog = screen.getByRole('dialog');
    await user.type(within(dijalog).getByLabelText('Naziv'), 'Proslava');
    await user.click(screen.getByRole('button', { name: 'Sacuvaj' }));

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/events', expect.objectContaining({ customType: undefined }))
    );
  });

  test('izmena ucitava upisani naziv u formu', async () => {
    get.mockResolvedValue(odgovor([{ ...dogadjaj, type: 'OTHER', customType: 'Radionica slikanja' }]));
    const user = userEvent.setup();
    render(<Events />);
    await screen.findByText('05.09.2026.');

    await user.click(screen.getByRole('button', { name: 'Izmeni' }));

    const dijalog = screen.getByRole('dialog');
    expect(within(dijalog).getByLabelText('Naziv tipa')).toHaveValue('Radionica slikanja');
  });

  test('filter nudi "Drugo"', async () => {
    const user = userEvent.setup();
    render(<Events />);
    await screen.findByText('05.09.2026.');

    const [, tip] = screen.getAllByRole('combobox');
    await user.selectOptions(tip, 'OTHER');

    await waitFor(() => expect(get).toHaveBeenCalledWith(expect.stringContaining('type=OTHER')));
  });
});
