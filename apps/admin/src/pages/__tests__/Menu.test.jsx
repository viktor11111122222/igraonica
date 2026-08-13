import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Menu from '../Menu';
import { get, post, del } from '../../lib/api';

vi.mock('../../lib/api', () => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  del: vi.fn(),
}));

const PONEDELJAK = '2026-08-10';
const SREDA = '2026-08-12';
const NEDELJA = '2026-08-16';

const praznaNedelja = () => ({
  [PONEDELJAK]: [],
  '2026-08-11': [],
  [SREDA]: [],
  '2026-08-13': [],
  '2026-08-14': [],
  '2026-08-15': [],
  [NEDELJA]: [],
});

function odgovorNedelje(izmene = {}) {
  return {
    weekStart: PONEDELJAK,
    weekEnd: NEDELJA,
    week: { ...praznaNedelja(), ...izmene },
  };
}

// Kartice su poredjane po datumu, pa je indeks ujedno dan u nedelji
// (0 = ponedeljak). Pouzdanije nego traziti po formatiranom datumu, koji
// zavisi od locale podataka u okruzenju.
function kartice(container) {
  return [...container.querySelectorAll('.card')];
}

beforeEach(() => {
  // Zamrzava se SAMO Date, ne i tajmeri: userEvent iznutra koristi
  // setTimeout, pa bi mu lazni tajmeri pravili trke i testovi bi padali
  // nasumicno.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 7, 12, 12, 0, 0)); // sreda
  get.mockResolvedValue(odgovorNedelje());
  post.mockResolvedValue({ items: [] });
  del.mockResolvedValue({});
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Menu - prikaz nedelje', () => {
  test('trazi nedelju danasnjeg dana', async () => {
    render(<Menu />);
    await waitFor(() => expect(get).toHaveBeenCalledWith(`/menu/week?date=${SREDA}`));
  });

  test('prikazuje sedam dana, od ponedeljka do nedelje', async () => {
    const { container } = render(<Menu />);
    await waitFor(() => expect(kartice(container)).toHaveLength(7));

    expect(within(kartice(container)[0]).getByRole('heading')).toHaveTextContent('Ponedeljak');
    expect(within(kartice(container)[6]).getByRole('heading')).toHaveTextContent('Nedelja');
  });

  test('oznacava danasnji dan', async () => {
    render(<Menu />);
    expect(await screen.findByText('danas')).toBeInTheDocument();
  });

  test('prazan dan ima oznaku "prazno"', async () => {
    const { container } = render(<Menu />);
    await waitFor(() => expect(kartice(container)).toHaveLength(7));

    expect(within(kartice(container)[0]).getByText('prazno')).toBeInTheDocument();
  });

  test('popunjava polja iz ucitanih stavki', async () => {
    get.mockResolvedValue(
      odgovorNedelje({
        [PONEDELJAK]: [
          { id: 'm1', mealType: 'LUNCH', name: 'Pasulj', description: 'Uz hleb', allergens: 'gluten' },
        ],
      })
    );

    const { container } = render(<Menu />);
    // Ceka se sama vrednost, ne broj kartica: kartice se iscrtaju cim stignu
    // podaci, a polja se popunjavaju tek u sledecem prolazu.
    await screen.findByDisplayValue('Pasulj');

    const ponedeljak = kartice(container)[0];
    expect(within(ponedeljak).getByDisplayValue('Pasulj')).toBeInTheDocument();
    expect(within(ponedeljak).getByDisplayValue('Uz hleb')).toBeInTheDocument();
    expect(within(ponedeljak).getByDisplayValue('gluten')).toBeInTheDocument();
    expect(within(ponedeljak).getByText('1 od 4 obroka')).toBeInTheDocument();
  });

  // Opis i alergeni imaju smisla tek kada postoji jelo.
  test('opis i alergeni se pojavljuju tek kada se unese naziv', async () => {
    const user = userEvent.setup();
    const { container } = render(<Menu />);
    await waitFor(() => expect(kartice(container)).toHaveLength(7));

    const ponedeljak = kartice(container)[0];
    expect(within(ponedeljak).queryByPlaceholderText('Opis')).toBeNull();

    await user.type(within(ponedeljak).getAllByPlaceholderText('Naziv jela')[0], 'Griz');
    expect(within(ponedeljak).getAllByPlaceholderText('Opis')[0]).toBeInTheDocument();
  });
});

