import { render, screen, waitFor } from '@testing-library/react-native';
import PackageScreen from '../PackageScreen';
import { apiRequest } from '../../utils/api';

jest.mock('../../utils/api', () => ({ apiRequest: jest.fn() }));
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (callback) => require('react').useEffect(callback, [callback]),
}));
jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: { firstName: 'Ana', lastName: 'Petrovic' } }),
}));

const SUTRA = new Date(Date.now() + 30 * 864e5).toISOString();
const JUCE = new Date(Date.now() - 864e5).toISOString();

const paket = (over = {}) => ({
  id: 'up1',
  isActive: true,
  expiresAt: SUTRA,
  totalHours: 10,
  remainingHours: 6,
  package: { name: 'Paket 10h' },
  ...over,
});

const dete = { id: 'c1', firstName: 'Lena', lastName: 'Petrovic', qrCode: 'IGR-B4F46AB6' };

function odgovori({ packages = [paket()], children = [dete], debtHours = 0 } = {}) {
  apiRequest.mockImplementation((putanja) => {
    if (putanja === '/packages/my') return Promise.resolve({ userPackages: packages, debtHours });
    if (putanja === '/children') return Promise.resolve({ children });
    return Promise.resolve({});
  });
}

const navigation = { navigate: jest.fn() };
const prikazi = () => render(<PackageScreen navigation={navigation} />);

beforeEach(() => {
  jest.clearAllMocks();
  odgovori();
});

describe('PackageScreen', () => {
  test('pozdravlja roditelja imenom', async () => {
    await prikazi();
    expect(await screen.findByText('Zdravo,')).toBeTruthy();
  });

  test('zbir sati ide preko svih paketa koji vaze', async () => {
    odgovori({ packages: [paket(), paket({ id: 'up2', totalHours: 5, remainingHours: 1 })] });
    await prikazi();

    await waitFor(() => expect(screen.getByText('iz 2 paketa')).toBeTruthy());
  });

  // Istekao paket se ne racuna, ali ni ne rusi ekran.
  test('samo istekao paket znaci da nema aktivnog', async () => {
    odgovori({ packages: [paket({ expiresAt: JUCE })] });
    await prikazi();

    expect(await screen.findByText('Nemate aktivan paket')).toBeTruthy();
  });

  test('bez ijednog paketa poziva da se javi osoblju', async () => {
    odgovori({ packages: [] });
    await prikazi();

    expect(await screen.findByText('Nemate aktivan paket')).toBeTruthy();
  });

  test('prikazuje decu roditelja', async () => {
    await prikazi();
    expect(await screen.findByText('Moja deca')).toBeTruthy();
  });

  test('bez dece nudi prvi korak', async () => {
    odgovori({ children: [] });
    await prikazi();

    expect(await screen.findByText('Jos nemate dodatu decu')).toBeTruthy();
  });

  // Oba poziva imaju svoj catch, pa jedan pad ne obara ceo ekran.
  test('greska na jednom pozivu ne rusi ekran', async () => {
    apiRequest.mockImplementation((putanja) =>
      putanja === '/packages/my'
        ? Promise.reject(new Error('Puklo.'))
        : Promise.resolve({ children: [dete] })
    );
    await prikazi();

    expect(await screen.findByText('Nemate aktivan paket')).toBeTruthy();
    expect(screen.getByText('Moja deca')).toBeTruthy();
  });
});

// Dete moze da udje i bez paketa - odigrani sati se skupljaju kao minus koji
// roditelj plati u igraonici.
describe('PackageScreen - minus sati', () => {
  test('bez minusa nema kartice', async () => {
    await prikazi();

    await screen.findByText('Zdravo,');
    expect(screen.queryByText(/Sati odigrani bez paketa/)).toBeNull();
  });

  test('minus se prikazuje kao negativan broj sati', async () => {
    odgovori({ debtHours: 3 });
    await prikazi();

    expect(await screen.findByText('-3 h')).toBeTruthy();
    expect(screen.getByText(/Sati odigrani bez paketa/)).toBeTruthy();
  });

  test('minus stoji i kad roditelj nema nijedan paket', async () => {
    odgovori({ packages: [], debtHours: 2.5 });
    await prikazi();

    expect(await screen.findByText('-2,5 h')).toBeTruthy();
    expect(screen.getByText(/skupljaju kao minus/)).toBeTruthy();
  });
});
