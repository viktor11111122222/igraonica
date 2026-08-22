import { render, screen, fireEvent, act, waitFor } from '@testing-library/react-native';
import NotificationsScreen from '../NotificationsScreen';
import { apiRequest } from '../../utils/api';

jest.mock('../../utils/api', () => ({ apiRequest: jest.fn() }));
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (callback) => require('react').useEffect(callback, [callback]),
}));

const SADA = new Date('2026-08-22T16:00:00.000Z');

const obavestenje = (over = {}) => ({
  id: 'n1',
  type: 'CHILD_CHECKED_IN',
  title: 'Dete je u igraonici',
  body: 'Lena je prijavljena u 15:22.',
  readAt: null,
  createdAt: '2026-08-22T15:50:00.000Z',
  ...over,
});

function odgovori({ notifications = [obavestenje()], unreadCount = 1 } = {}) {
  apiRequest.mockImplementation((putanja) => {
    if (String(putanja).startsWith('/notifications?')) {
      return Promise.resolve({ notifications, unreadCount });
    }
    return Promise.resolve({});
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  jest.setSystemTime(SADA);
  odgovori();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('NotificationsScreen', () => {
  test('prikazuje naslov i tekst obavestenja', async () => {
    await render(<NotificationsScreen />);

    expect(await screen.findByText('Dete je u igraonici')).toBeTruthy();
    expect(screen.getByText('Lena je prijavljena u 15:22.')).toBeTruthy();
  });

  test('pokazuje koliko je proslo i tacan sat', async () => {
    await render(<NotificationsScreen />);
    expect(await screen.findByText(/pre 10 min · \d{2}[:.]\d{2}/)).toBeTruthy();
  });

  test('sasvim sveze pise "upravo sada"', async () => {
    odgovori({ notifications: [obavestenje({ createdAt: SADA.toISOString() })] });
    await render(<NotificationsScreen />);
    expect(await screen.findByText(/upravo sada/)).toBeTruthy();
  });

  // Boja sama ne bi bila dovoljna, pa neprocitano nosi i tackicu.
  test('neprocitano je oznaceno i mimo boje', async () => {
    await render(<NotificationsScreen />);
    expect(await screen.findByLabelText('neprocitano')).toBeTruthy();
  });

  test('procitano nema tackicu', async () => {
    odgovori({ notifications: [obavestenje({ readAt: SADA.toISOString() })], unreadCount: 0 });
    await render(<NotificationsScreen />);

    await screen.findByText('Dete je u igraonici');
    expect(screen.queryByLabelText('neprocitano')).toBeNull();
  });

  test('dodir na neprocitano ga oznacava', async () => {
    await render(<NotificationsScreen />);
    const red = await screen.findByText('Lena je prijavljena u 15:22.');

    await act(async () => {
      fireEvent.press(red);
    });

    await waitFor(() =>
      expect(apiRequest).toHaveBeenCalledWith('/notifications/n1/read', { method: 'PATCH' })
    );
  });

  test('dodir na vec procitano ne salje nista', async () => {
    odgovori({ notifications: [obavestenje({ readAt: SADA.toISOString() })], unreadCount: 0 });
    await render(<NotificationsScreen />);
    const red = await screen.findByText('Lena je prijavljena u 15:22.');
    apiRequest.mockClear();

    await act(async () => {
      fireEvent.press(red);
    });

    expect(apiRequest).not.toHaveBeenCalledWith('/notifications/n1/read', { method: 'PATCH' });
  });

  test('"Oznaci sve" se nudi samo kada ima neprocitanih', async () => {
    await render(<NotificationsScreen />);
    const dugme = await screen.findByText('Oznaci sve kao procitano');

    await act(async () => {
      fireEvent.press(dugme);
    });

    await waitFor(() =>
      expect(apiRequest).toHaveBeenCalledWith('/notifications/read-all', { method: 'POST' })
    );
  });

  test('bez neprocitanih nema tog dugmeta', async () => {
    odgovori({ notifications: [obavestenje({ readAt: SADA.toISOString() })], unreadCount: 0 });
    await render(<NotificationsScreen />);

    await screen.findByText('Dete je u igraonici');
    expect(screen.queryByText('Oznaci sve kao procitano')).toBeNull();
  });

  test('prazan spisak objasnjava sta ce tu stizati', async () => {
    odgovori({ notifications: [], unreadCount: 0 });
    await render(<NotificationsScreen />);

    expect(await screen.findByText('Nema obavestenja')).toBeTruthy();
    expect(screen.getByText(/kada dete udje u igraonicu/)).toBeTruthy();
  });

  // Prazna lista bi izgledala kao da obavestenja nema, sto nije isto.
  test('greska sa servera ne prazni spisak', async () => {
    await render(<NotificationsScreen />);
    await screen.findByText('Dete je u igraonici');

    apiRequest.mockRejectedValue(new Error('Nema veze sa serverom.'));
    await act(async () => {
      jest.advanceTimersByTime(15000);
    });

    expect(screen.getByText('Dete je u igraonici')).toBeTruthy();
  });
});
