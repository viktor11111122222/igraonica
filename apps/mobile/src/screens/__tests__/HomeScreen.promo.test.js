import { render, screen, waitFor } from '@testing-library/react-native';
import HomeScreen from '../HomeScreen';
import { apiRequest } from '../../utils/api';

jest.mock('../../utils/api', () => ({
  apiRequest: jest.fn(),
  mediaUrl: (p) => (p ? `http://server${p}` : null),
}));

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (callback) => require('react').useEffect(callback, [callback]),
}));

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: { firstName: 'Test' } }),
}));

jest.mock('../../context/ClosedDaysContext', () => ({
  useClosedDays: () => ({
    closedDays: {},
    loading: false,
    reload: () => {},
    closedOn: () => null,
    isClosed: () => false,
  }),
}));

jest.mock('../../context/SettingsContext', () => ({
  useSettings: () => ({ settings: { mobile_tab_gallery: 'true' } }),
}));

const promocija = (over = {}) => ({
  id: 'pb1',
  title: 'Letnji popust',
  description: 'Svaki drugi dolazak gratis.',
  imageUrl: '/uploads/leto.jpg',
  showPopup: false,
  ...over,
});

function odgovori({ promoBanners = [] } = {}) {
  apiRequest.mockImplementation((putanja) => {
    if (putanja === '/promo-banners') return Promise.resolve({ promoBanners });
    return Promise.resolve({});
  });
}

const prikazi = () => render(<HomeScreen navigation={{ navigate: jest.fn() }} />);

// Sav tekst na ekranu, redom kojim je iscrtan - da bi se videlo sta stoji iznad
// cega, a ne samo da postoji.
function tekstRedom(cvor = screen.toJSON(), skup = []) {
  if (!cvor) return skup;
  if (typeof cvor === 'string') skup.push(cvor);
  else (cvor.children || []).forEach((d) => tekstRedom(d, skup));
  return skup;
}

beforeEach(() => {
  jest.clearAllMocks();
  odgovori();
});

describe('HomeScreen - promocije', () => {
  test('bez promocija nema sekcije', async () => {
    await prikazi();

    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith('/promo-banners'));
    expect(screen.queryByText('Promocija')).toBeNull();
    expect(screen.queryByText('Promocije')).toBeNull();
  });

  test('promocija se prikazuje sa naslovom i opisom', async () => {
    odgovori({ promoBanners: [promocija()] });
    await prikazi();

    expect(await screen.findByText('Letnji popust')).toBeTruthy();
    expect(screen.getByText('Svaki drugi dolazak gratis.')).toBeTruthy();
  });

  // Dogovoreno mesto: tacno iznad galerije.
  test('stoji iznad galerije', async () => {
    odgovori({ promoBanners: [promocija()] });
    await prikazi();
    await screen.findByText('Letnji popust');

    const redom = tekstRedom();
    expect(redom.indexOf('Promocija')).toBeGreaterThan(-1);
    expect(redom.indexOf('Promocija')).toBeLessThan(redom.indexOf('Galerija'));
  });

  test('vise promocija dobija naslov u mnozini', async () => {
    odgovori({
      promoBanners: [promocija(), promocija({ id: 'pb2', title: 'Jesenja akcija' })],
    });
    await prikazi();

    expect(await screen.findByText('Promocije')).toBeTruthy();
    expect(screen.getByText('Jesenja akcija')).toBeTruthy();
  });
});
