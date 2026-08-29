import { describe, test, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PromoBanners from '../PromoBanners';
import { get, post, patch, del, uploadImage } from '../../lib/api';

vi.mock('../../lib/api', () => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  del: vi.fn(),
  uploadImage: vi.fn(),
}));
vi.mock('../../components/Layout', () => ({
  PageHeader: ({ title, children }) => (<div><h1>{title}</h1>{children}</div>),
}));

const promocija = {
  id: 'pb1',
  title: 'Letnji popust',
  description: 'Svaki drugi dolazak gratis.',
  imageUrl: '/uploads/leto.jpg',
  showPopup: true,
  isActive: true,
};

const odgovor = (promoBanners = [promocija]) => ({ promoBanners });

beforeEach(() => {
  get.mockReset().mockResolvedValue(odgovor());
  post.mockReset().mockResolvedValue({});
  patch.mockReset().mockResolvedValue({});
  del.mockReset().mockResolvedValue({});
  uploadImage.mockReset().mockResolvedValue({ url: '/uploads/nova.jpg' });
});

describe('Promocije - lista', () => {
  test('prikazuje naslov, opis i sliku', async () => {
    render(<PromoBanners />);

    expect(await screen.findByText('Letnji popust')).toBeInTheDocument();
    expect(screen.getByText('Svaki drugi dolazak gratis.')).toBeInTheDocument();
    expect(document.querySelector('img[src="/uploads/leto.jpg"]')).not.toBeNull();
  });

  test('prazna lista objasnjava cemu promocija sluzi', async () => {
    get.mockResolvedValue(odgovor([]));
    render(<PromoBanners />);

    expect(await screen.findByText('Nema promocija')).toBeInTheDocument();
  });

  test('status prati prekidac, bez rokova', async () => {
    get.mockResolvedValue(odgovor([promocija, { ...promocija, id: 'pb2', isActive: false }]));
    render(<PromoBanners />);

    expect(await screen.findByText('U aplikaciji')).toBeInTheDocument();
    expect(screen.getByText('Iskljucena')).toBeInTheDocument();
  });

  test('vidi se da li promocija iskace pri prvom ulasku', async () => {
    get.mockResolvedValue(odgovor([promocija, { ...promocija, id: 'pb2', showPopup: false }]));
    render(<PromoBanners />);

    expect(await screen.findByText('Iskace')).toBeInTheDocument();
    expect(screen.getByText('Ne iskace')).toBeInTheDocument();
  });
});

// Promocija se ne mora brisati: iskljuci se pa vrati kad zatreba.
describe('Promocije - ukljucivanje i iskljucivanje', () => {
  test('aktivna se iskljucuje jednim dugmetom', async () => {
    const user = userEvent.setup();
    render(<PromoBanners />);
    await screen.findByText('Letnji popust');

    await user.click(screen.getByRole('button', { name: 'Iskljuci' }));

    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith('/promo-banners/pb1', { isActive: false })
    );
  });

  test('iskljucena se vraca istim dugmetom', async () => {
    get.mockResolvedValue(odgovor([{ ...promocija, isActive: false }]));
    const user = userEvent.setup();
    render(<PromoBanners />);
    await screen.findByText('Letnji popust');

    await user.click(screen.getByRole('button', { name: 'Ukljuci' }));

    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith('/promo-banners/pb1', { isActive: true })
    );
  });
});

describe('Promocije - prozor', () => {
  test('nova promocija salje naslov, opis i sliku', async () => {
    const user = userEvent.setup();
    render(<PromoBanners />);
    await screen.findByText('Letnji popust');
    await user.click(screen.getByRole('button', { name: 'Nova promocija' }));

    const dijalog = screen.getByRole('dialog');
    await user.type(within(dijalog).getByLabelText('Naslov'), 'Jesenja akcija');
    await user.type(within(dijalog).getByLabelText('Sta je promocija'), 'Radionice po pola cene.');
    await user.click(screen.getByRole('button', { name: 'Sacuvaj' }));

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/promo-banners', expect.objectContaining({
        title: 'Jesenja akcija',
        description: 'Radionice po pola cene.',
        showPopup: true,
        isActive: true,
      }))
    );
  });

  test('izabrana slika se salje na server i pamti u formi', async () => {
    const user = userEvent.setup();
    render(<PromoBanners />);
    await screen.findByText('Letnji popust');
    await user.click(screen.getByRole('button', { name: 'Nova promocija' }));

    const dijalog = screen.getByRole('dialog');
    const fajl = new File(['slika'], 'baner.png', { type: 'image/png' });
    await user.upload(within(dijalog).getByLabelText('Slika banera'), fajl);

    await waitFor(() => expect(uploadImage).toHaveBeenCalledWith(fajl));
    // Pregled slike je ukras (prazan `alt`), pa se trazi po izvoru a ne po ulozi.
    await waitFor(() =>
      expect(dijalog.querySelector('img[src="/uploads/nova.jpg"]')).not.toBeNull()
    );
  });

  test('promocija moze i bez iskacuceg prozora', async () => {
    const user = userEvent.setup();
    render(<PromoBanners />);
    await screen.findByText('Letnji popust');
    await user.click(screen.getByRole('button', { name: 'Nova promocija' }));

    const dijalog = screen.getByRole('dialog');
    await user.type(within(dijalog).getByLabelText('Naslov'), 'Samo na pocetnoj');
    await user.click(
      within(dijalog).getByLabelText(/Pokazi preko celog ekrana/)
    );
    await user.click(screen.getByRole('button', { name: 'Sacuvaj' }));

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/promo-banners', expect.objectContaining({ showPopup: false }))
    );
  });

  test('prazna forma se ne salje', async () => {
    const user = userEvent.setup();
    render(<PromoBanners />);
    await screen.findByText('Letnji popust');
    await user.click(screen.getByRole('button', { name: 'Nova promocija' }));

    await user.click(screen.getByRole('button', { name: 'Sacuvaj' }));

    expect(post).not.toHaveBeenCalled();
  });

  test('izmena ucitava postojece vrednosti', async () => {
    const user = userEvent.setup();
    render(<PromoBanners />);
    await screen.findByText('Letnji popust');

    await user.click(screen.getByRole('button', { name: 'Izmeni' }));

    const dijalog = screen.getByRole('dialog');
    expect(within(dijalog).getByLabelText('Naslov')).toHaveValue('Letnji popust');
    expect(within(dijalog).getByLabelText('Sta je promocija')).toHaveValue(
      'Svaki drugi dolazak gratis.'
    );
  });
});

describe('Promocije - brisanje', () => {
  test('potvrda brise promociju', async () => {
    const user = userEvent.setup();
    render(<PromoBanners />);
    await screen.findByText('Letnji popust');

    await user.click(screen.getByRole('button', { name: 'Obrisi' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Obrisi' }));

    await waitFor(() => expect(del).toHaveBeenCalledWith('/promo-banners/pb1'));
  });

  test('dijalog nudi iskljucivanje kao blazu opciju', async () => {
    const user = userEvent.setup();
    render(<PromoBanners />);
    await screen.findByText('Letnji popust');

    await user.click(screen.getByRole('button', { name: 'Obrisi' }));

    expect(within(screen.getByRole('dialog')).getByText(/iskljucite je/)).toBeInTheDocument();
  });
});
