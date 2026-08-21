import { render, screen, fireEvent, act, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import ChildDetailScreen from '../ChildDetailScreen';
import { apiRequest } from '../../utils/api';

jest.mock('../../utils/api', () => ({ apiRequest: jest.fn() }));
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (callback) => require('react').useEffect(callback, [callback]),
}));
jest.mock('react-native-qrcode-svg', () => {
  const { Text } = require('react-native');
  return function LazniQRCode({ value }) {
    return <Text testID="qr">{value}</Text>;
  };
});

const dete = {
  id: 'c1',
  firstName: 'Lena',
  lastName: 'Petrovic',
  dateOfBirth: '2020-05-10',
  qrCode: 'IGR-B4F46AB6',
  allergies: 'Kikiriki',
  notes: null,
};

const poseta = {
  id: 'v1',
  childId: 'c1',
  status: 'CHECKED_OUT',
  checkedInAt: '2026-08-20T09:00:00.000Z',
  checkedOutAt: '2026-08-20T11:00:00.000Z',
  child: { id: 'c1' },
};

const navigation = { goBack: jest.fn() };
const route = { params: { child: dete } };
const prikazi = () => render(<ChildDetailScreen navigation={navigation} route={route} />);

function odgovori({ child = dete, visits = [poseta] } = {}) {
  apiRequest.mockImplementation((putanja) => {
    if (String(putanja).startsWith('/children/')) return Promise.resolve({ child });
    if (String(putanja).startsWith('/visits/my')) return Promise.resolve({ visits });
    return Promise.resolve({});
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  odgovori();
  Alert.alert = jest.fn();
});

describe('ChildDetailScreen', () => {
  // Ekran se otvara sa podatkom iz liste, pa se odmah vidi i pre nego sto
  // osvezavanje sa servera stigne.
  test('odmah prikazuje dete iz navigacije', async () => {
    await prikazi();
    expect(screen.getByText('Lena Petrovic')).toBeTruthy();
  });

  test('QR kod nosi tacno kod deteta', async () => {
    await prikazi();

    // Kod stoji i u samom QR-u i ispisan ispod njega, da moze i rucno da se unese.
    await waitFor(() => expect(screen.getByTestId('qr').props.children).toBe('IGR-B4F46AB6'));
    expect(screen.getAllByText('IGR-B4F46AB6')).toHaveLength(2);
  });

  test('osvezava dete i posete sa servera', async () => {
    await prikazi();

    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith('/children/c1'));
    expect(apiRequest).toHaveBeenCalledWith('/visits/my?limit=5');
  });

  test('prikazuje poslednje posete', async () => {
    await prikazi();
    expect(await screen.findByText('Poslednje posete')).toBeTruthy();
  });

  test('greska sa servera ne rusi ekran', async () => {
    apiRequest.mockRejectedValue(new Error('Nema veze sa serverom.'));
    await prikazi();

    await waitFor(() => expect(apiRequest).toHaveBeenCalled());
    expect(screen.getByText('Lena Petrovic')).toBeTruthy();
  });
});

describe('ChildDetailScreen - uklanjanje', () => {
  test('trazi potvrdu pre brisanja', async () => {
    await prikazi();

    await act(async () => {
      fireEvent.press(screen.getByText('Ukloni dete'));
    });

    const [naslov, poruka] = Alert.alert.mock.calls.at(-1);
    expect(naslov).toBe('Potvrda');
    expect(poruka).toContain('Lena');
    expect(apiRequest).not.toHaveBeenCalledWith('/children/c1', { method: 'DELETE' });
  });

  test('potvrda brise dete i vraca nazad', async () => {
    await prikazi();
    await act(async () => {
      fireEvent.press(screen.getByText('Ukloni dete'));
    });

    const dugmad = Alert.alert.mock.calls.at(-1)[2];
    const potvrdi = dugmad.find((d) => d.text === 'Da, ukloni');
    await act(async () => {
      await potvrdi.onPress();
    });

    expect(apiRequest).toHaveBeenCalledWith('/children/c1', { method: 'DELETE' });
    expect(navigation.goBack).toHaveBeenCalled();
  });

  test('neuspelo brisanje javlja gresku i ostavlja ekran', async () => {
    await prikazi();
    await act(async () => {
      fireEvent.press(screen.getByText('Ukloni dete'));
    });
    apiRequest.mockRejectedValue(new Error('Dete ima otvorenu posetu.'));

    const potvrdi = Alert.alert.mock.calls.at(-1)[2].find((d) => d.text === 'Da, ukloni');
    await act(async () => {
      await potvrdi.onPress();
    });

    expect(Alert.alert).toHaveBeenLastCalledWith('Greska', 'Dete ima otvorenu posetu.');
    expect(navigation.goBack).not.toHaveBeenCalled();
  });
});
