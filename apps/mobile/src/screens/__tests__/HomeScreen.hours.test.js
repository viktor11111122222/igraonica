import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import HomeScreen from '../HomeScreen';
import { apiRequest } from '../../utils/api';

jest.mock('../../utils/api', () => ({ apiRequest: jest.fn() }));

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
  useSettings: () => ({ settings: { mobile_tab_gallery: 'false' } }),
}));

const SUTRA = new Date(Date.now() + 30 * 864e5).toISOString();

const paket = {
  id: 'up1',
  isActive: true,
  expiresAt: SUTRA,
  totalHours: 10,
  remainingHours: 6,
  package: { name: 'Paket 10h' },
};

function odgovori({ packages = [paket], debtHours = 0 } = {}) {
  apiRequest.mockImplementation((putanja) => {
    if (putanja === '/packages/my') return Promise.resolve({ userPackages: packages, debtHours });
    return Promise.resolve({});
  });
}

const prikazi = () => render(<HomeScreen navigation={{ navigate: jest.fn() }} />);

beforeEach(() => {
  jest.clearAllMocks();
  odgovori();
});

// Kartica sati je prvo sto roditelj vidi, pa minus mora da bude tu - ne samo
// na tabu "Moj paket".
describe('HomeScreen - kartica sati', () => {
  test('prikazuje preostale sate iz paketa', async () => {
    await prikazi();

    expect(await screen.findByText('Preostalo sati')).toBeTruthy();
    expect(screen.getByText('6')).toBeTruthy();
    expect(screen.getByText('od ukupno 10 h')).toBeTruthy();
  });

  test('bez minusa se ne pominje naplata', async () => {
    await prikazi();

    await screen.findByText('Preostalo sati');
    expect(screen.queryByText(/Minus/)).toBeNull();
  });

  // Sati jos ima, ali je ostao i stari dug: to su dva razlicita podatka, pa
  // stoje jedan uz drugi.
  test('uz preostale sate minus stoji kao dopuna', async () => {
    odgovori({ debtHours: 2 });
    await prikazi();

    expect(await screen.findByText('Minus 2 h za naplatu')).toBeTruthy();
    expect(screen.getByText('6')).toBeTruthy();
    expect(screen.getByText('od ukupno 10 h')).toBeTruthy();
  });

  // Tezina mora da ide preko fontFamily: `fontWeight` uz Montserrat radi samo
  // na iOS-u, pa bi na Androidu ovaj red ostao tanak.
  test('minus je istaknut i na Androidu', async () => {
    odgovori({ debtHours: 2 });
    await prikazi();

    const red = await screen.findByText('Minus 2 h za naplatu');
    const stil = StyleSheet.flatten(red.props.style);
    expect(stil.fontWeight).toBeUndefined();
    expect(stil.fontFamily).toBe('Montserrat_600SemiBold');
  });

  // "Preostalo 0" i "minus 4 h" jedno ispod drugog su govorili istu stvar
  // dvaput, i to kao da su dva podatka. Kad sati nema, minus JE stanje.
  test('kad sati nema, minus je sama brojka stanja', async () => {
    odgovori({ packages: [{ ...paket, remainingHours: 0 }], debtHours: 4 });
    await prikazi();

    expect(await screen.findByText('-4')).toBeTruthy();
    expect(screen.getByText('za naplatu')).toBeTruthy();
    expect(screen.getByText('Preostalo sati')).toBeTruthy();
    // Nema ni nule ni "Minus 4 h za naplatu" - to bi bilo dvaput isto.
    expect(screen.queryByText('0')).toBeNull();
    expect(screen.queryByText('Minus 4 h za naplatu')).toBeNull();
    expect(screen.queryByText('od ukupno 10 h')).toBeNull();
  });

  test('minus je crven, da se ne cita kao obicno stanje', async () => {
    odgovori({ packages: [{ ...paket, remainingHours: 0 }], debtHours: 4 });
    await prikazi();

    const brojka = await screen.findByText('-4');
    expect(StyleSheet.flatten(brojka.props.style).color).toBe('#d9534f');
  });

  test('bez paketa, a sa minusom, stoji minus umesto poziva na kupovinu', async () => {
    odgovori({ packages: [], debtHours: 1.5 });
    await prikazi();

    expect(await screen.findByText('-1,5')).toBeTruthy();
    expect(screen.getByText('za naplatu')).toBeTruthy();
    expect(screen.queryByText('Kontaktirajte igraonicu za paket')).toBeNull();
    expect(screen.queryByText('Nemate aktivan paket')).toBeNull();
  });
});
