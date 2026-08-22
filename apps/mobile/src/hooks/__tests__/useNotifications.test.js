import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useNotifications } from '../useNotifications';
import { apiRequest } from '../../utils/api';

jest.mock('../../utils/api', () => ({ apiRequest: jest.fn() }));
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (callback) => require('react').useEffect(callback, [callback]),
}));

// Pazi: u @testing-library/react-native v14 su renderHook i render asinhroni.
const obavestenje = (over = {}) => ({
  id: 'n1',
  type: 'CHILD_CHECKED_IN',
  title: 'Dete je u igraonici',
  body: 'Lena je prijavljena u 15:22.',
  readAt: null,
  createdAt: '2026-08-22T15:50:00.000Z',
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  apiRequest.mockResolvedValue({ notifications: [obavestenje()], unreadCount: 1 });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('useNotifications', () => {
  test('dovlaci spisak i broj neprocitanih', async () => {
    const { result } = await renderHook(() => useNotifications());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.notifications).toHaveLength(1);
    expect(result.current.unreadCount).toBe(1);
  });

  // Pocetnom ekranu treba samo znacka - ceo spisak svakih 15 sekundi bi bio
  // trosak bez razloga.
  test('sa samoBroj povlaci samo brojac', async () => {
    apiRequest.mockResolvedValue({ unreadCount: 4 });
    const { result } = await renderHook(() => useNotifications({ samoBroj: true }));

    await waitFor(() => expect(result.current.unreadCount).toBe(4));
    expect(apiRequest).toHaveBeenCalledWith('/notifications/unread-count');
    expect(apiRequest).not.toHaveBeenCalledWith(expect.stringContaining('limit'));
  });

  test('sam se osvezava dok je ekran otvoren', async () => {
    jest.useFakeTimers();
    await renderHook(() => useNotifications());
    await waitFor(() => expect(apiRequest).toHaveBeenCalledTimes(1));

    await act(async () => {
      jest.advanceTimersByTime(15000);
    });

    expect(apiRequest).toHaveBeenCalledTimes(2);
  });

  test('oznacavanje procitanog se odmah vidi', async () => {
    const { result } = await renderHook(() => useNotifications());
    await waitFor(() => expect(result.current.unreadCount).toBe(1));

    await act(async () => {
      await result.current.oznaciProcitano('n1');
    });

    expect(result.current.unreadCount).toBe(0);
    expect(result.current.notifications[0].readAt).toBeTruthy();
    expect(apiRequest).toHaveBeenCalledWith('/notifications/n1/read', { method: 'PATCH' });
  });

  test('oznacavanje svih prazni brojac', async () => {
    apiRequest.mockResolvedValue({
      notifications: [obavestenje(), obavestenje({ id: 'n2' })],
      unreadCount: 2,
    });
    const { result } = await renderHook(() => useNotifications());
    await waitFor(() => expect(result.current.unreadCount).toBe(2));

    await act(async () => {
      await result.current.oznaciSve();
    });

    expect(result.current.unreadCount).toBe(0);
    expect(result.current.notifications.every((n) => n.readAt)).toBe(true);
    expect(apiRequest).toHaveBeenCalledWith('/notifications/read-all', { method: 'POST' });
  });

  test('neuspelo oznacavanje vraca pravo stanje sa servera', async () => {
    const { result } = await renderHook(() => useNotifications());
    await waitFor(() => expect(result.current.unreadCount).toBe(1));

    apiRequest.mockRejectedValueOnce(new Error('puklo'));
    apiRequest.mockResolvedValue({ notifications: [obavestenje()], unreadCount: 1 });

    await act(async () => {
      await result.current.oznaciProcitano('n1');
    });

    await waitFor(() => expect(result.current.unreadCount).toBe(1));
  });

  // Prazna lista bi izgledala kao da obavestenja nema, sto nije isto.
  test('greska pri ucitavanju ne prazni spisak', async () => {
    const { result } = await renderHook(() => useNotifications());
    await waitFor(() => expect(result.current.notifications).toHaveLength(1));

    apiRequest.mockRejectedValue(new Error('Nema veze sa serverom.'));
    await act(async () => {
      await result.current.reload();
    });

    expect(result.current.notifications).toHaveLength(1);
  });
});
