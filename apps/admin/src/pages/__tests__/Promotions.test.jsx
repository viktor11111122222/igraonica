import { describe, test, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Promotions from '../Promotions';
import { get, post, patch, del } from '../../lib/api';

vi.mock('../../lib/api', () => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), del: vi.fn() }));
vi.mock('../../components/Layout', () => ({
  PageHeader: ({ title, children }) => (
    <div>
      <h1>{title}</h1>
      {children}
    </div>
  ),
}));

function pomereno(dana) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + dana);
  return d.toISOString().split('T')[0];
}

const akcija = {
  id: 'a1',
  title: 'Letnja akcija',
  description: 'Popust na sve pakete.',
  discountType: 'PERCENT',
  discountValue: 20,
  dateFrom: pomereno(-1),
  dateTo: pomereno(1),
  isActive: true,
};

beforeEach(() => {
  get.mockReset().mockResolvedValue({ promotions: [akcija] });
  post.mockReset().mockResolvedValue({});
  patch.mockReset().mockResolvedValue({});
  del.mockReset().mockResolvedValue({});
});

describe('Promotions - lista', () => {
  test('prikazuje akciju sa popustom i periodom', async () => {
    render(<Promotions />);

    expect(await screen.findByText('Letnja akcija')).toBeInTheDocument();
    expect(screen.getByText('Popust na sve pakete.')).toBeInTheDocument();
    expect(screen.getByText('20%')).toBeInTheDocument();
    expect(screen.getByText(`${akcija.dateFrom} – ${akcija.dateTo}`)).toBeInTheDocument();
  });

  // Stanje se racuna iz datuma, da niko ne mora rucno da gasi istekle akcije.
  test('akcija koja traje je oznacena kao takva', async () => {
    render(<Promotions />);
    expect(await screen.findByText('Traje')).toBeInTheDocument();
  });

  test('istekla akcija se vidi kao istekla', async () => {
    get.mockResolvedValue({
      promotions: [{ ...akcija, dateFrom: pomereno(-9), dateTo: pomereno(-2) }],
    });
    render(<Promotions />);

    expect(await screen.findByText('Istekla')).toBeInTheDocument();
  });

  test('buduca akcija se vidi kao zakazana', async () => {
    get.mockResolvedValue({
      promotions: [{ ...akcija, dateFrom: pomereno(2), dateTo: pomereno(9) }],
    });
    render(<Promotions />);

    expect(await screen.findByText('Zakazana')).toBeInTheDocument();
  });

  test('iskljucena akcija se vidi kao iskljucena', async () => {
    get.mockResolvedValue({ promotions: [{ ...akcija, isActive: false }] });
    render(<Promotions />);

    expect(await screen.findByText('Iskljucena')).toBeInTheDocument();
  });

  test('iznos u dinarima se ne pise kao procenat', async () => {
    get.mockResolvedValue({
      promotions: [{ ...akcija, discountType: 'AMOUNT', discountValue: 500 }],
    });
    render(<Promotions />);

    expect(await screen.findByText('500 RSD')).toBeInTheDocument();
  });

  test('bez akcija nudi da se napravi prva', async () => {
    get.mockResolvedValue({ promotions: [] });
    render(<Promotions />);

    expect(await screen.findByText('Nema akcija')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Nova akcija' })).toHaveLength(2);
  });
});

describe('Promotions - unos', () => {
  test('salje naziv, popust i period', async () => {
    const korisnik = userEvent.setup();
    render(<Promotions />);

    await korisnik.click(await screen.findByRole('button', { name: 'Nova akcija' }));
    await korisnik.type(screen.getByLabelText('Naziv'), 'Jesenja akcija');
    await korisnik.clear(screen.getByLabelText('Procenat (%)'));
    await korisnik.type(screen.getByLabelText('Procenat (%)'), '15');
    await korisnik.click(screen.getByRole('button', { name: 'Sacuvaj' }));

    await waitFor(() => expect(post).toHaveBeenCalled());
    const [put, telo] = post.mock.calls[0];
    expect(put).toBe('/promotions');
    expect(telo.title).toBe('Jesenja akcija');
    expect(telo.discountValue).toBe(15);
    expect(telo.dateFrom).toBeTruthy();
    expect(telo.dateTo).toBeTruthy();
  });

  // Akcija "drugo dete besplatno" se ne izrazava brojem, pa polje nestaje
  // umesto da stoji prazno i trazi vrednost koje nema.
  test('opisna akcija sakriva polje za broj i salje praznu vrednost', async () => {
    const korisnik = userEvent.setup();
    render(<Promotions />);

    await korisnik.click(await screen.findByRole('button', { name: 'Nova akcija' }));
    expect(screen.getByLabelText('Procenat (%)')).toBeInTheDocument();

    await korisnik.selectOptions(screen.getByLabelText('Vrsta popusta'), 'TEXT');
    expect(screen.queryByLabelText('Procenat (%)')).not.toBeInTheDocument();

    await korisnik.type(screen.getByLabelText('Naziv'), 'Drugo dete besplatno');
    await korisnik.click(screen.getByRole('button', { name: 'Sacuvaj' }));

    await waitFor(() => expect(post).toHaveBeenCalled());
    expect(post.mock.calls[0][1].discountValue).toBeNull();
  });

  test('iznos u dinarima menja natpis polja', async () => {
    const korisnik = userEvent.setup();
    render(<Promotions />);

    await korisnik.click(await screen.findByRole('button', { name: 'Nova akcija' }));
    await korisnik.selectOptions(screen.getByLabelText('Vrsta popusta'), 'AMOUNT');

    expect(screen.getByLabelText('Iznos (RSD)')).toBeInTheDocument();
  });

  test('izmena salje PATCH na postojecu akciju', async () => {
    const korisnik = userEvent.setup();
    render(<Promotions />);

    await korisnik.click(await screen.findByRole('button', { name: 'Izmeni' }));
    await korisnik.clear(screen.getByLabelText('Naziv'));
    await korisnik.type(screen.getByLabelText('Naziv'), 'Promenjeno');
    await korisnik.click(screen.getByRole('button', { name: 'Sacuvaj' }));

    await waitFor(() => expect(patch).toHaveBeenCalled());
    expect(patch.mock.calls[0][0]).toBe('/promotions/a1');
    expect(patch.mock.calls[0][1].title).toBe('Promenjeno');
  });

  test('greska sa servera ostaje u prozoru', async () => {
    post.mockRejectedValue(new Error('Datum kraja ne moze biti pre datuma pocetka.'));
    const korisnik = userEvent.setup();
    render(<Promotions />);

    await korisnik.click(await screen.findByRole('button', { name: 'Nova akcija' }));
    await korisnik.type(screen.getByLabelText('Naziv'), 'Losa');
    await korisnik.clear(screen.getByLabelText('Procenat (%)'));
    await korisnik.type(screen.getByLabelText('Procenat (%)'), '10');
    await korisnik.click(screen.getByRole('button', { name: 'Sacuvaj' }));

    // Poruka stoji i u traci stranice i u samom prozoru - radnik je vidi bez
    // obzira da li je prozor jos otvoren.
    expect(
      await within(screen.getByRole('dialog')).findByText(
        'Datum kraja ne moze biti pre datuma pocetka.'
      )
    ).toBeInTheDocument();
  });
});

describe('Promotions - brisanje', () => {
  test('trazi potvrdu pa brise', async () => {
    const korisnik = userEvent.setup();
    render(<Promotions />);

    await korisnik.click(await screen.findByRole('button', { name: 'Obrisi' }));
    expect(screen.getByText('Obrisati akciju?')).toBeInTheDocument();

    await korisnik.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Obrisi' })
    );
    await waitFor(() => expect(del).toHaveBeenCalledWith('/promotions/a1'));
  });
});
