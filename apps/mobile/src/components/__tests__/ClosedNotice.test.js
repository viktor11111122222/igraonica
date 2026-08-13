import { render, screen } from '@testing-library/react-native';
import ClosedNotice from '../ClosedNotice';

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

const DAN = '2026-08-14';

beforeEach(() => {
  mockZatvoreni = {};
});

describe('ClosedNotice', () => {
  test('ne prikazuje nista kada je dan radni', async () => {
    const { toJSON } = await render(<ClosedNotice date={DAN} />);
    expect(toJSON()).toBeNull();
  });

  test('prikazuje razlog za neradni dan', async () => {
    mockZatvoreni = { [DAN]: { date: DAN, reason: 'Rodjendan', note: null } };
    await render(<ClosedNotice date={DAN} />);

    expect(screen.getByText('Rodjendan')).toBeTruthy();
    expect(screen.getByText('Ovog dana ne radimo')).toBeTruthy();
  });

  // Na pocetnom ekranu je uvek rec o danasnjem danu, pa tekst mora da bude
  // izricit - "Danas", ne "Ovog dana".
  test('drugaciji naslov kada je taj dan danasnji', async () => {
    mockZatvoreni = { [DAN]: { date: DAN, reason: 'Rodjendan', note: null } };
    await render(<ClosedNotice date={DAN} today />);

    expect(screen.getByText('Danas ne radimo')).toBeTruthy();
    expect(screen.queryByText('Ovog dana ne radimo')).toBeNull();
  });

  test('prikazuje napomenu kada postoji', async () => {
    mockZatvoreni = {
      [DAN]: { date: DAN, reason: 'Rodjendan', note: 'Radimo od 18h' },
    };
    await render(<ClosedNotice date={DAN} />);

    expect(screen.getByText('Radimo od 18h')).toBeTruthy();
  });

  test('bez napomene se red za napomenu ne prikazuje', async () => {
    mockZatvoreni = { [DAN]: { date: DAN, reason: 'Praznik', note: null } };
    await render(<ClosedNotice date={DAN} />);

    expect(screen.getByText('Praznik')).toBeTruthy();
    expect(screen.queryByTestId('closed-note')).toBeNull();
  });

  test('obavestenje se odnosi na trazeni dan, ne na bilo koji neradni', async () => {
    mockZatvoreni = {
      '2026-08-20': { date: '2026-08-20', reason: 'Praznik', note: null },
    };
    const { toJSON } = await render(<ClosedNotice date={DAN} />);

    expect(toJSON()).toBeNull();
  });
});
