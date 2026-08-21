import { renderHook, act, waitFor } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { useToday, useDaySelection } from '../useDay';

// Pazi: u @testing-library/react-native v14 su renderHook i render asinhroni.
// useFocusEffect se u testu ponasa kao obican useEffect.
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (callback) => require('react').useEffect(callback, [callback]),
}));

function postaviVreme(iso) {
  jest.setSystemTime(new Date(iso));
}

beforeEach(() => {
  jest.useFakeTimers();
  postaviVreme('2026-08-21T12:00:00');
});

afterEach(() => {
  // Spy na AppState curi u naredni test ako ga test ne stigne da vrati.
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe('useToday', () => {
  test('daje danasnji datum u lokalnoj zoni', async () => {
    const { result } = await renderHook(() => useToday());
    expect(result.current).toBe('2026-08-21');
  });

  // Aplikacija otvorena preko ponoci je i dalje pokazivala jucerasnji dan.
  test('sam prelazi u novi dan u ponoc', async () => {
    const { result } = await renderHook(() => useToday());
    expect(result.current).toBe('2026-08-21');

    await act(async () => {
      // Sekunda posle ponoci, kako hook i planira.
      jest.advanceTimersByTime(12 * 3600 * 1000 + 1000);
    });

    expect(result.current).toBe('2026-08-22');
  });

  // Tajmeri u pozadini nisu pouzdani, pa je povratak drugi okidac.
  test('povratak iz pozadine osvezava datum', async () => {
    const slusaoci = [];
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_, fn) => {
      slusaoci.push(fn);
      return { remove: jest.fn() };
    });
    const { result } = await renderHook(() => useToday());

    postaviVreme('2026-08-22T09:00:00');
    await act(async () => {
      slusaoci.forEach((fn) => fn('active'));
    });

    expect(result.current).toBe('2026-08-22');
  });

  test('odlazak u pozadinu ne dira datum', async () => {
    const slusaoci = [];
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_, fn) => {
      slusaoci.push(fn);
      return { remove: jest.fn() };
    });
    const { result } = await renderHook(() => useToday());

    postaviVreme('2026-08-22T09:00:00');
    await act(async () => {
      slusaoci.forEach((fn) => fn('background'));
    });

    expect(result.current).toBe('2026-08-21');
  });
});

describe('useDaySelection', () => {
  test('pocinje na danasnjem danu', async () => {
    const { result } = await renderHook(() => useDaySelection());
    expect(result.current.today).toBe('2026-08-21');
    expect(result.current.selected).toBe('2026-08-21');
  });

  test('rucni izbor menja samo selekciju', async () => {
    const { result } = await renderHook(() => useDaySelection());

    await act(async () => result.current.setSelected('2026-08-24'));

    expect(result.current.selected).toBe('2026-08-24');
    expect(result.current.today).toBe('2026-08-21');
  });

  // Ko je ostao na "danas", prelazi u novi dan zajedno sa aplikacijom.
  test('selekcija na danasnjem danu prati prelazak u novi dan', async () => {
    const { result } = await renderHook(() => useDaySelection());

    await act(async () => {
      jest.advanceTimersByTime(12 * 3600 * 1000 + 1000);
    });

    expect(result.current.today).toBe('2026-08-22');
    expect(result.current.selected).toBe('2026-08-22');
  });

  // Ko je rucno izabrao drugi datum, taj izbor se ne dira.
  test('rucno izabran datum prezivljava prelazak u novi dan', async () => {
    const { result } = await renderHook(() => useDaySelection());
    await act(async () => result.current.setSelected('2026-08-24'));

    await act(async () => {
      jest.advanceTimersByTime(12 * 3600 * 1000 + 1000);
    });

    expect(result.current.today).toBe('2026-08-22');
    expect(result.current.selected).toBe('2026-08-24');
  });
});
