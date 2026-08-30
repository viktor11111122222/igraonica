import { describe, test, expect, beforeEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Dashboard from '../Dashboard';
import { get } from '../../lib/api';

vi.mock('../../lib/api', () => ({ get: vi.fn() }));
vi.mock('../../components/Layout', () => ({ PageHeader: ({ title }) => <h1>{title}</h1> }));

const statistika = {
  activeKids: 4,
  todayVisits: 11,
  hoursUsedToday: 8.5,
  totalUsers: 23,
  totalChildren: 31,
};

const poseta = {
  id: 'v1',
  status: 'CHECKED_OUT',
  checkedInAt: '2026-08-21T09:00:00.000Z',
  checkedOutAt: '2026-08-21T11:00:00.000Z',
  hoursCharged: 2,
  child: { firstName: 'Ana', lastName: 'Petrovic' },
};

function odgovori({ stats = statistika, visits = [poseta] } = {}) {
  get.mockImplementation((path) => {
    if (path === '/dashboard/stats') return Promise.resolve(stats);
    if (path.startsWith('/dashboard/chart/visits')) {
      return Promise.resolve({ data: [{ date: '2026-08-20', count: 5 }] });
    }
    if (path.startsWith('/dashboard/chart/hours')) {
      return Promise.resolve({ data: [{ date: '2026-08-20', hours: 3.5 }] });
    }
    if (path.startsWith('/dashboard/recent-activity')) return Promise.resolve({ visits });
    return Promise.resolve({});
  });
}

const prikazi = () => render(<MemoryRouter><Dashboard /></MemoryRouter>);

beforeEach(() => {
  get.mockReset();
  odgovori();
});

describe('Dashboard', () => {
  test('prikazuje glavne brojke dana', async () => {
    prikazi();

    expect(await screen.findByText('4')).toBeInTheDocument();
    expect(screen.getByText('11')).toBeInTheDocument();
    expect(screen.getByText('8,5 h')).toBeInTheDocument();
    expect(screen.getByText('23')).toBeInTheDocument();
    expect(screen.getByText('31')).toBeInTheDocument();
  });

  test('bez podataka pokazuje nule umesto praznine', async () => {
    odgovori({ stats: {} });
    prikazi();

    expect(await screen.findAllByText('0')).not.toHaveLength(0);
    expect(screen.getByText('0,0 h')).toBeInTheDocument();
  });

  test('prikazuje poslednje aktivnosti', async () => {
    prikazi();

    expect(await screen.findByText('Ana Petrovic')).toBeInTheDocument();
    expect(screen.getByText('2,0 h')).toBeInTheDocument();
  });

  test('bez poseta poziva da se prijavi prvo dete', async () => {
    odgovori({ visits: [] });
    prikazi();

    expect(await screen.findByText('Jos nema poseta')).toBeInTheDocument();
  });

  test('greska pri ucitavanju statistike se prikazuje', async () => {
    get.mockImplementation((path) =>
      path === '/dashboard/stats'
        ? Promise.reject(new Error('Nema veze sa serverom.'))
        : Promise.resolve({ data: [], visits: [] })
    );
    prikazi();

    expect(await screen.findByText('Nema veze sa serverom.')).toBeInTheDocument();
  });

  test('promena perioda dovlaci nove grafikone', async () => {
    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();
    prikazi();
    await screen.findByText('4');

    await user.selectOptions(screen.getByRole('combobox'), 'month');

    expect(get).toHaveBeenCalledWith('/dashboard/chart/visits?period=month');
    expect(get).toHaveBeenCalledWith('/dashboard/chart/hours?period=month');
  });

  test('grafikon se moze procitati i kao tabela', async () => {
    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();
    prikazi();
    await screen.findByText('4');

    const dugmad = await screen.findAllByRole('button', { name: 'Prikazi kao tabelu' });
    await user.click(dugmad[0]);

    const tabele = screen.getAllByRole('table');
    expect(within(tabele[0]).getByText('20.08.2026.')).toBeInTheDocument();
  });
});
