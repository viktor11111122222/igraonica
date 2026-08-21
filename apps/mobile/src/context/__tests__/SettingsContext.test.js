import { render, screen, waitFor, act } from '@testing-library/react-native';
import { Text } from 'react-native';
import { AppState } from 'react-native';
import { SettingsProvider, useSettings, isOn } from '../SettingsContext';
import { apiRequest } from '../../utils/api';

jest.mock('../../utils/api', () => ({ apiRequest: jest.fn() }));

function Ekran() {
  const { settings, loading } = useSettings();
  return (
    <>
      <Text testID="naziv">{settings.club_name}</Text>
      <Text testID="telefon">{settings.club_phone}</Text>
      <Text testID="ucitava">{String(loading)}</Text>
    </>
  );
}

const prikazi = () => render(<SettingsProvider><Ekran /></SettingsProvider>);
const vidi = (id) => screen.getByTestId(id).props.children;

beforeEach(() => {
  jest.clearAllMocks();
  jest.useRealTimers();
  apiRequest.mockResolvedValue({ settings: {} });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('SettingsContext', () => {
  test('dovlaci javna podesavanja bez prijave', async () => {
    apiRequest.mockResolvedValue({ settings: { club_name: 'Igraonica Cika Mika' } });
    await prikazi();

    await waitFor(() => expect(vidi('naziv')).toBe('Igraonica Cika Mika'));
    expect(apiRequest).toHaveBeenCalledWith('/settings/public');
  });

  test('kljucevi koje server ne posalje imaju osigurac', async () => {
    apiRequest.mockResolvedValue({ settings: { club_phone: '060111222' } });
    await prikazi();

    await waitFor(() => expect(vidi('telefon')).toBe('060111222'));
    expect(vidi('naziv')).toBe('Kids club');
  });

  // Lazno prazna aplikacija je gora od stare vrednosti.
  test('greska sa servera ne prazni podesavanja', async () => {
    apiRequest.mockRejectedValue(new Error('Nema veze sa serverom.'));
    await prikazi();

    await waitFor(() => expect(vidi('ucitava')).toBe('false'));
    expect(vidi('naziv')).toBe('Kids club');
  });

  test('sama se osvezava dok je aplikacija otvorena', async () => {
    jest.useFakeTimers();
    await prikazi();
    await waitFor(() => expect(apiRequest).toHaveBeenCalledTimes(1));

    await act(async () => {
      jest.advanceTimersByTime(15000);
    });

    expect(apiRequest).toHaveBeenCalledTimes(2);
  });

  // Admin promeni nesto dok roditelj drzi aplikaciju u pozadini.
  test('povratak iz pozadine odmah proverava', async () => {
    const slusaoci = [];
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_, fn) => {
      slusaoci.push(fn);
      return { remove: jest.fn() };
    });

    await prikazi();
    await waitFor(() => expect(apiRequest).toHaveBeenCalledTimes(1));

    await act(async () => {
      slusaoci.forEach((fn) => fn('active'));
    });

    expect(apiRequest).toHaveBeenCalledTimes(2);
    AppState.addEventListener.mockRestore();
  });

  test('odlazak u pozadinu ne proverava', async () => {
    const slusaoci = [];
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_, fn) => {
      slusaoci.push(fn);
      return { remove: jest.fn() };
    });

    await prikazi();
    await waitFor(() => expect(apiRequest).toHaveBeenCalledTimes(1));

    await act(async () => {
      slusaoci.forEach((fn) => fn('background'));
    });

    expect(apiRequest).toHaveBeenCalledTimes(1);
    AppState.addEventListener.mockRestore();
  });

  test('van provajdera daje osigurac umesto pada', async () => {
    await render(<Ekran />);
    expect(vidi('naziv')).toBe('Kids club');
    expect(vidi('ucitava')).toBe('false');
  });
});

// Vrednosti stizu kao tekst, jer su u bazi kolona tipa String.
describe('isOn', () => {
  test('samo tekst "true" znaci ukljuceno', () => {
    expect(isOn('true')).toBe(true);
    expect(isOn('false')).toBe(false);
    expect(isOn('')).toBe(false);
    expect(isOn(undefined)).toBe(false);
    expect(isOn(true)).toBe(false);
    expect(isOn('1')).toBe(false);
  });
});
