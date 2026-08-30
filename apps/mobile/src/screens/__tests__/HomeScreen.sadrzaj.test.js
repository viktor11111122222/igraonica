import { render, screen, fireEvent } from '@testing-library/react-native';
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

function odgovori({ menu = obroci, week = { 0: aktivnosti, 1: aktivnosti, 2: aktivnosti, 3: aktivnosti, 4: aktivnosti, 5: aktivnosti, 6: aktivnosti } } = {}) {
  apiRequest.mockImplementation((putanja) => {
    if (putanja.startsWith('/menu')) return Promise.resolve({ items: menu });
    if (putanja === '/schedule') return Promise.resolve({ week });
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

describe('HomeScreen - sta se danas desava', () => {
  test('prikazuje danasnji obrok i aktivnost', async () => {
    await prikazi();

    expect(await screen.findByText('Pileca supa')).toBeTruthy();
    expect(screen.getByText('Sportsko jutro')).toBeTruthy();
  });

  test('bez unetog jelovnika stoji poruka umesto praznog reda', async () => {
    odgovori({ menu: [] });
    await prikazi();

    expect(await screen.findByText(/nema unetih obroka/i)).toBeTruthy();
  });

  test('veze vode na cele spiskove', async () => {
    await prikazi();
    await screen.findByText('Pileca supa');

    fireEvent.press(screen.getByText('Ceo jelovnik'));
    expect(navigation.navigate).toHaveBeenCalledWith('Menu');

    fireEvent.press(screen.getByText('Ceo raspored'));
    expect(navigation.navigate).toHaveBeenCalledWith('Schedule');
  });

});
