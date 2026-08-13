import { render, screen } from '@testing-library/react-native';
import MenuScreen from '../MenuScreen';
import { apiRequest } from '../../utils/api';

jest.mock('../../utils/api', () => ({ apiRequest: jest.fn() }));

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (callback) => require('react').useEffect(callback, [callback]),
}));

jest.mock('../../context/SettingsContext', () => ({
  useSettings: () => ({ settings: {} }),
}));

let mockZatvoreni = {};

jest.mock('../../context/ClosedDaysContext', () => ({
  useClosedDays: () => ({
    closedDays: mockZatvoreni,
    loading: false,
    reload: () => {},
    closedOn: (date) => mockZatvoreni[date] || null,
    isClosed: (date) => !!mockZatvoreni[date],
  }),
}));

beforeEach(() => {
  mockZatvoreni = {};
});

const SREDA = '2026-08-12';

function zamrzniSredu() {
  jest.useFakeTimers().setSystemTime(new Date(2026, 7, 12, 12, 0, 0));
}

const obrok = (mealType, name, over = {}) => ({
  id: `${mealType}-1`,
  mealType,
  name,
  description: null,
  allergens: null,
  ...over,
});

afterEach(() => {
  jest.useRealTimers();
  jest.clearAllMocks();
});

describe('MenuScreen', () => {
  test('prikazuje sva cetiri obroka izabranog dana', async () => {
    zamrzniSredu();
    apiRequest.mockResolvedValue({
      week: {
        [SREDA]: [
          obrok('BREAKFAST', 'Musli sa mlekom'),
          obrok('SNACK_MORNING', 'Krofnice od jabuke'),
          obrok('LUNCH', 'Boranija sa junetinom'),
          obrok('SNACK_AFTERNOON', 'Voceni jogurt'),
        ],
      },
    });

    await render(<MenuScreen />);

    expect(screen.getByText('Musli sa mlekom')).toBeTruthy();
    expect(screen.getByText('Krofnice od jabuke')).toBeTruthy();
    expect(screen.getByText('Boranija sa junetinom')).toBeTruthy();
    expect(screen.getByText('Voceni jogurt')).toBeTruthy();

    // Nazivi obroka prate MealType enum sa backenda.
    expect(screen.getByText('Dorucak')).toBeTruthy();
    expect(screen.getByText('Uzina')).toBeTruthy();
    expect(screen.getByText('Rucak')).toBeTruthy();
    expect(screen.getByText('Popodnevna uzina')).toBeTruthy();
  });

  test('prikazuje opis i alergene kada postoje', async () => {
    zamrzniSredu();
    apiRequest.mockResolvedValue({
      week: {
        [SREDA]: [
          obrok('LUNCH', 'Boranija sa junetinom', {
            description: 'Uz domaci hleb',
            allergens: 'gluten, mleko',
          }),
        ],
      },
    });

    await render(<MenuScreen />);

    expect(screen.getByText('Uz domaci hleb')).toBeTruthy();
    expect(screen.getByText('gluten, mleko')).toBeTruthy();
  });

  test('prikazuje samo unete obroke, bez praznih kartica', async () => {
    zamrzniSredu();
    apiRequest.mockResolvedValue({
      week: { [SREDA]: [obrok('LUNCH', 'Pasulj prebranac')] },
    });

    await render(<MenuScreen />);

    expect(screen.getByText('Rucak')).toBeTruthy();
    expect(screen.queryByText('Dorucak')).toBeNull();
    expect(screen.queryByText('Popodnevna uzina')).toBeNull();
  });

  test('prazno stanje kada za taj dan nema jelovnika', async () => {
    zamrzniSredu();
    apiRequest.mockResolvedValue({ week: { [SREDA]: [] } });

    await render(<MenuScreen />);

    expect(screen.getByText('Za ovaj dan nema jelovnika')).toBeTruthy();
  });

  // Nedelja se ucitava cela, pa jelo drugog datuma ne sme da se prikaze
  // pod izabranim danom.
  test('ne mesa jelo sa drugog datuma', async () => {
    zamrzniSredu();
    apiRequest.mockResolvedValue({
      week: {
        [SREDA]: [],
        '2026-08-13': [obrok('LUNCH', 'Pasulj prebranac')],
      },
    });

    await render(<MenuScreen />);

    expect(screen.queryByText('Pasulj prebranac')).toBeNull();
    expect(screen.getByText('Za ovaj dan nema jelovnika')).toBeTruthy();
  });

  test('pad mreze ne rusi ekran', async () => {
    zamrzniSredu();
    apiRequest.mockRejectedValue(new Error('nema mreze'));

    await render(<MenuScreen />);

    expect(screen.getByText('Za ovaj dan nema jelovnika')).toBeTruthy();
  });

  test('trazi nedelju izabranog dana sa servera', async () => {
    zamrzniSredu();
    apiRequest.mockResolvedValue({ week: {} });

    await render(<MenuScreen />);

    expect(apiRequest).toHaveBeenCalledWith(`/menu/week?date=${SREDA}`);
  });
});

describe('MenuScreen - neradni dan', () => {
  const saJelovnikom = () =>
    apiRequest.mockResolvedValue({
      week: { [SREDA]: [obrok('LUNCH', 'Boranija sa junetinom')] },
    });

  test('prikazuje obavestenje umesto jelovnika', async () => {
    zamrzniSredu();
    mockZatvoreni = { [SREDA]: { date: SREDA, reason: 'Rodjendan', note: null } };
    saJelovnikom();

    await render(<MenuScreen />);

    expect(screen.getByText('Rodjendan')).toBeTruthy();
    expect(screen.queryByText('Boranija sa junetinom')).toBeNull();
  });

  test('drugi dan i dalje prikazuje svoj jelovnik', async () => {
    zamrzniSredu();
    mockZatvoreni = {
      '2026-08-14': { date: '2026-08-14', reason: 'Rodjendan', note: null },
    };
    saJelovnikom();

    await render(<MenuScreen />);

    expect(screen.getByText('Boranija sa junetinom')).toBeTruthy();
  });
});
