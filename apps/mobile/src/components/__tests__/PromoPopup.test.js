import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import PromoPopup from '../PromoPopup';
import * as storage from '../../utils/storage';

// Sopstveno skladiste po fajlu: sta je uredjaj vec video mora da krene od nule
// u svakom testu, inace zapis iz prethodnog testa sakrije promociju u sledecem.
jest.mock('../../utils/storage', () => {
  let memorija = {};
  return {
    getItem: jest.fn(async (k) => memorija[k] ?? null),
    setItem: jest.fn(async (k, v) => {
      memorija[k] = v;
    }),
    deleteItem: jest.fn(async (k) => {
      delete memorija[k];
    }),
    __ocisti: () => {
      memorija = {};
    },
  };
});

// `__ocisti` postoji samo u lazi iznad, pa se uzima iz same lazi - kroz obican
// import ga staticka provera ne vidi.
const { __ocisti } = jest.requireMock('../../utils/storage');

const KLJUC = 'promo_videne';

const promocija = (over = {}) => ({
  id: 'p1',
  title: 'Letnji popust',
  description: 'Svaki drugi dolazak gratis.',
  imageUrl: '/uploads/leto.jpg',
  showPopup: true,
  ...over,
});

// Vec vidjene promocije se zadaju unapred, umesto da se u istom testu prvo
// renderuje pa zatvori: dva rendera iste komponente u jednom testu ostavljaju
// RNTL u stanju u kom sledeci render vise nista ne iscrta.
const vecVidjene = (ids) => storage.setItem(KLJUC, JSON.stringify(ids));

beforeEach(() => {
  __ocisti();
  jest.clearAllMocks();
});

describe('PromoPopup', () => {
  test('prvi ulazak pokazuje promociju preko celog ekrana', async () => {
    await render(<PromoPopup promocije={[promocija()]} />);

    expect(await screen.findByText('Letnji popust')).toBeTruthy();
    expect(screen.getByText('Svaki drugi dolazak gratis.')).toBeTruthy();
  });

  test('vise novih promocija stoji u istom prozoru', async () => {
    await render(
      <PromoPopup promocije={[promocija(), promocija({ id: 'p2', title: 'Druga promocija' })]} />
    );

    expect(await screen.findByText('Letnji popust')).toBeTruthy();
    expect(screen.getByText('Druga promocija')).toBeTruthy();
  });

  // Sustina: posle prvog puta promocija zivi samo na pocetnoj.
  test('vec vidjena promocija se ne pojavljuje ponovo', async () => {
    await vecVidjene(['p1']);

    await render(<PromoPopup promocije={[promocija()]} />);

    await waitFor(() => expect(storage.getItem).toHaveBeenCalledWith(KLJUC));
    expect(screen.queryByText('Letnji popust')).toBeNull();
  });

  test('nova promocija dobija svoj prvi prikaz i kad je stara vec vidjena', async () => {
    await vecVidjene(['p1']);

    await render(
      <PromoPopup promocije={[promocija(), promocija({ id: 'p2', title: 'Jesenja akcija' })]} />
    );

    expect(await screen.findByText('Jesenja akcija')).toBeTruthy();
    expect(screen.queryByText('Letnji popust')).toBeNull();
  });

  test('zatvaranje pamti da je promocija vidjena', async () => {
    await render(<PromoPopup promocije={[promocija()]} />);
    fireEvent.press(await screen.findByLabelText('Zatvori'));

    await waitFor(() => expect(storage.setItem).toHaveBeenCalledWith(KLJUC, JSON.stringify(['p1'])));
    expect(screen.queryByText('Letnji popust')).toBeNull();
  });

  test('zatvaranje pamti sve promocije koje su bile u prozoru', async () => {
    await render(
      <PromoPopup promocije={[promocija(), promocija({ id: 'p2', title: 'Druga' })]} />
    );
    fireEvent.press(await screen.findByLabelText('Zatvori'));

    await waitFor(() =>
      expect(storage.setItem).toHaveBeenCalledWith(KLJUC, JSON.stringify(['p1', 'p2']))
    );
  });

  // Osoblje moze da iskljuci iskakanje: tada promocija samo stoji na pocetnoj.
  test('promocija bez iskakanja se ne prikazuje preko ekrana', async () => {
    await render(<PromoPopup promocije={[promocija({ showPopup: false })]} />);

    await waitFor(() => expect(screen.queryByText('Letnji popust')).toBeNull());
    // Bez kandidata se skladiste ni ne cita.
    expect(storage.getItem).not.toHaveBeenCalled();
  });

  test('bez promocija nema prozora', async () => {
    await render(<PromoPopup promocije={[]} />);
    expect(screen.queryByLabelText('Zatvori')).toBeNull();
  });

  // Neispravan zapis (rucna izmena, starija verzija) ne sme da obori ekran.
  test('pokvaren zapis o vidjenom se preskace', async () => {
    await storage.setItem(KLJUC, 'ovo-nije-json');

    await render(<PromoPopup promocije={[promocija()]} />);

    expect(await screen.findByText('Letnji popust')).toBeTruthy();
  });
});
