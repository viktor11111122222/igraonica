import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import PromoBanners from '../PromoBanners';

const promocija = (over = {}) => ({
  id: 'p1',
  title: 'Letnji popust',
  description: 'Svaki drugi dolazak gratis.',
  imageUrl: '/uploads/leto.jpg',
  showPopup: true,
  ...over,
});

describe('PromoBanners', () => {
  test('ispisuje naslov i opis', async () => {
    await render(<PromoBanners promocije={[promocija()]} />);

    expect(screen.getByText('Letnji popust')).toBeTruthy();
    expect(screen.getByText('Svaki drugi dolazak gratis.')).toBeTruthy();
  });

  // Putanja sa servera je relativna ("/uploads/..."), telefonu treba puna.
  test('slika dobija punu adresu servera', async () => {
    await render(<PromoBanners promocije={[promocija()]} />);

    const slika = screen.getByLabelText('Letnji popust');
    expect(slika.props.source.uri).toMatch(/^https?:\/\/.+\/uploads\/leto\.jpg$/);
  });

  test('promocija bez slike se svejedno prikazuje', async () => {
    await render(<PromoBanners promocije={[promocija({ imageUrl: null })]} />);

    expect(screen.getByText('Letnji popust')).toBeTruthy();
    expect(screen.queryByLabelText('Letnji popust')).toBeNull();
  });

  // Bez slike kartica ne sme da ostane prazna bela povrsina, nego ide u boji sa
  // sarom - istom onom iz zaglavlja.
  test('promocija bez slike dobija podlogu u boji', async () => {
    await render(<PromoBanners promocije={[promocija({ imageUrl: null })]} />);

    expect(screen.getByTestId('promo-sara')).toBeTruthy();
  });

  test('promocija sa slikom nema podlogu u boji', async () => {
    await render(<PromoBanners promocije={[promocija()]} />);

    expect(screen.queryByTestId('promo-sara')).toBeNull();
  });

  // Jedna promocija je obican baner - tacke bi bile samo smetnja.
  test('jedna promocija nema tacke', async () => {
    await render(<PromoBanners promocije={[promocija()]} />);

    expect(screen.queryByLabelText(/Promocija 1 od/)).toBeNull();
  });

  test('vise promocija ide u karusel sa tackama', async () => {
    await render(
      <PromoBanners
        promocije={[promocija(), promocija({ id: 'p2', title: 'Druga', description: null })]}
      />
    );

    expect(screen.getByText('Letnji popust')).toBeTruthy();
    expect(screen.getByText('Druga')).toBeTruthy();
    expect(screen.getByLabelText('Promocija 1 od 2')).toBeTruthy();
    expect(screen.getByLabelText('Promocija 2 od 2')).toBeTruthy();
  });

  test('prevlacenje pomera aktivnu tacku', async () => {
    const promocije = [
      promocija(),
      promocija({ id: 'p2', title: 'Druga' }),
      promocija({ id: 'p3', title: 'Treca' }),
    ];
    await render(<PromoBanners promocije={promocije} />);

    const prva = screen.getByLabelText('Promocija 1 od 3');
    expect(prva.props.accessibilityState.selected).toBe(true);

    // Sirina ekrana u testu je 750, kartica 750 - 40 - 28 = 682, korak 694.
    fireEvent(screen.getByTestId('promo-karusel'), 'momentumScrollEnd', {
      nativeEvent: { contentOffset: { x: 694 }, contentSize: { width: 2082, height: 300 }, layoutMeasurement: { width: 750, height: 300 } },
    });

    // Stanje se osvezava u sledecem prolazu, pa se ceka umesto da se cita odmah.
    await waitFor(() =>
      expect(screen.getByLabelText('Promocija 2 od 3').props.accessibilityState.selected).toBe(true)
    );
    expect(screen.getByLabelText('Promocija 1 od 3').props.accessibilityState.selected).toBe(false);
  });

  test('bez promocija ne crta nista', async () => {
    await render(<PromoBanners promocije={[]} />);
    expect(screen.queryByText('Letnji popust')).toBeNull();
  });
});
