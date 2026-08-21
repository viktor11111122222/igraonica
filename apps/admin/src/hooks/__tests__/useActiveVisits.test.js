import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useActiveVisits, __resetActiveVisits } from '../useActiveVisits';
import { get } from '../../lib/api';

vi.mock('../../lib/api', () => ({ get: vi.fn() }));

const poseta = { id: 'v1', child: { firstName: 'Ana', qrCode: 'IGR-00000001' } };

beforeEach(() => {
  __resetActiveVisits();
  get.mockReset().mockResolvedValue({ visits: [poseta], count: 1 });
});

afterEach(() => {
  __resetActiveVisits();
  vi.useRealTimers();
});

describe('useActiveVisits', () => {
  test('dovlaci prisutne i broj', async () => {
    const { result } = renderHook(() => useActiveVisits());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.visits).toEqual([poseta]);
    expect(result.current.count).toBe(1);
  });

  // Ovo je bio kvar: bocna traka i ekran Prijave su anketirali istu rutu svaki
  // za sebe, pa su na Prijavama isla dva zahteva svakih 30 sekundi.
  test('dva mesta koja slusaju salju jedan zahtev', async () => {
    const prvi = renderHook(() => useActiveVisits());
    const drugi = renderHook(() => useActiveVisits());

    await waitFor(() => expect(prvi.result.current.loading).toBe(false));
    await waitFor(() => expect(drugi.result.current.count).toBe(1));

    expect(get).toHaveBeenCalledTimes(1);
  });

  test('novi podatak stigne do svih koji slusaju', async () => {
    const prvi = renderHook(() => useActiveVisits());
    const drugi = renderHook(() => useActiveVisits());
    await waitFor(() => expect(drugi.result.current.count).toBe(1));

    get.mockResolvedValue({ visits: [], count: 0 });
    await act(() => prvi.result.current.reload());

    expect(prvi.result.current.count).toBe(0);
    expect(drugi.result.current.count).toBe(0);
  });

  test('kada nema count sa servera, broji se iz liste', async () => {
    get.mockResolvedValue({ visits: [poseta, { id: 'v2' }] });
    const { result } = renderHook(() => useActiveVisits());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.count).toBe(2);
  });

  test('greska se javlja, a stari podaci ostaju na ekranu', async () => {
    const { result } = renderHook(() => useActiveVisits());
    await waitFor(() => expect(result.current.count).toBe(1));

    get.mockRejectedValue(new Error('Nema veze sa serverom.'));
    await act(() => result.current.reload());

    expect(result.current.error).toBe('Nema veze sa serverom.');
    expect(result.current.visits).toEqual([poseta]);
  });

  test('lista se sama osvezava dok je neko slusa', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useActiveVisits());
    await vi.waitFor(() => expect(get).toHaveBeenCalledTimes(1));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30000);
    });

    expect(get).toHaveBeenCalledTimes(2);
    expect(result.current.count).toBe(1);
  });

  // Kada se napusti i poslednji ekran koji slusa, tajmer mora da stane.
  test('posle poslednjeg odlaska nema vise zahteva', async () => {
    vi.useFakeTimers();
    const prvi = renderHook(() => useActiveVisits());
    const drugi = renderHook(() => useActiveVisits());
    await vi.waitFor(() => expect(get).toHaveBeenCalledTimes(1));

    prvi.unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30000);
    });
    expect(get).toHaveBeenCalledTimes(2);

    drugi.unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60000);
    });
    expect(get).toHaveBeenCalledTimes(2);
  });
});
