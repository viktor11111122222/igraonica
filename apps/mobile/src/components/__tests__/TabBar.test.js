import { render, screen, fireEvent, act } from '@testing-library/react-native';
import { Platform, StyleSheet } from 'react-native';
import TabBar from '../TabBar';

function napravi(imena, index = 0) {
  const routes = imena.map((name) => ({ key: `k-${name}`, name }));
  const descriptors = Object.fromEntries(
    routes.map((r) => [
      r.key,
      { options: { title: r.name === 'Qr' ? 'QR' : r.name, tabBarIconName: 'home' } },
    ])
  );
  const navigation = {
    emit: jest.fn(() => ({ defaultPrevented: false })),
    navigate: jest.fn(),
  };
  return { state: { routes, index }, descriptors, navigation };
}

const prikazi = (props, bottom = 34) => {
  global.__sigurnaZona = { top: 59, right: 0, bottom, left: 0 };
  return render(<TabBar {...props} />);
};

describe('TabBar', () => {
  test('prikazuje sve tabove osim QR-a kao dugmad sa natpisom', async () => {
    await prikazi(napravi(['Home', 'Menu', 'Qr', 'Schedule', 'Gallery']));

    expect(screen.getByLabelText('Home')).toBeTruthy();
    expect(screen.getByLabelText('Menu')).toBeTruthy();
    expect(screen.getByLabelText('Schedule')).toBeTruthy();
    expect(screen.getByLabelText('Gallery')).toBeTruthy();
  });

  test('dodir na tab vodi na taj ekran', async () => {
    const props = napravi(['Home', 'Menu', 'Qr', 'Schedule', 'Gallery']);
    await prikazi(props);

    await act(async () => {
      fireEvent.press(screen.getByLabelText('Schedule'));
    });

    expect(props.navigation.navigate).toHaveBeenCalledWith('Schedule');
  });

  // Dodir na vec otvoren tab ne treba da pravi novu navigaciju.
  test('dodir na tekuci tab ne navigira ponovo', async () => {
    const props = napravi(['Home', 'Menu', 'Qr', 'Schedule', 'Gallery'], 0);
    await prikazi(props);

    await act(async () => {
      fireEvent.press(screen.getByLabelText('Home'));
    });

    expect(props.navigation.navigate).not.toHaveBeenCalled();
  });

  // Navigator moze da otkaze prelazak (npr. scroll-to-top na isti tab).
  test('otkazan dogadjaj zaustavlja navigaciju', async () => {
    const props = napravi(['Home', 'Menu', 'Qr', 'Schedule', 'Gallery'], 0);
    props.navigation.emit = jest.fn(() => ({ defaultPrevented: true }));
    await prikazi(props);

    await act(async () => {
      fireEvent.press(screen.getByLabelText('Menu'));
    });

    expect(props.navigation.navigate).not.toHaveBeenCalled();
  });

  test('tekuci tab je oznacen za citace ekrana', async () => {
    await prikazi(napravi(['Home', 'Menu', 'Qr', 'Schedule', 'Gallery'], 1));

    expect(screen.getByLabelText('Menu').props.accessibilityState).toEqual({ selected: true });
    expect(screen.getByLabelText('Home').props.accessibilityState).toEqual({});
  });

  // QR dugme mora da ostane na sredini i kada admin sakrije neki tab, pa ih
  // ostane neparan broj sa strane.
  test('QR ostaje na sredini i sa neparnim brojem ostalih tabova', async () => {
    const props = napravi(['Home', 'Menu', 'Qr', 'Schedule']);
    const { toJSON } = await prikazi(props);
    expect(toJSON()).not.toBeNull();
    expect(screen.getByLabelText('Home')).toBeTruthy();
    expect(screen.getByLabelText('Schedule')).toBeTruthy();
  });

  test('radi i kada su svi tabovi osim QR-a sakriveni', async () => {
    const { toJSON } = await prikazi(napravi(['Qr']));
    expect(toJSON()).not.toBeNull();
  });

  test('QR dugme vodi na svoj ekran', async () => {
    const props = napravi(['Home', 'Menu', 'Qr', 'Schedule', 'Gallery'], 0);
    await prikazi(props);

    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'QR kod' }));
    });

    expect(props.navigation.navigate).toHaveBeenCalledWith('Qr');
  });
});

// Na Androidu sistemska navigacija zauzima dno ekrana: gestovna traka 24dp, a
// tri dugmeta 48dp. Sa fiksnih 8 je donji deo trake zavrsavao ispod njih.
describe('TabBar - donja sigurna zona', () => {
  const donjiVazduh = () =>
    StyleSheet.flatten(screen.getByLabelText('Home').parent.parent.props.style).paddingBottom;

  const staraPlatforma = Platform.OS;
  afterEach(() => {
    Platform.OS = staraPlatforma;
  });

  test('Android uzima zonu sistemske navigacije', async () => {
    Platform.OS = 'android';
    await prikazi(napravi(['Home', 'Qr', 'Package']), 48);
    expect(donjiVazduh()).toBe(48);
  });

  test('bez sistemske navigacije ostaje mali vazduh', async () => {
    Platform.OS = 'android';
    await prikazi(napravi(['Home', 'Qr', 'Package']), 0);
    expect(donjiVazduh()).toBe(8);
  });

  test('iOS zadrzava meru po kojoj je traka crtana', async () => {
    Platform.OS = 'ios';
    await prikazi(napravi(['Home', 'Qr', 'Package']), 34);
    expect(donjiVazduh()).toBe(24);
  });
});
