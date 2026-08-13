import { AppState } from 'react-native';
import { renderHook, act } from '@testing-library/react-native';
import { useAutoRefresh, REFRESH_INTERVAL } from '../useAutoRefresh';

// Pazi: u @testing-library/react-native v14 su renderHook i render asinhroni,
// pa moraju da se cekaju. Bez await-a se telo hooka nikad ne izvrsi i test
// izgleda kao da hook ne radi.

// Bez navigatora useFocusEffect nema kontekst. Za fokusiran ekran ponasa se
// kao useEffect, pa je to ovde dovoljna zamena.
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (callback) => require('react').useEffect(callback, [callback]),
}));

let appStateHandler;
let removeSubscription;

beforeEach(() => {
  jest.useFakeTimers();
  appStateHandler = null;
  removeSubscription = jest.fn();

  jest.spyOn(AppState, 'addEventListener').mockImplementation((event, handler) => {
    if (event === 'change') appStateHandler = handler;
    return { remove: removeSubscription };
  });
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

const pomeriVreme = (ms) => act(async () => {
  jest.advanceTimersByTime(ms);
});

describe('useAutoRefresh', () => {
  test('ucitava odmah pri ulasku u ekran', async () => {
    const load = jest.fn();
    await renderHook(() => useAutoRefresh(load));

    expect(load).toHaveBeenCalledTimes(1);
  });

  test('ponavlja ucitavanje na svakih 15 sekundi', async () => {
    const load = jest.fn();
    await renderHook(() => useAutoRefresh(load));

    expect(load).toHaveBeenCalledTimes(1);

    await pomeriVreme(REFRESH_INTERVAL);
    expect(load).toHaveBeenCalledTimes(2);

    await pomeriVreme(REFRESH_INTERVAL * 2);
    expect(load).toHaveBeenCalledTimes(4);
  });

  test('podrazumevani interval je 15 sekundi', () => {
    expect(REFRESH_INTERVAL).toBe(15000);
  });

  test('postuje zadati interval', async () => {
    const load = jest.fn();
    await renderHook(() => useAutoRefresh(load, 5000));

    await pomeriVreme(5000);
    expect(load).toHaveBeenCalledTimes(2);
  });

  // Ovo je razlog zasto tajmer stoji unutar useFocusEffect: ekran koji se ne
  // gleda ne sme da kuca po serveru.
  test('prestaje da ucitava kada se ekran napusti', async () => {
    const load = jest.fn();
    const { unmount } = await renderHook(() => useAutoRefresh(load));

    expect(load).toHaveBeenCalledTimes(1);
    await unmount();

    await pomeriVreme(REFRESH_INTERVAL * 5);
    expect(load).toHaveBeenCalledTimes(1);
  });

  test('odjavljuje pretplatu na AppState pri napustanju', async () => {
    const { unmount } = await renderHook(() => useAutoRefresh(jest.fn()));

    expect(removeSubscription).not.toHaveBeenCalled();
    await unmount();
    expect(removeSubscription).toHaveBeenCalledTimes(1);
  });

  // Tajmeri u pozadini nisu pouzdani, pa je povratak iz pozadine zasebna tacka
  // osvezavanja - inace bi roditelj video podatke od pre sat vremena.
  test('ucitava kada se aplikacija vrati iz pozadine', async () => {
    const load = jest.fn();
    await renderHook(() => useAutoRefresh(load));
    load.mockClear();

    await act(async () => appStateHandler('active'));
    expect(load).toHaveBeenCalledTimes(1);
  });

  test('ne ucitava kada aplikacija odlazi u pozadinu', async () => {
    const load = jest.fn();
    await renderHook(() => useAutoRefresh(load));
    load.mockClear();

    await act(async () => appStateHandler('background'));
    await act(async () => appStateHandler('inactive'));
    expect(load).not.toHaveBeenCalled();
  });

  // Jelovnik se oslanja na ovo: promena izabranog dana mora odmah da povuce
  // njegovu nedelju, bez cekanja na sledeci tik.
  test('promena load funkcije odmah pokrece novo ucitavanje', async () => {
    const prvi = jest.fn();
    const drugi = jest.fn();

    const { rerender } = await renderHook(({ load }) => useAutoRefresh(load), {
      initialProps: { load: prvi },
    });

    expect(prvi).toHaveBeenCalledTimes(1);

    await rerender({ load: drugi });
    expect(drugi).toHaveBeenCalledTimes(1);

    // Stari tajmer je ocisen - dalje kuca samo novi.
    await pomeriVreme(REFRESH_INTERVAL);
    expect(prvi).toHaveBeenCalledTimes(1);
    expect(drugi).toHaveBeenCalledTimes(2);
  });
});
