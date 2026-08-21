import { describe, test, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Blog from '../Blog';
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

const objava = {
  id: 'b1',
  title: 'Letnji raspust',
  slug: 'letnji-raspust',
  excerpt: 'Sta radimo u julu',
  content: 'Ceo tekst objave.',
  coverImageUrl: null,
  isPublished: true,
  isFeatured: false,
  publishedAt: '2026-07-01T08:00:00.000Z',
  author: { firstName: 'Vicko', lastName: 'Vicko' },
};

const odgovor = (posts = [objava]) => ({
  posts,
  pagination: { page: 1, pages: 1, total: posts.length },
});

beforeEach(() => {
  get.mockReset().mockResolvedValue(odgovor());
  post.mockReset().mockResolvedValue({});
  patch.mockReset().mockResolvedValue({});
  del.mockReset().mockResolvedValue({});
  uploadImage.mockReset().mockResolvedValue({ url: '/uploads/slika.jpg' });
});

describe('Blog - lista', () => {
  test('prikazuje objavu sa adresom i autorom', async () => {
    render(<Blog />);

    expect(await screen.findByText('Letnji raspust')).toBeInTheDocument();
    expect(screen.getByText('/letnji-raspust')).toBeInTheDocument();
    expect(screen.getByText('Vicko Vicko')).toBeInTheDocument();
  });

  test('objavljen i nacrt se razlikuju', async () => {
    get.mockResolvedValue(
      odgovor([objava, { ...objava, id: 'b2', title: 'Zimski program', isPublished: false }])
    );
    render(<Blog />);

    await screen.findByText('Letnji raspust');
    // "Objavljen" je i zaglavlje kolone sa datumom, pa se gleda samo znacka.
    const tabela = screen.getByRole('table');
    expect(within(tabela).getByText('Nacrt')).toHaveClass('badge');
    expect(within(tabela).getAllByText('Objavljen').some((e) => e.classList.contains('badge'))).toBe(true);
  });

  test('istaknuta objava je oznacena', async () => {
    get.mockResolvedValue(odgovor([{ ...objava, isFeatured: true }]));
    render(<Blog />);

    expect(await screen.findByText('Istaknut')).toBeInTheDocument();
  });

  test('bez objava poziva da se napise prva', async () => {
    get.mockResolvedValue(odgovor([]));
    render(<Blog />);

    expect(await screen.findByText('Nema objava')).toBeInTheDocument();
  });

  test('sklanjanje sa sajta menja samo status', async () => {
    const user = userEvent.setup();
    render(<Blog />);
    await screen.findByText('Letnji raspust');

    await user.click(screen.getByRole('button', { name: 'Skloni' }));

    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith('/blog/b1', { isPublished: false })
    );
  });
});

describe('Blog - prozor za objavu', () => {
  test('dugme "Sacuvaj" pripada formi', async () => {
    const user = userEvent.setup();
    render(<Blog />);
    await screen.findByText('Letnji raspust');

    await user.click(screen.getByRole('button', { name: 'Nova objava' }));

    expect(screen.getByRole('button', { name: 'Sacuvaj' }).form?.id).toBe('objava-forma');
  });

  test('prazna forma se ne salje', async () => {
    const user = userEvent.setup();
    render(<Blog />);
    await screen.findByText('Letnji raspust');
    await user.click(screen.getByRole('button', { name: 'Nova objava' }));

    await user.click(screen.getByRole('button', { name: 'Sacuvaj' }));

    expect(post).not.toHaveBeenCalled();
  });

  test('nova objava se salje sa naslovom i sadrzajem', async () => {
    const user = userEvent.setup();
    render(<Blog />);
    await screen.findByText('Letnji raspust');
    await user.click(screen.getByRole('button', { name: 'Nova objava' }));

    const dijalog = screen.getByRole('dialog');
    await user.type(within(dijalog).getByLabelText('Naslov'), 'Nova godina');
    await user.type(within(dijalog).getByLabelText('Kratak opis'), 'Zatvoreni smo');
    await user.type(within(dijalog).getByLabelText('Sadrzaj'), 'Detalji.');
    await user.click(screen.getByRole('button', { name: 'Sacuvaj' }));

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/blog', expect.objectContaining({
        title: 'Nova godina',
        excerpt: 'Zatvoreni smo',
        content: 'Detalji.',
      }))
    );
  });

  test('izmena upozorava da se menja i adresa objave', async () => {
    const user = userEvent.setup();
    render(<Blog />);
    await screen.findByText('Letnji raspust');

    await user.click(screen.getByRole('button', { name: 'Izmeni' }));

    expect(screen.getByText('Promena naslova menja i adresu objave.')).toBeInTheDocument();
  });

  test('naslovna slika se salje i pamti', async () => {
    const user = userEvent.setup();
    const { container } = render(<Blog />);
    await screen.findByText('Letnji raspust');
    await user.click(screen.getByRole('button', { name: 'Nova objava' }));

    const polje = container.querySelector('input[type=file]');
    await user.upload(polje, new File(['x'], 'slika.jpg', { type: 'image/jpeg' }));

    await waitFor(() => expect(uploadImage).toHaveBeenCalled());
    // Slika je ukras uz polje, pa nema alt tekst - gleda se sam izvor.
    await waitFor(() =>
      expect(container.querySelector('.modal img')).toHaveAttribute('src', '/uploads/slika.jpg')
    );
    expect(screen.getByRole('button', { name: 'Ukloni' })).toBeInTheDocument();
  });

  test('neuspeo upload javlja gresku', async () => {
    uploadImage.mockRejectedValue(new Error('Slika je prevelika.'));
    const user = userEvent.setup();
    const { container } = render(<Blog />);
    await screen.findByText('Letnji raspust');
    await user.click(screen.getByRole('button', { name: 'Nova objava' }));

    await user.upload(
      container.querySelector('input[type=file]'),
      new File(['x'], 'velika.jpg', { type: 'image/jpeg' })
    );

    // Poruka stoji i u prozoru i u traci na stranici iza njega.
    expect(await screen.findAllByText('Slika je prevelika.')).not.toHaveLength(0);
  });
});

describe('Blog - brisanje', () => {
  test('potvrda brise objavu', async () => {
    const user = userEvent.setup();
    render(<Blog />);
    await screen.findByText('Letnji raspust');

    await user.click(screen.getByRole('button', { name: 'Obrisi' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Obrisi' }));

    await waitFor(() => expect(del).toHaveBeenCalledWith('/blog/b1'));
  });

  test('greska pri brisanju se vidi u dijalogu', async () => {
    del.mockRejectedValue(new Error('Objava je vec obrisana.'));
    const user = userEvent.setup();
    render(<Blog />);
    await screen.findByText('Letnji raspust');

    await user.click(screen.getByRole('button', { name: 'Obrisi' }));
    const dijalog = screen.getByRole('dialog');
    await user.click(within(dijalog).getByRole('button', { name: 'Obrisi' }));

    expect(await within(dijalog).findByText('Objava je vec obrisana.')).toBeInTheDocument();
  });
});
