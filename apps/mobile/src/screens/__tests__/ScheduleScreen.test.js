import { render, screen } from '@testing-library/react-native';
import ScheduleScreen from '../ScheduleScreen';
import { apiRequest } from '../../utils/api';

jest.mock('../../utils/api', () => ({ apiRequest: jest.fn() }));

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (callback) => require('react').useEffect(callback, [callback]),
}));

// Obavestenje zavisi od podesavanja sa servera; ovde nas ne zanima.
jest.mock('../../context/SettingsContext', () => ({
  useSettings: () => ({ settings: {} }),
}));

// Neradni dani se podesavaju po testu; podrazumevano ih nema.
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

// Datum se zamrzava, inace bi test menjao rezultat u zavisnosti od dana kada
// se pokrece.
function zamrzniDan(godina, mesecOd0, dan) {
  jest.useFakeTimers().setSystemTime(new Date(godina, mesecOd0, dan, 12, 0, 0));
}

afterEach(() => {
  jest.useRealTimers();
  jest.clearAllMocks();
});

describe('ScheduleScreen - prazan dan', () => {
  beforeEach(() => {
    apiRequest.mockResolvedValue({ week: {} });
  });

  // Recenica glasi "Za <dan> nije zakazana...", sto trazi akuzativ. Zenski
  // dani menjaju oblik (sreda -> sredu), muski ostaju isti.
  test.each([
    ['ponedeljak', 2026, 7, 10],
    ['utorak', 2026, 7, 11],
    ['sredu', 2026, 7, 12],
    ['cetvrtak', 2026, 7, 13],
    ['petak', 2026, 7, 14],
    ['subotu', 2026, 7, 15],
    ['nedelju', 2026, 7, 16],
  ])('koristi akuzativ "%s"', async (oblik, g, m, d) => {
    zamrzniDan(g, m, d);
    await render(<ScheduleScreen />);

    expect(
      screen.getByText(new RegExp(`Za ${oblik} nije zakazana nijedna aktivnost`))
    ).toBeTruthy();
  });

  test('prikazuje naslov praznog stanja', async () => {
    zamrzniDan(2026, 7, 12);
    await render(<ScheduleScreen />);

    expect(screen.getByText('Nema aktivnosti')).toBeTruthy();
  });
});

describe('ScheduleScreen - dan sa aktivnostima', () => {
  test('prikazuje aktivnosti izabranog dana', async () => {
    zamrzniDan(2026, 7, 12); // sreda -> dayIndex 2
    apiRequest.mockResolvedValue({
      week: {
        2: [
          {
            id: 'a1',
            title: 'Mali kuvari',
            description: 'Pravimo kolacice bez pecenja.',
            startTime: '10:30',
            endTime: '11:30',
            ageGroup: '3-6 godina',
            color: '#e76f51',
          },
        ],
      },
    });

    await render(<ScheduleScreen />);

    expect(screen.getByText('Mali kuvari')).toBeTruthy();
    expect(screen.getByText('Pravimo kolacice bez pecenja.')).toBeTruthy();
    expect(screen.getByText('3-6 godina')).toBeTruthy();
    expect(screen.queryByText('Nema aktivnosti')).toBeNull();
  });

  // Raspored se ponavlja nedeljno, pa se cita po danu u nedelji - aktivnost
  // drugog dana ne sme da procuri u izabrani.
  test('ne prikazuje aktivnosti drugog dana', async () => {
    zamrzniDan(2026, 7, 12); // sreda -> 2
    apiRequest.mockResolvedValue({
      week: {
        0: [{ id: 'p1', title: 'Jutarnja gimnastika', startTime: '09:30', endTime: '10:15' }],
      },
    });

    await render(<ScheduleScreen />);

    expect(screen.queryByText('Jutarnja gimnastika')).toBeNull();
    expect(screen.getByText('Nema aktivnosti')).toBeTruthy();
  });

  test('pad mreze ne rusi ekran, prikazuje prazno stanje', async () => {
    zamrzniDan(2026, 7, 12);
    apiRequest.mockRejectedValue(new Error('nema mreze'));

    await render(<ScheduleScreen />);

    expect(screen.getByText('Nema aktivnosti')).toBeTruthy();
  });
});

describe('ScheduleScreen - neradni dan', () => {
  const SREDA = '2026-08-12';

  const saAktivnostima = () =>
    apiRequest.mockResolvedValue({
      week: {
        2: [{ id: 'a1', title: 'Mali kuvari', startTime: '10:30', endTime: '11:30' }],
      },
    });

  test('prikazuje obavestenje sa razlogom', async () => {
    zamrzniDan(2026, 7, 12);
    mockZatvoreni = { [SREDA]: { date: SREDA, reason: 'Rodjendan', note: null } };
    apiRequest.mockResolvedValue({ week: {} });

    await render(<ScheduleScreen />);

    expect(screen.getByText('Rodjendan')).toBeTruthy();
  });

  // Aktivnosti se tog dana ne odrzavaju - ne smeju da stoje ispod obavestenja
  // da se ne dolazi.
  test('ne prikazuje aktivnosti tog dana', async () => {
    zamrzniDan(2026, 7, 12);
    mockZatvoreni = { [SREDA]: { date: SREDA, reason: 'Rodjendan', note: null } };
    saAktivnostima();

    await render(<ScheduleScreen />);

    expect(screen.queryByText('Mali kuvari')).toBeNull();
  });

  // "Nije zakazana nijedna aktivnost" bi tu zvucalo kao da je dan radan.
  test('ne prikazuje prazno stanje pored obavestenja', async () => {
    zamrzniDan(2026, 7, 12);
    mockZatvoreni = { [SREDA]: { date: SREDA, reason: 'Rodjendan', note: null } };
    apiRequest.mockResolvedValue({ week: {} });

    await render(<ScheduleScreen />);

    expect(screen.queryByText('Nema aktivnosti')).toBeNull();
  });

  test('drugi dan ostaje radni i prikazuje svoje aktivnosti', async () => {
    zamrzniDan(2026, 7, 12);
    mockZatvoreni = {
      '2026-08-14': { date: '2026-08-14', reason: 'Rodjendan', note: null },
    };
    saAktivnostima();

    await render(<ScheduleScreen />);

    expect(screen.getByText('Mali kuvari')).toBeTruthy();
    expect(screen.queryByText('Rodjendan')).toBeNull();
  });

  test('kada je neradni dan danasnji, tekst je izricit', async () => {
    zamrzniDan(2026, 7, 12);
    mockZatvoreni = { [SREDA]: { date: SREDA, reason: 'Praznik', note: null } };
    apiRequest.mockResolvedValue({ week: {} });

    await render(<ScheduleScreen />);

    expect(screen.getByText('Danas ne radimo')).toBeTruthy();
  });
});
