import { render, screen, waitFor } from '@testing-library/react-native';
import AppNavigator from '../AppNavigator';

let mockAuth = { user: null, loading: false };
jest.mock('../../context/AuthContext', () => ({ useAuth: () => mockAuth }));

let mockPodesavanja = {};
jest.mock('../../context/SettingsContext', () => ({
  useSettings: () => ({ settings: mockPodesavanja }),
  isOn: (v) => v === 'true',
}));

// Ekrani se zamenjuju natpisom - ovde se testira koji su dostupni, ne sta crtaju.
const lazniEkran = (ime) => {
  const { Text: T } = require('react-native');
  return function Lazni() {
    return <T>ekran:{ime}</T>;
  };
};

jest.mock('../../screens/LoginScreen', () => lazniEkran('Login'));
jest.mock('../../screens/RegisterScreen', () => lazniEkran('Register'));
jest.mock('../../screens/HomeScreen', () => lazniEkran('Home'));
jest.mock('../../screens/PackageScreen', () => lazniEkran('Package'));
jest.mock('../../screens/MenuScreen', () => lazniEkran('Menu'));
jest.mock('../../screens/QrScreen', () => lazniEkran('Qr'));
jest.mock('../../screens/ScheduleScreen', () => lazniEkran('Schedule'));
jest.mock('../../screens/GalleryScreen', () => lazniEkran('Gallery'));
jest.mock('../../screens/ChildrenListScreen', () => lazniEkran('Children'));
jest.mock('../../screens/AddChildScreen', () => lazniEkran('AddChild'));
jest.mock('../../screens/ChildDetailScreen', () => lazniEkran('ChildDetail'));

// Traka se zamenjuje spiskom tabova, da se vidi koji su ponudjeni.
jest.mock('../../components/TabBar', () => {
  const { Text: T } = require('react-native');
  return function LaznaTraka({ state }) {
    return <T testID="tabovi">{state.routes.map((r) => r.name).join(',')}</T>;
  };
});

const KORISNIK = { id: 'u1', firstName: 'Ana' };
const tabovi = () => screen.getByTestId('tabovi').props.children;

beforeEach(() => {
  mockAuth = { user: null, loading: false };
  mockPodesavanja = {};
});

describe('AppNavigator - ko sta vidi', () => {
  test('dok se proverava token stoji ucitavanje', async () => {
    mockAuth = { user: null, loading: true };
    await render(<AppNavigator />);

    expect(screen.queryByText(/ekran:/)).toBeNull();
  });

  test('neprijavljen korisnik ide na prijavu', async () => {
    await render(<AppNavigator />);
    await waitFor(() => expect(screen.getByText(/Login/)).toBeTruthy());
  });

  test('prijavljen korisnik ide na tabove', async () => {
    mockAuth = { user: KORISNIK, loading: false };
    await render(<AppNavigator />);

    await waitFor(() => expect(screen.getByTestId('tabovi')).toBeTruthy());
  });
});

describe('AppNavigator - tabovi koje admin moze da sakrije', () => {
  beforeEach(() => {
    mockAuth = { user: KORISNIK, loading: false };
  });

  test('podrazumevano su vidljivi samo obavezni tabovi', async () => {
    await render(<AppNavigator />);

    await waitFor(() => expect(tabovi()).toBe('Home,Qr,Package'));
  });

  test('ukljucen jelovnik se pojavljuje na svom mestu', async () => {
    mockPodesavanja = { mobile_tab_menu: 'true' };
    await render(<AppNavigator />);

    await waitFor(() => expect(tabovi()).toBe('Home,Menu,Qr,Package'));
  });

  test('ukljucen raspored se pojavljuje posle QR-a', async () => {
    mockPodesavanja = { mobile_tab_schedule: 'true' };
    await render(<AppNavigator />);

    await waitFor(() => expect(tabovi()).toBe('Home,Qr,Schedule,Package'));
  });

  test('sa oba ukljucena ima pet tabova', async () => {
    mockPodesavanja = { mobile_tab_menu: 'true', mobile_tab_schedule: 'true' };
    await render(<AppNavigator />);

    await waitFor(() => expect(tabovi()).toBe('Home,Menu,Qr,Schedule,Package'));
  });

  // Paket i QR su sustina aplikacije - ne mogu da se iskljuce.
  test('QR i paket ostaju i kada je sve ostalo iskljuceno', async () => {
    mockPodesavanja = { mobile_tab_menu: 'false', mobile_tab_schedule: 'false' };
    await render(<AppNavigator />);

    await waitFor(() => {
      expect(tabovi()).toContain('Qr');
      expect(tabovi()).toContain('Package');
    });
  });
});
