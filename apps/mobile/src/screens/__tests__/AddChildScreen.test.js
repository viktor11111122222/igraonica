import { render, screen, fireEvent, act, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import AddChildScreen from '../AddChildScreen';
import { apiRequest } from '../../utils/api';

jest.mock('../../utils/api', () => ({ apiRequest: jest.fn() }));

// Pravi birac datuma ima tri kolone i sopstvenu logiku; ovde je dovoljno dugme
// koje javi datum, jer se testira ekran a ne birac.
jest.mock('../../components/BirthDatePicker', () => {
  const { Text, Pressable } = require('react-native');
  return function LazniBirac({ onChange }) {
    return (
      <Pressable testID="izaberi-datum" onPress={() => onChange('2020-05-10')}>
        <Text>Izaberi datum</Text>
      </Pressable>
    );
  };
});

const navigation = { goBack: jest.fn() };
const prikazi = () => render(<AddChildScreen navigation={navigation} />);

async function upisi(placeholder, vrednost) {
  await act(async () => {
    fireEvent.changeText(screen.getByPlaceholderText(placeholder), vrednost);
  });
}

async function pritisni(tekst) {
  await act(async () => {
    fireEvent.press(screen.getByText(tekst));
  });
}

async function popuniObavezno() {
  await upisi('Ime deteta', 'Lena');
  await upisi('Prezime deteta', 'Petrovic');
  await act(async () => {
    fireEvent.press(screen.getByTestId('izaberi-datum'));
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  apiRequest.mockResolvedValue({});
  Alert.alert = jest.fn();
});

describe('AddChildScreen - provera unosa', () => {
  test('bez imena i prezimena se ne salje', async () => {
    await prikazi();

    await pritisni('Dodaj dete');

    expect(apiRequest).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith('Nedostaju podaci', 'Ime i prezime su obavezni.');
  });

  test('bez datuma rodjenja se ne salje', async () => {
    await prikazi();
    await upisi('Ime deteta', 'Lena');
    await upisi('Prezime deteta', 'Petrovic');

    await pritisni('Dodaj dete');

    expect(apiRequest).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith('Nedostaju podaci', 'Izaberite datum rodjenja.');
  });
});

describe('AddChildScreen - alergije', () => {
  test('nudi ceste alergije da roditelj ne mora da kuca', async () => {
    await prikazi();

    expect(screen.getByText('Kikiriki')).toBeTruthy();
    expect(screen.getByText('Gluten')).toBeTruthy();
  });

  test('izabrani cipovi se spajaju u jedan tekst', async () => {
    await prikazi();
    await popuniObavezno();
    await pritisni('Kikiriki');
    await pritisni('Mleko');

    await pritisni('Dodaj dete');

    await waitFor(() =>
      expect(apiRequest).toHaveBeenCalledWith(
        '/children',
        expect.objectContaining({ body: expect.objectContaining({ allergies: 'Kikiriki, Mleko' }) })
      )
    );
  });

  test('ponovni dodir sklanja alergiju', async () => {
    await prikazi();
    await popuniObavezno();
    await pritisni('Kikiriki');
    await pritisni('Kikiriki');

    await pritisni('Dodaj dete');

    await waitFor(() =>
      expect(apiRequest).toHaveBeenCalledWith(
        '/children',
        expect.objectContaining({ body: expect.objectContaining({ allergies: undefined }) })
      )
    );
  });

  test('slobodan unos se dodaje uz cipove', async () => {
    await prikazi();
    await popuniObavezno();
    await pritisni('Gluten');
    await upisi('Nesto drugo? Upisite ovde', 'Jagode');

    await pritisni('Dodaj dete');

    await waitFor(() =>
      expect(apiRequest).toHaveBeenCalledWith(
        '/children',
        expect.objectContaining({ body: expect.objectContaining({ allergies: 'Gluten, Jagode' }) })
      )
    );
  });
});

describe('AddChildScreen - slanje', () => {
  test('salje ocisceno ime i izabrani datum', async () => {
    await prikazi();
    await upisi('Ime deteta', '  Lena ');
    await upisi('Prezime deteta', ' Petrovic ');
    await act(async () => {
      fireEvent.press(screen.getByTestId('izaberi-datum'));
    });

    await pritisni('Dodaj dete');

    await waitFor(() =>
      expect(apiRequest).toHaveBeenCalledWith('/children', {
        method: 'POST',
        body: expect.objectContaining({
          firstName: 'Lena',
          lastName: 'Petrovic',
          dateOfBirth: '2020-05-10',
        }),
      })
    );
  });

  test('uspeh javlja da je QR kod spreman i vraca nazad', async () => {
    await prikazi();
    await popuniObavezno();

    await pritisni('Dodaj dete');

    await waitFor(() => expect(Alert.alert).toHaveBeenCalled());
    const [naslov, poruka, dugmad] = Alert.alert.mock.calls.at(-1);
    expect(naslov).toBe('Gotovo');
    expect(poruka).toContain('QR kod je spreman');

    dugmad[0].onPress();
    expect(navigation.goBack).toHaveBeenCalled();
  });

  test('greska sa servera se pokazuje i ekran ostaje otvoren', async () => {
    apiRequest.mockRejectedValue(new Error('Dete sa tim imenom vec postoji.'));
    await prikazi();
    await popuniObavezno();

    await pritisni('Dodaj dete');

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith('Greska', 'Dete sa tim imenom vec postoji.')
    );
    expect(navigation.goBack).not.toHaveBeenCalled();
  });
});
