import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import PravnoScreen from '../PravnoScreen';

const navigation = { setOptions: jest.fn() };

beforeEach(() => {
  navigation.setOptions.mockReset();
});

const prikazi = (dokument) =>
  render(<PravnoScreen route={{ params: { dokument } }} navigation={navigation} />);

describe('PravnoScreen', () => {
  test('prikazuje trazeni dokument na srpskom', async () => {
    await prikazi('uslovi');

    expect(screen.getByText('1. Ko pruža uslugu')).toBeTruthy();
    expect(navigation.setOptions).toHaveBeenCalledWith({ title: 'Uslovi korišćenja' });
  });

  test('prekidac menja jezik celog dokumenta', async () => {
    await prikazi('uslovi');

    await fireEvent.press(screen.getByText('English'));

    await waitFor(() => expect(screen.getByText('1. Who provides the service')).toBeTruthy());
    expect(navigation.setOptions).toHaveBeenLastCalledWith({ title: 'Terms of Service' });
  });

  test('bez parametra otvara politiku privatnosti', async () => {
    await render(<PravnoScreen route={{}} navigation={navigation} />);

    expect(navigation.setOptions).toHaveBeenCalledWith({ title: 'Politika privatnosti' });
  });

  // Alergije su podatak o zdravlju; ta tacka mora da postoji u oba jezika.
  test('politika sadrzi tacku o zdravstvenim podacima na oba jezika', async () => {
    await prikazi('privatnost');
    expect(screen.getByText('4. Podaci o zdravlju deteta')).toBeTruthy();

    await fireEvent.press(screen.getByText('English'));
    await waitFor(() => expect(screen.getByText('4. Child health data')).toBeTruthy());
  });

  test('uputstvo za brisanje naloga je u aplikaciji', async () => {
    await prikazi('brisanje-naloga');

    expect(screen.getByText('Kako se briše iz aplikacije')).toBeTruthy();
    expect(screen.getByText('Šta se briše')).toBeTruthy();
  });
});
