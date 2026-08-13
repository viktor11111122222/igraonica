import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ClosedDays from '../ClosedDays';
import { get, post, del } from '../../lib/api';

vi.mock('../../lib/api', () => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  del: vi.fn(),
}));

const DANAS = '2026-08-13';
const SUTRA = '2026-08-14';

const dan = (over = {}) => ({
  id: 'c1',
  date: SUTRA,
  reason: 'Rodjendan',
  note: null,
  ...over,
});

const poljeDatuma = (container) => container.querySelector('input[type="date"]');

beforeEach(() => {
  // Samo Date, ne i tajmeri - userEvent iznutra koristi setTimeout.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 7, 13, 12, 0, 0));
  get.mockResolvedValue({ closedDays: [] });
  post.mockResolvedValue({ closedDay: dan() });
  del.mockResolvedValue({ message: 'ok' });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('ClosedDays - prikaz', () => {
  test('trazi ceo spisak sa servera', async () => {
    render(<ClosedDays />);
    await waitFor(() => expect(get).toHaveBeenCalledWith('/closed-days/all'));
  });

  test('prazno stanje kada nema neradnih dana', async () => {
    render(<ClosedDays />);
    expect(await screen.findByText('Nema neradnih dana')).toBeInTheDocument();
  });

  test('prikazuje dan sa razlogom i danom u nedelji', async () => {
    get.mockResolvedValue({ closedDays: [dan({ date: SUTRA, reason: 'Rodjendan' })] });
    render(<ClosedDays />);

    // 14.08.2026. je petak.
    expect(await screen.findByText(/Petak/)).toBeInTheDocument();
    // Ograniceno na red u spisku - "Rodjendan" postoji i kao dugme-predlog.
    expect(screen.getByText('Rodjendan', { selector: '.row-sub' })).toBeInTheDocument();
  });

  test('napomena se prikazuje uz razlog', async () => {
    get.mockResolvedValue({
      closedDays: [dan({ reason: 'Rodjendan', note: 'Radimo od 18h' })],
    });
    render(<ClosedDays />);

    expect(await screen.findByText('Rodjendan · Radimo od 18h')).toBeInTheDocument();
  });

  test('danasnji neradni dan je posebno oznacen', async () => {
    get.mockResolvedValue({ closedDays: [dan({ date: DANAS })] });
    render(<ClosedDays />);

    expect(await screen.findByText('danas')).toBeInTheDocument();
  });

  test('prosli dan je oznacen kao proslo', async () => {
    get.mockResolvedValue({ closedDays: [dan({ date: '2026-08-01' })] });
    render(<ClosedDays />);

    expect(await screen.findByText('proslo')).toBeInTheDocument();
  });
});

describe('ClosedDays - dodavanje', () => {
  test('dugme je neaktivno dok datum i razlog nisu uneti', async () => {
    const user = userEvent.setup();
    const { container } = render(<ClosedDays />);
    await screen.findByText('Nema neradnih dana');

    const dugme = screen.getByRole('button', { name: 'Oznaci kao neradni' });
    expect(dugme).toBeDisabled();

    await user.type(poljeDatuma(container), SUTRA);
    expect(dugme).toBeDisabled();

    await user.type(screen.getByPlaceholderText('npr. Rodjendan'), 'Rodjendan');
    expect(dugme).toBeEnabled();
  });

  test('predlog popunjava razlog jednim klikom', async () => {
    const user = userEvent.setup();
    render(<ClosedDays />);
    await screen.findByText('Nema neradnih dana');

    await user.click(screen.getByRole('button', { name: 'Praznik' }));
    expect(screen.getByPlaceholderText('npr. Rodjendan')).toHaveValue('Praznik');
  });

  test('salje datum, razlog i napomenu', async () => {
    const user = userEvent.setup();
    const { container } = render(<ClosedDays />);
    await screen.findByText('Nema neradnih dana');

    await user.type(poljeDatuma(container), SUTRA);
    await user.type(screen.getByPlaceholderText('npr. Rodjendan'), 'Rodjendan');
    await user.type(screen.getByPlaceholderText('npr. Radimo od 18h'), 'Zatvoreno ceo dan');
    await user.click(screen.getByRole('button', { name: 'Oznaci kao neradni' }));

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/closed-days', {
        date: SUTRA,
        reason: 'Rodjendan',
        note: 'Zatvoreno ceo dan',
      })
    );
  });

  // Napomena nije obavezna - prazna se ne salje uopste.
  test('prazna napomena se ne salje', async () => {
    const user = userEvent.setup();
    const { container } = render(<ClosedDays />);
    await screen.findByText('Nema neradnih dana');

    await user.type(poljeDatuma(container), SUTRA);
    await user.type(screen.getByPlaceholderText('npr. Rodjendan'), 'Praznik');
    await user.click(screen.getByRole('button', { name: 'Oznaci kao neradni' }));

    await waitFor(() => expect(post).toHaveBeenCalled());
    expect(post.mock.calls[0][1].note).toBeUndefined();
  });

  test('posle uspesnog dodavanja polja se prazne i spisak se osvezava', async () => {
    const user = userEvent.setup();
    const { container } = render(<ClosedDays />);
    await screen.findByText('Nema neradnih dana');

    await user.type(poljeDatuma(container), SUTRA);
    await user.type(screen.getByPlaceholderText('npr. Rodjendan'), 'Rodjendan');
    await user.click(screen.getByRole('button', { name: 'Oznaci kao neradni' }));

    await waitFor(() => expect(screen.getByPlaceholderText('npr. Rodjendan')).toHaveValue(''));
    expect(get).toHaveBeenCalledTimes(2);
  });

  test('greska sa servera se prikazuje', async () => {
    const user = userEvent.setup();
    post.mockRejectedValue(new Error('Taj dan je vec oznacen kao neradni.'));

    const { container } = render(<ClosedDays />);
    await screen.findByText('Nema neradnih dana');

    await user.type(poljeDatuma(container), SUTRA);
    await user.type(screen.getByPlaceholderText('npr. Rodjendan'), 'Rodjendan');
    await user.click(screen.getByRole('button', { name: 'Oznaci kao neradni' }));

    expect(
      await screen.findByText('Taj dan je vec oznacen kao neradni.')
    ).toBeInTheDocument();
  });
});

