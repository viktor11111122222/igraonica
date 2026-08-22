import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Notifications from '../Notifications';

const oznaciProcitano = vi.fn();
const oznaciSve = vi.fn();
let stanje;

vi.mock('../../hooks/useNotifications', () => ({
  useNotifications: () => ({ ...stanje, oznaciProcitano, oznaciSve }),
}));

const sada = new Date('2026-08-22T16:00:00.000Z');

const obavestenje = (over = {}) => ({
  id: 'n1',
  type: 'CHILD_CHECKED_IN',
  title: 'Prijava',
  body: 'Lena Petrovic je prijavljena u 15:22.',
  readAt: null,
  createdAt: '2026-08-22T15:50:00.000Z',
  ...over,
});

beforeEach(() => {
  // Vreme je zamrznuto zbog "pre 10 min" - inace bi test zavisio od trenutka
  // pokretanja. `shouldAdvanceTime` je tu da userEvent ne stane na laznom satu.
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(sada);
  oznaciProcitano.mockReset();
  oznaciSve.mockReset();
  stanje = { notifications: [obavestenje()], unreadCount: 1, loading: false, error: '' };
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Zvono', () => {
  test('broj neprocitanih stoji na zvonu', () => {
    render(<Notifications />);
    expect(screen.getByRole('button', { name: /1 neprocitano/ })).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  test('bez neprocitanih nema znacke', () => {
    stanje = { ...stanje, unreadCount: 0 };
    render(<Notifications />);

    expect(screen.getByRole('button', { name: 'Obavestenja' })).toBeInTheDocument();
    expect(screen.queryByText('0')).toBeNull();
  });

  // Preko 99 broj bi razvukao znacku preko celog dugmeta.
  test('veliki broj se skracuje', () => {
    stanje = { ...stanje, unreadCount: 250 };
    render(<Notifications />);
    expect(screen.getByText('99+')).toBeInTheDocument();
  });

  test('panel je zatvoren dok se ne klikne', () => {
    render(<Notifications />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('Panel', () => {
  async function otvori() {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Notifications />);
    await user.click(screen.getByRole('button', { name: /Obavestenja/ }));
    return user;
  }

  test('prikazuje naslov i tekst obavestenja', async () => {
    await otvori();

    const panel = screen.getByRole('dialog', { name: 'Obavestenja' });
    expect(within(panel).getByText('Prijava')).toBeInTheDocument();
    expect(within(panel).getByText('Lena Petrovic je prijavljena u 15:22.')).toBeInTheDocument();
  });

  test('pokazuje koliko je proslo', async () => {
    await otvori();
    expect(screen.getByText('pre 10 min')).toBeInTheDocument();
  });

  test('sasvim sveze pise "upravo sada"', async () => {
    stanje = { ...stanje, notifications: [obavestenje({ createdAt: sada.toISOString() })] };
    await otvori();
    expect(screen.getByText('upravo sada')).toBeInTheDocument();
  });

  test('juceresnje pise "juce"', async () => {
    stanje = { ...stanje, notifications: [obavestenje({ createdAt: '2026-08-21T16:00:00.000Z' })] };
    await otvori();
    expect(screen.getByText('juce')).toBeInTheDocument();
  });

  // Boja sama ne bi bila dovoljna, pa neprocitano nosi i tackicu.
  test('neprocitano je oznaceno i mimo boje', async () => {
    await otvori();
    expect(screen.getByLabelText('neprocitano')).toBeInTheDocument();
  });

  test('procitano nema tackicu', async () => {
    stanje = { notifications: [obavestenje({ readAt: sada.toISOString() })], unreadCount: 0, loading: false, error: '' };
    await otvori();
    expect(screen.queryByLabelText('neprocitano')).toBeNull();
  });

  test('klik na red ga oznacava kao procitan', async () => {
    const user = await otvori();

    await user.click(screen.getByText('Lena Petrovic je prijavljena u 15:22.'));

    expect(oznaciProcitano).toHaveBeenCalledWith('n1');
  });

  test('"Oznaci sve" se nudi samo kada ima neprocitanih', async () => {
    const user = await otvori();
    await user.click(screen.getByRole('button', { name: 'Oznaci sve' }));
    expect(oznaciSve).toHaveBeenCalled();
  });

  test('bez neprocitanih nema dugmeta "Oznaci sve"', async () => {
    stanje = { ...stanje, unreadCount: 0 };
    await otvori();
    expect(screen.queryByRole('button', { name: 'Oznaci sve' })).toBeNull();
  });

  test('prazan spisak to i kaze', async () => {
    stanje = { notifications: [], unreadCount: 0, loading: false, error: '' };
    await otvori();
    expect(screen.getByText('Nema obavestenja.')).toBeInTheDocument();
  });

  test('greska se prikazuje u panelu', async () => {
    stanje = { ...stanje, error: 'Nema veze sa serverom.' };
    await otvori();
    expect(screen.getByText('Nema veze sa serverom.')).toBeInTheDocument();
  });

  test('Escape zatvara panel', async () => {
    const user = await otvori();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  test('klik van panela ga zatvara', async () => {
    const user = await otvori();
    await user.click(document.body);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
