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

// Ekran povlaci tri stvari: plan izabranog dana (spisak koji se prikazuje),
// nedeljni raspored i rezervacije (oboje samo da traka datuma zna gde ima
// sadrzaja). Mock zato mora da razlikuje rutu, a ne da svima vraca isto.
function mockApi({ items = [], week = {}, reservations = [] } = {}) {
  apiRequest.mockImplementation((put) => {
    if (put.startsWith('/schedule/plan')) return Promise.resolve({ items });
    if (put === '/schedule') return Promise.resolve({ week });
    if (put === '/reservations') return Promise.resolve({ reservations });
    return Promise.resolve({});
  });
}

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
    mockApi();
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
    zamrzniDan(2026, 7, 12); // sreda
    mockApi({
      items: [
        {
          id: 'a1',
          kind: 'ACTIVITY',
          title: 'Mali kuvari',
          description: 'Pravimo kolacice bez pecenja.',
          startTime: '10:30',
          endTime: '11:30',
          ageGroup: '3-6 godina',
          color: '#e76f51',
        },
      ],
    });

    await render(<ScheduleScreen />);

    expect(screen.getByText('Mali kuvari')).toBeTruthy();
    expect(screen.getByText('Pravimo kolacice bez pecenja.')).toBeTruthy();
    expect(screen.getByText('3-6 godina')).toBeTruthy();
    expect(screen.queryByText('Nema aktivnosti')).toBeNull();
  });

  // Raspored se ponavlja nedeljno, pa se cita po danu u nedelji - aktivnost
  // drugog dana ne sme da procuri u izabrani. Spajanje po danu sada radi
  // server, pa se ovde proverava da se plan trazi bas za izabrani datum.
  test('trazi plan za izabrani datum', async () => {
    zamrzniDan(2026, 7, 12); // sreda
    mockApi();

    await render(<ScheduleScreen />);

    expect(apiRequest).toHaveBeenCalledWith('/schedule/plan?date=2026-08-12');
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
    mockApi({
      items: [
        { id: 'a1', kind: 'ACTIVITY', title: 'Mali kuvari', startTime: '10:30', endTime: '11:30' },
      ],
    });

  test('prikazuje obavestenje sa razlogom', async () => {
    zamrzniDan(2026, 7, 12);
    mockZatvoreni = { [SREDA]: { date: SREDA, reason: 'Rodjendan', note: null } };
    mockApi();

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
    mockApi();

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
    mockApi();

    await render(<ScheduleScreen />);

    expect(screen.getByText('Danas ne radimo')).toBeTruthy();
  });
});

describe('ScheduleScreen - rodjendani', () => {
  const rodjendan = {
    id: 'r1',
    kind: 'BIRTHDAY',
    title: 'Rodjendan - Lena',
    startTime: '17:00',
    endTime: '20:00',
    isFullDay: false,
  };

  const aktivnost = {
    id: 'a1',
    kind: 'ACTIVITY',
    title: 'Mali kuvari',
    startTime: '10:30',
    endTime: '11:30',
  };

  test('rodjendan se vidi u rasporedu', async () => {
    zamrzniDan(2026, 7, 12);
    mockApi({ items: [rodjendan] });

    await render(<ScheduleScreen />);

    expect(screen.getByText('Rodjendan - Lena')).toBeTruthy();
    expect(screen.getByText('17:00 - 20:00')).toBeTruthy();
  });

  test('nosi oznaku, da se razlikuje od redovne aktivnosti', async () => {
    zamrzniDan(2026, 7, 12);
    mockApi({ items: [rodjendan] });

    await render(<ScheduleScreen />);

    expect(screen.getByText('Rodjendan')).toBeTruthy();
  });

  // Sustina: rodjendan je dogadjaj dana i stoji iznad ostalog, a ostalo tog
  // dana ostaje - i ono pre i ono posle njega.
  test('stoji iznad aktivnosti, a one ostaju', async () => {
    zamrzniDan(2026, 7, 12);
    mockApi({
      items: [
        rodjendan,
        aktivnost,
        { ...aktivnost, id: 'a2', title: 'Vecernja igra', startTime: '20:30', endTime: '21:00' },
      ],
    });

    await render(<ScheduleScreen />);

    const naslovi = ['Rodjendan - Lena', 'Mali kuvari', 'Vecernja igra'];
    for (const naslov of naslovi) expect(screen.getByText(naslov)).toBeTruthy();

    // Redosled na ekranu prati redosled koji je server poslao.
    const redosled = naslovi.map((n) => screen.getByText(n));
    expect(redosled).toHaveLength(3);
  });

  // Celodnevni rodjendan nema smislen termin - "00:00 - 23:59" ne govori nista.
  test('celodnevni rodjendan pise "Ceo dan" umesto termina', async () => {
    zamrzniDan(2026, 7, 12);
    mockApi({ items: [{ ...rodjendan, isFullDay: true, startTime: '00:00', endTime: '23:59' }] });

    await render(<ScheduleScreen />);

    expect(screen.getByText('Ceo dan')).toBeTruthy();
    expect(screen.queryByText('00:00 - 23:59')).toBeNull();
  });

  test('neradnog dana se ni rodjendan ne prikazuje', async () => {
    zamrzniDan(2026, 7, 12);
    mockZatvoreni = { '2026-08-12': { date: '2026-08-12', reason: 'Praznik', note: null } };
    mockApi({ items: [rodjendan] });

    await render(<ScheduleScreen />);

    expect(screen.queryByText('Rodjendan - Lena')).toBeNull();
  });
});