describe('ClosedDays - vracanje u radne', () => {
  test('trazi potvrdu pre brisanja', async () => {
    const user = userEvent.setup();
    get.mockResolvedValue({ closedDays: [dan()] });
    render(<ClosedDays />);

    await user.click(await screen.findByRole('button', { name: 'Vrati u radne' }));

    expect(screen.getByText('Vratiti dan u radne?')).toBeInTheDocument();
    expect(del).not.toHaveBeenCalled();
  });

  test('potvrda brise dan', async () => {
    const user = userEvent.setup();
    get.mockResolvedValue({ closedDays: [dan()] });
    render(<ClosedDays />);

    await user.click(await screen.findByRole('button', { name: 'Vrati u radne' }));
    // Drugo dugme sa istim tekstom je u dijalogu za potvrdu.
    const potvrde = screen.getAllByRole('button', { name: 'Vrati u radne' });
    await user.click(potvrde[potvrde.length - 1]);

    await waitFor(() => expect(del).toHaveBeenCalledWith('/closed-days/c1'));
  });

  test('odustajanje ne brise nista', async () => {
    const user = userEvent.setup();
    get.mockResolvedValue({ closedDays: [dan()] });
    render(<ClosedDays />);

    await user.click(await screen.findByRole('button', { name: 'Vrati u radne' }));
    await user.click(screen.getByRole('button', { name: 'Odustani' }));

    expect(screen.queryByText('Vratiti dan u radne?')).toBeNull();
    expect(del).not.toHaveBeenCalled();
  });
});