describe('Menu - cuvanje', () => {
  test('dugme za cuvanje je neaktivno dok se nista ne promeni', async () => {
    const { container } = render(<Menu />);
    await waitFor(() => expect(kartice(container)).toHaveLength(7));

    const dugme = within(kartice(container)[0]).getByRole('button', { name: 'Sacuvano' });
    expect(dugme).toBeDisabled();
  });

  test('unos aktivira dugme i salje samo taj dan', async () => {
    const user = userEvent.setup();
    const { container } = render(<Menu />);
    await waitFor(() => expect(kartice(container)).toHaveLength(7));

    const sreda = kartice(container)[2];
    await user.type(within(sreda).getAllByPlaceholderText('Naziv jela')[2], 'Boranija');

    const dugme = within(sreda).getByRole('button', { name: 'Sacuvaj ovaj dan' });
    expect(dugme).toBeEnabled();

    await user.click(dugme);

    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(post).toHaveBeenCalledWith('/menu/bulk', {
      items: [
        {
          date: SREDA,
          mealType: 'LUNCH',
          name: 'Boranija',
          description: undefined,
          allergens: undefined,
        },
      ],
    });
  });

  // Svaki dan se cuva zasebno - unos u sredu ne sme da povuce ostale dane.
  test('cuvanje jednog dana ne dira ostale', async () => {
    const user = userEvent.setup();
    const { container } = render(<Menu />);
    await waitFor(() => expect(kartice(container)).toHaveLength(7));

    await user.type(
      within(kartice(container)[2]).getAllByPlaceholderText('Naziv jela')[0],
      'Musli'
    );
    await user.type(
      within(kartice(container)[3]).getAllByPlaceholderText('Naziv jela')[0],
      'Palacinke'
    );

    await user.click(within(kartice(container)[2]).getByRole('button', { name: 'Sacuvaj ovaj dan' }));

    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    const [, telo] = post.mock.calls[0];
    expect(telo.items).toHaveLength(1);
    expect(telo.items[0].date).toBe(SREDA);
    expect(telo.items[0].name).toBe('Musli');
  });

  test('brisanje naziva postojece stavke je brise sa servera', async () => {
    const user = userEvent.setup();
    get.mockResolvedValue(
      odgovorNedelje({
        [PONEDELJAK]: [{ id: 'm1', mealType: 'BREAKFAST', name: 'Griz', description: null, allergens: null }],
      })
    );

    const { container } = render(<Menu />);
    await screen.findByDisplayValue('Griz');

    const ponedeljak = kartice(container)[0];
    await user.clear(within(ponedeljak).getByDisplayValue('Griz'));
    await user.click(within(ponedeljak).getByRole('button', { name: 'Sacuvaj ovaj dan' }));

    await waitFor(() => expect(del).toHaveBeenCalledWith('/menu/m1'));
    // Nema sta da se upise, pa se bulk ni ne poziva.
    expect(post).not.toHaveBeenCalled();
  });

  test('greska pri cuvanju se prikazuje', async () => {
    const user = userEvent.setup();
    post.mockRejectedValue(new Error('Nemas prava.'));

    const { container } = render(<Menu />);
    await waitFor(() => expect(kartice(container)).toHaveLength(7));

    const sreda = kartice(container)[2];
    await user.type(within(sreda).getAllByPlaceholderText('Naziv jela')[0], 'Musli');
    await user.click(within(sreda).getByRole('button', { name: 'Sacuvaj ovaj dan' }));

    expect(await screen.findByText('Nemas prava.')).toBeInTheDocument();
    // Dan ostaje "prljav", da se izmena ne izgubi.
    expect(within(sreda).getByRole('button', { name: 'Sacuvaj ovaj dan' })).toBeEnabled();
  });
});

describe('Menu - kopiranje prethodnog dana', () => {
  test('prepisuje obroke sa prethodnog dana', async () => {
    const user = userEvent.setup();
    get.mockResolvedValue(
      odgovorNedelje({
        [PONEDELJAK]: [
          { id: 'm1', mealType: 'LUNCH', name: 'Pasulj', description: 'Uz hleb', allergens: null },
        ],
      })
    );

    const { container } = render(<Menu />);
    await waitFor(() => expect(kartice(container)).toHaveLength(7));

    const utorak = kartice(container)[1];
    await user.click(within(utorak).getByRole('button', { name: 'Kopiraj prethodni dan' }));

    expect(within(utorak).getByDisplayValue('Pasulj')).toBeInTheDocument();
    expect(within(utorak).getByDisplayValue('Uz hleb')).toBeInTheDocument();
  });

  test('prvi dan nema dugme za kopiranje', async () => {
    const { container } = render(<Menu />);
    await waitFor(() => expect(kartice(container)).toHaveLength(7));

    expect(
      within(kartice(container)[0]).queryByRole('button', { name: 'Kopiraj prethodni dan' })
    ).toBeNull();
  });
});
