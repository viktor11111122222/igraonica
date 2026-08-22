import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useNotifications, __resetNotifications } from '../useNotifications';
import { get, patch, post } from '../../lib/api';

vi.mock('../../lib/api', () => ({ get: vi.fn(), patch: vi.fn(), post: vi.fn() }));

const obavestenje = (over = {}) => ({
  id: 'n1',
  type: 'CHILD_CHECKED_IN',
  title: 'Prijava',
  body: 'Lena je prijavljena u 15:22.',
  readAt: null,
  createdAt: '2026-08-22T15:22:00.000Z',
  ...over,
});

beforeEach(() => {
  __resetNotifications();
  get.mockReset().mockResolvedValue({ notifications: [obavestenje()], unreadCount: 1 });
  patch.mockReset().mockResolvedValue({});
  post.mockReset().mockResolvedValue({});
});

afterEach(() => {
  __resetNotifications();
  vi.useRealTimers();
});

describe('useNotifications', () => {
  test('dovlaci obavestenja i broj neprocitanih', async () => {
    const { result } = renderHook(() => useNotifications());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.notifications).toHaveLength(1);
    expect(result.current.unreadCount).toBe(1);
  });

  // Zvono stoji u zaglavlju svake stranice - bez deljenja bi svako mesto slalo
  // svoj zahtev.
  test('dva mesta koja slusaju salju jedan zahtev', async () => {
    const prvi = renderHook(() => useNotifications());
    const drugi = renderHook(() => useNotifications());

    await waitFor(() => expect(prvi.result.current.loading).toBe(false));
    await waitFor(() => expect(drugi.result.current.unreadCount).toBe(1));

    expect(get).toHaveBeenCalledTimes(1);
  });

  test('sam se osvezava dok je neko slusa', async () => {
    vi.useFakeTimers();
    renderHook(() => useNotifications());
    await vi.waitFor(() => expect(get).toHaveBeenCalledTimes(1));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30000);
    });

    expect(get).toHaveBeenCalledTimes(2);
  });

  test('posle poslednjeg odlaska nema vise zahteva', async () => {
    vi.useFakeTimers();
    const { unmount } = renderHook(() => useNotifications());
    await vi.waitFor(() => expect(get).toHaveBeenCalledTimes(1));

    unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60000);
    });

    expect(get).toHaveBeenCalledTimes(1);
  });

  // Klik mora odmah da se vidi; cekanje odgovora bi izgledalo kao da dugme ne
  // radi.
  test('oznacavanje procitanog se odmah vidi', async () => {
    const { result } = renderHook(() => useNotifications());
    await waitFor(() => expect(result.current.unreadCount).toBe(1));

    await act(() => result.current.oznaciProcitano('n1'));

    expect(result.current.unreadCount).toBe(0);
    expect(result.current.notifications[0].readAt).toBeTruthy();
    expect(patch).toHaveBeenCalledWith('/notifications/n1/read');
  });

  test('vec procitano se ne salje ponovo', async () => {
    get.mockResolvedValue({ notifications: [obavestenje({ readAt: '2026-08-22T16:00:00.000Z' })], unreadCount: 0 });
    const { result } = renderHook(() => useNotifications());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(() => result.current.oznaciProcitano('n1'));

    expect(patch).not.toHaveBeenCalled();
  });

  test('neuspelo oznacavanje vraca pravo stanje sa servera', async () => {
    patch.mockRejectedValue(new Error('puklo'));
    const { result } = renderHook(() => useNotifications());
    await waitFor(() => expect(result.current.unreadCount).toBe(1));
    get.mockClear();

    await act(() => result.current.oznaciProcitano('n1'));

    await waitFor(() => expect(get).toHaveBeenCalled());
  });

  test('oznacavanje svih prazni brojac', async () => {
    get.mockResolvedValue({
      notifications: [obavestenje(), obavestenje({ id: 'n2' })],
      unreadCount: 2,
    });
    const { result } = renderHook(() => useNotifications());
    await waitFor(() => expect(result.current.unreadCount).toBe(2));

    await act(() => result.current.oznaciSve());

    expect(result.current.unreadCount).toBe(0);
    expect(result.current.notifications.every((n) => n.readAt)).toBe(true);
    expect(post).toHaveBeenCalledWith('/notifications/read-all');
  });

  test('bez neprocitanih se ne salje zahtev', async () => {
    get.mockResolvedValue({ notifications: [], unreadCount: 0 });
    const { result } = renderHook(() => useNotifications());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(() => result.current.oznaciSve());

    expect(post).not.toHaveBeenCalled();
  });

  test('greska se javlja, a stari spisak ostaje', async () => {
    const { result } = renderHook(() => useNotifications());
    await waitFor(() => expect(result.current.notifications).toHaveLength(1));

    get.mockRejectedValue(new Error('Nema veze sa serverom.'));
    await act(() => result.current.reload());

    expect(result.current.error).toBe('Nema veze sa serverom.');
    expect(result.current.notifications).toHaveLength(1);
  });
});
