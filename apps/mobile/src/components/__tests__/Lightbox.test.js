import { render, screen, fireEvent, act } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Lightbox from '../Lightbox';

// Pregled koristi sigurnu zonu (zarez, donja crta), pa mu treba provajder -
// u aplikaciji ga daje koren, ovde test.
const metrika = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };

const prikazi = (startIndex) =>
  render(
    <SafeAreaProvider initialMetrics={metrika}>
      <Lightbox photos={fotografije} startIndex={startIndex} onClose={onClose} />
    </SafeAreaProvider>
  );

const fotografije = [
  { id: 'a', full: 1, thumb: 11, title: 'Igra sa kockama', caption: 'U velikoj sali' },
  { id: 'b', full: 2, thumb: 12, title: 'Citanje', caption: 'Popodnevna prica' },
];

const onClose = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Lightbox', () => {
  // `startIndex === null` je zatvoreno stanje - modal se ne montira.
  test('zatvoren dok nema izabrane fotografije', async () => {
    await prikazi(null);
    expect(screen.queryByText('Igra sa kockama')).toBeNull();
  });

  test('otvara se na izabranoj fotografiji', async () => {
    await prikazi(1);

    expect(screen.getByText('Citanje')).toBeTruthy();
    expect(screen.getByText('Popodnevna prica')).toBeTruthy();
  });

  test('prva fotografija se otvara kada je izabrana', async () => {
    await prikazi(0);
    expect(screen.getByText('Igra sa kockama')).toBeTruthy();
  });

  test('dugme zatvara pregled', async () => {
    await prikazi(0);

    await act(async () => {
      fireEvent.press(screen.getByLabelText('Zatvori'));
    });

    expect(onClose).toHaveBeenCalled();
  });
});
