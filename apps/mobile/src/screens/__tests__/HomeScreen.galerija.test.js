import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
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

let mockZatvoreno = false;
jest.mock('../../context/ClosedDaysContext', () => ({
  useClosedDays: () => ({
    closedDays: {},
    loading: false,
    reload: () => {},
    closedOn: () => (mockZatvoreno ? { reason: 'Drzavni praznik' } : null),
    isClosed: () => mockZatvoreno,
  }),
}));

let mockPodesavanja = { mobile_tab_gallery: 'true' };
jest.mock('../../context/SettingsContext', () => ({
  useSettings: () => ({ settings: mockPodesavanja }),
}));

const obroci = [{ id: 'm1', mealType: 'LUNCH', name: 'Pileca supa', description: null }];
const aktivnosti = [
  { id: 'a1', title: 'Sportsko jutro', startTime: '10:00', endTime: '11:00', ageRange: '4-6 godina' },
];

// Pocetna trazi plan dana ("/schedule/plan?date=..."), ne nedeljni raspored -
// samo plan zna za rodjendane i za to koje aktivnosti oni gase.
function odgovori({ menu = obroci, plan = aktivnosti } = {}) {
  apiRequest.mockImplementation((putanja) => {
    if (putanja.startsWith('/menu')) return Promise.resolve({ items: menu });
    if (putanja.startsWith('/schedule/plan')) return Promise.resolve({ items: plan });
    return Promise.resolve({});
  });
}

const navigation = { navigate: jest.fn() };
const prikazi = () => render(<HomeScreen navigation={navigation} />);

beforeEach(() => {
  jest.clearAllMocks();
  mockZatvoreno = false;
  mockPodesavanja = { mobile_tab_gallery: 'true' };
  odgovori();
});

describe('HomeScreen - galerija i neradni dan', () => {
  // Neradnog dana nema ni jelovnika ni aktivnosti - obavestenje je cela prica.
  test('neradnog dana se blok preskace', async () => {
    mockZatvoreno = true;
    await prikazi();

    await waitFor(() => expect(apiRequest).toHaveBeenCalled());
    expect(screen.queryByText('Danas u igraonici')).toBeNull();
    expect(screen.queryByText('Pileca supa')).toBeNull();
  });

  test('traka slika vodi u punu galeriju', async () => {
    await prikazi();
    await screen.findByText('Galerija');

    fireEvent.press(screen.getByText('Sve fotografije'));
    expect(navigation.navigate).toHaveBeenCalledWith('Gallery');
  });

  // Osoblje moze da sakrije galeriju iz panela.
  test('iskljucena galerija se ne prikazuje', async () => {
    mockPodesavanja = { mobile_tab_gallery: 'false' };
    await prikazi();
    await screen.findByText('Danas u igraonici');

    expect(screen.queryByText('Galerija')).toBeNull();
  });
});
