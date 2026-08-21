import { render, screen, fireEvent, act } from '@testing-library/react-native';
import ChildrenListScreen from '../ChildrenListScreen';
import { apiRequest } from '../../utils/api';

jest.mock('../../utils/api', () => ({ apiRequest: jest.fn() }));
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (callback) => require('react').useEffect(callback, [callback]),
}));

const dete = {
  id: 'c1',
  firstName: 'Lena',
  lastName: 'Petrovic',
  dateOfBirth: '2020-05-10',
  qrCode: 'IGR-B4F46AB6',
  allergies: 'Kikiriki',
};

const navigation = { navigate: jest.fn() };
const prikazi = () => render(<ChildrenListScreen navigation={navigation} />);

beforeEach(() => {
  jest.clearAllMocks();
  jest.setSystemTime(new Date('2026-08-21T12:00:00'));
  apiRequest.mockResolvedValue({ children: [dete] });
});

describe('ChildrenListScreen', () => {
  test('prikazuje decu roditelja', async () => {
    await prikazi();

    expect(await screen.findByText('Lena Petrovic')).toBeTruthy();
    expect(apiRequest).toHaveBeenCalledWith('/children');
  });

  test('racuna uzrast iz datuma rodjenja', async () => {
    await prikazi();
    expect(await screen.findByText('6 godina')).toBeTruthy();
  });

  // Alergije su podatak koji osoblje mora da vidi pri prijavi.
  test('alergije se isticu', async () => {
    await prikazi();
    expect(await screen.findByText('Alergije: Kikiriki')).toBeTruthy();
  });

  test('dete bez alergija nema taj red', async () => {
    apiRequest.mockResolvedValue({ children: [{ ...dete, allergies: null }] });
    await prikazi();

    await screen.findByText('Lena Petrovic');
    expect(screen.queryByText(/Alergije:/)).toBeNull();
  });

  test('bez dece poziva da se doda prvo', async () => {
    apiRequest.mockResolvedValue({ children: [] });
    await prikazi();

    expect(await screen.findByText('Nemate dodatu decu')).toBeTruthy();
  });

  test('greska sa servera ostavlja praznu listu, ne rusi ekran', async () => {
    apiRequest.mockRejectedValue(new Error('Nema veze sa serverom.'));
    await prikazi();

    expect(await screen.findByText('Nemate dodatu decu')).toBeTruthy();
  });

  test('dodir na dete vodi na njegove detalje', async () => {
    await prikazi();
    const red = await screen.findByText('Lena Petrovic');

    await act(async () => {
      fireEvent.press(red);
    });

    expect(navigation.navigate).toHaveBeenCalledWith('ChildDetail', { child: dete });
  });

  test('dugme vodi na dodavanje deteta', async () => {
    await prikazi();
    const dugme = await screen.findByText('+ Dodaj dete');

    await act(async () => {
      fireEvent.press(dugme);
    });

    expect(navigation.navigate).toHaveBeenCalledWith('AddChild');
  });
});
