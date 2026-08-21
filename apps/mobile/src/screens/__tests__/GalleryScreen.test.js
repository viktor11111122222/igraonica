import { render, screen, fireEvent, act } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import GalleryScreen from '../GalleryScreen';
import { photos } from '../../data/gallery';

const metrika = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const prikazi = (params = {}) =>
  render(
    <SafeAreaProvider initialMetrics={metrika}>
      <GalleryScreen route={{ params }} />
    </SafeAreaProvider>
  );

describe('GalleryScreen', () => {
  test('prikazuje sve fotografije iz galerije', async () => {
    await prikazi();
    expect(screen.getByText(`${photos.length} fotografija`)).toBeTruthy();
  });

  test('prva fotografija je istaknuta kao naslovna', async () => {
    await prikazi();
    expect(screen.getByLabelText(photos[0].title)).toBeTruthy();
  });

  test('ostale fotografije stoje u mrezi', async () => {
    await prikazi();
    for (const foto of photos.slice(1)) {
      expect(screen.getByLabelText(foto.title)).toBeTruthy();
    }
  });

  // Pregled preko celog ekrana se otvara tek na dodir.
  test('pregled je zatvoren dok se ne dodirne fotografija', async () => {
    await prikazi();
    expect(screen.queryByLabelText('Zatvori')).toBeNull();
  });

  test('dodir na naslovnu otvara pregled na njoj', async () => {
    await prikazi();

    await act(async () => {
      fireEvent.press(screen.getByLabelText(photos[0].title));
    });

    expect(screen.getByLabelText('Zatvori')).toBeTruthy();
    expect(screen.getByText(photos[0].caption)).toBeTruthy();
  });

  test('pregled se zatvara dugmetom', async () => {
    await prikazi();
    await act(async () => {
      fireEvent.press(screen.getByLabelText(photos[1].title));
    });

    await act(async () => {
      fireEvent.press(screen.getByLabelText('Zatvori'));
    });

    expect(screen.queryByLabelText('Zatvori')).toBeNull();
  });
});
