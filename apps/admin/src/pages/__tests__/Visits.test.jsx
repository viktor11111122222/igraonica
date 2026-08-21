import { describe, test, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Visits from '../Visits';
import { get } from '../../lib/api';

vi.mock('../../lib/api', () => ({ get: vi.fn() }));
vi.mock('../../components/Layout', () => ({ PageHeader: ({ title }) => <h1>{title}</h1> }));

const poseta = {
  id: 'v1',
  status: 'CHECKED_OUT',
  checkedInAt: '2026-08-20T09:00:00.000Z',
  checkedOutAt: '2026-08-20T11:30:00.000Z',
  durationMinutes: 150,
  hoursDeducted: 2.5,
  child: { firstName: 'Ana', lastName: 'Petrovic' },
  userPackage: { package: { name: 'Paket 10h' } },
};

beforeEach(() => {
  get.mockReset().mockResolvedValue({
    visits: [poseta],
    pagination: { page: 1, pages: 1, total: 1 },
  });
});

describe('Visits', () => {
  test('prikazuje posetu sa trajanjem i naplatom', async () => {
    render(<Visits />);

    expect(await screen.findByText('Ana Petrovic')).toBeInTheDocument();
    expect(screen.getByText('2 h 30 min')).toBeInTheDocument();
    expect(screen.getByText('2,5 h')).toBeInTheDocument();
    expect(screen.getByText('Paket 10h')).toBeInTheDocument();
    expect(screen.getByText('Odjavljen')).toBeInTheDocument();
  });

  test('poseta koja jos traje nema odjavu ni naplatu', async () => {
    get.mockResolvedValue({
      visits: [{ ...poseta, status: 'CHECKED_IN', checkedOutAt: null, durationMinutes: null, hoursDeducted: null }],
      pagination: { page: 1, pages: 1, total: 1 },
    });
    render(<Visits />);

    await screen.findByText('Ana Petrovic');
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2);
    // "U igraonici" stoji i medju opcijama filtera, pa se gleda samo tabela.
    expect(within(screen.getByRole('table')).getByText('U igraonici')).toBeInTheDocument();
  });

  test('prazan rezultat javlja da nista ne odgovara filterima', async () => {
    get.mockResolvedValue({ visits: [], pagination: { page: 1, pages: 0, total: 0 } });
    render(<Visits />);

    expect(await screen.findByText('Nema poseta')).toBeInTheDocument();
  });

  test('filter po statusu ide u zahtev i vraca na prvu stranu', async () => {
    const user = userEvent.setup();
    render(<Visits />);
    await screen.findByText('Ana Petrovic');

    await user.selectOptions(screen.getByRole('combobox'), 'AUTO_CLOSED');

    await waitFor(() =>
      expect(get).toHaveBeenCalledWith(expect.stringContaining('status=AUTO_CLOSED'))
    );
    expect(get).toHaveBeenCalledWith(expect.stringContaining('page=1'));
  });

  test('opseg datuma ide u zahtev', async () => {
    const user = userEvent.setup();
    const { container } = render(<Visits />);
    await screen.findByText('Ana Petrovic');

    const [od, do_] = container.querySelectorAll('input[type=date]');
    await user.type(od, '2026-08-01');
    await user.type(do_, '2026-08-31');

    await waitFor(() =>
      expect(get).toHaveBeenCalledWith(expect.stringContaining('dateFrom=2026-08-01'))
    );
    await waitFor(() =>
      expect(get).toHaveBeenCalledWith(expect.stringContaining('dateTo=2026-08-31'))
    );
  });

  test('ponistavanje vraca sve filtere', async () => {
    const user = userEvent.setup();
    render(<Visits />);
    await screen.findByText('Ana Petrovic');
    await user.selectOptions(screen.getByRole('combobox'), 'CHECKED_IN');

    await user.click(await screen.findByRole('button', { name: 'Ponisti filtere' }));

    expect(screen.getByRole('combobox')).toHaveValue('');
    expect(screen.queryByRole('button', { name: 'Ponisti filtere' })).toBeNull();
  });
});
