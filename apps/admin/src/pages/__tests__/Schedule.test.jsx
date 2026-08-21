import { describe, test, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Schedule from '../Schedule';
import { get, post, patch, del } from '../../lib/api';

vi.mock('../../lib/api', () => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), del: vi.fn() }));
vi.mock('../../components/Layout', () => ({
  PageHeader: ({ title, children }) => (<div><h1>{title}</h1>{children}</div>),
}));

const nedeljna = {
  id: 'a1',
  title: 'Radionica crtanja',
  description: 'Za najmladje',
  dayOfWeek: 0,
  startTime: '10:00',
  endTime: '11:00',
  isRecurring: true,
  isActive: true,
  ageGroup: '3-6 godina',
  color: '#7c9fc9',
};

const dogadjaj = {
  ...nedeljna,
  id: 'a2',
  title: 'Novogodisnja zurka',
  dayOfWeek: null,
  isRecurring: false,
  specificDate: '2026-12-31',
};

beforeEach(() => {
  get.mockReset().mockResolvedValue({ activities: [nedeljna, dogadjaj] });
  post.mockReset().mockResolvedValue({});
  patch.mockReset().mockResolvedValue({});
  del.mockReset().mockResolvedValue({});
});

describe('Schedule - prikaz', () => {
  test('nedeljna aktivnost stoji pod svojim danom', async () => {
    const { container } = render(<Schedule />);
    await screen.findByText('Radionica crtanja');

    const kartice = [...container.querySelectorAll('.card')];
    const ponedeljak = kartice.find((k) => within(k).queryByRole('heading', { name: 'Ponedeljak' }));
    expect(within(ponedeljak).getByText('Radionica crtanja')).toBeInTheDocument();
  });

  test('jednokratni dogadjaj ide u svoju sekciju sa datumom', async () => {
    render(<Schedule />);

    expect(await screen.findByText('Novogodisnja zurka')).toBeInTheDocument();
    expect(screen.getByText(/31\.12\.2026/)).toBeInTheDocument();
  });

  test('dan bez aktivnosti to i kaze', async () => {
    render(<Schedule />);
    await screen.findByText('Radionica crtanja');

    expect(screen.getAllByText('Nema aktivnosti.').length).toBeGreaterThan(0);
  });

  test('bez jednokratnih dogadjaja stoji objasnjenje', async () => {
    get.mockResolvedValue({ activities: [nedeljna] });
    render(<Schedule />);

    expect(await screen.findByText('Nema jednokratnih dogadjaja')).toBeInTheDocument();
  });

  test('sakrivena aktivnost je oznacena', async () => {
    get.mockResolvedValue({ activities: [{ ...nedeljna, isActive: false }] });
    render(<Schedule />);

    expect(await screen.findByText('Sakriveno')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Prikazi' })).toBeInTheDocument();
  });
});

describe('Schedule - prozor za aktivnost', () => {
  test('dugme "Sacuvaj" pripada formi', async () => {
    const user = userEvent.setup();
    render(<Schedule />);
    await screen.findByText('Radionica crtanja');

    await user.click(screen.getByRole('button', { name: 'Nova aktivnost' }));

    expect(screen.getByRole('button', { name: 'Sacuvaj' }).form?.id).toBe('aktivnost-forma');
  });

  test('prazna forma se ne salje', async () => {
    const user = userEvent.setup();
    render(<Schedule />);
    await screen.findByText('Radionica crtanja');
    await user.click(screen.getByRole('button', { name: 'Nova aktivnost' }));

    await user.click(screen.getByRole('button', { name: 'Sacuvaj' }));

    expect(post).not.toHaveBeenCalled();
  });

  test('nova aktivnost se salje sa danom i vremenom', async () => {
    const user = userEvent.setup();
    render(<Schedule />);
    await screen.findByText('Radionica crtanja');
    await user.click(screen.getByRole('button', { name: 'Nova aktivnost' }));

    const dijalog = screen.getByRole('dialog');
    await user.type(within(dijalog).getByLabelText('Naziv'), 'Joga za decu');
    await user.selectOptions(within(dijalog).getByLabelText('Dan u nedelji'), '2');
    await user.click(screen.getByRole('button', { name: 'Sacuvaj' }));

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/schedule', expect.objectContaining({
        title: 'Joga za decu',
        dayOfWeek: 2,
      }))
    );
  });

  test('izmena ide na patch sa istim id-em', async () => {
    const user = userEvent.setup();
    render(<Schedule />);
    await screen.findByText('Radionica crtanja');

    await user.click(screen.getAllByRole('button', { name: 'Izmeni' })[0]);
    const dijalog = screen.getByRole('dialog');
    await user.clear(within(dijalog).getByLabelText('Naziv'));
    await user.type(within(dijalog).getByLabelText('Naziv'), 'Crtanje i slikanje');
    await user.click(screen.getByRole('button', { name: 'Sacuvaj' }));

    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith('/schedule/a1', expect.objectContaining({
        title: 'Crtanje i slikanje',
      }))
    );
  });
});

describe('Schedule - sakrivanje i brisanje', () => {
  test('sakrivanje menja samo vidljivost', async () => {
    const user = userEvent.setup();
    render(<Schedule />);
    await screen.findByText('Radionica crtanja');

    await user.click(screen.getAllByRole('button', { name: 'Sakrij' })[0]);

    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith('/schedule/a1', { isActive: false })
    );
  });

  test('potvrda brise aktivnost', async () => {
    const user = userEvent.setup();
    render(<Schedule />);
    await screen.findByText('Radionica crtanja');

    await user.click(screen.getAllByRole('button', { name: 'Obrisi' })[0]);
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Obrisi' }));

    await waitFor(() => expect(del).toHaveBeenCalledWith('/schedule/a1'));
  });

  test('greska pri brisanju se vidi u dijalogu', async () => {
    del.mockRejectedValue(new Error('Aktivnost je vec obrisana.'));
    const user = userEvent.setup();
    render(<Schedule />);
    await screen.findByText('Radionica crtanja');

    await user.click(screen.getAllByRole('button', { name: 'Obrisi' })[0]);
    const dijalog = screen.getByRole('dialog');
    await user.click(within(dijalog).getByRole('button', { name: 'Obrisi' }));

    expect(await within(dijalog).findByText('Aktivnost je vec obrisana.')).toBeInTheDocument();
  });
});
