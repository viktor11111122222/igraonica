import { render, screen, fireEvent, act } from '@testing-library/react-native';
import { Alert } from 'react-native';
import RegisterScreen from '../RegisterScreen';

const mockRegister = jest.fn();
jest.mock('../../context/AuthContext', () => ({ useAuth: () => ({ register: mockRegister }) }));

const navigation = { navigate: jest.fn() };
// Pazi: u @testing-library/react-native v14 su render i renderHook asinhroni.
const prikazi = () => render(<RegisterScreen navigation={navigation} />);

async function popuni(polja) {
  for (const [natpis, vrednost] of Object.entries(polja)) {
    await act(async () => {
      fireEvent.changeText(screen.getByPlaceholderText(natpis), vrednost);
    });
  }
}

const ISPRAVNO = {
  Ime: 'Ana',
  Prezime: 'Petrovic',
  Email: 'ana@primer.rs',
  Lozinka: 'tajna123',
  'Ponovite lozinku': 'tajna123',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockRegister.mockResolvedValue(undefined);
  Alert.alert = jest.fn();
});

describe('RegisterScreen - jezik i polja', () => {
  test('sve je na srpskom', async () => {
    await prikazi();

    expect(screen.getByText('Otvorite nalog')).toBeTruthy();
    expect(screen.getByText('Otvori nalog')).toBeTruthy();
    expect(screen.getByText('Vec imate nalog? ')).toBeTruthy();
    expect(screen.getByText('Prijavite se')).toBeTruthy();
  });

  // Polje za ime je imalo natpis "Full Name", iako odmah ispod stoji prezime.
  test('ime i prezime su odvojena i tacno oznacena polja', async () => {
    await prikazi();

    expect(screen.getByPlaceholderText('Ime')).toBeTruthy();
    expect(screen.getByPlaceholderText('Prezime')).toBeTruthy();
    expect(screen.queryByPlaceholderText('Full Name')).toBeNull();
  });

  test('obe lozinke su sakrivene', async () => {
    await prikazi();

    expect(screen.getByPlaceholderText('Lozinka').props.secureTextEntry).toBe(true);
    expect(screen.getByPlaceholderText('Ponovite lozinku').props.secureTextEntry).toBe(true);
  });

  test('veza vodi na prijavu', async () => {
    await prikazi();

    fireEvent.press(screen.getByText('Prijavite se'));

    expect(navigation.navigate).toHaveBeenCalledWith('Login');
  });
});

describe('RegisterScreen - provera unosa', () => {
  test('prazna polja ne salju zahtev', async () => {
    await prikazi();

    await act(async () => {
      fireEvent.press(screen.getByText('Otvori nalog'));
    });

    expect(mockRegister).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith('Greska', 'Sva polja su obavezna.');
  });

  test('razlicite lozinke se odbijaju', async () => {
    await prikazi();
    await popuni({ ...ISPRAVNO, 'Ponovite lozinku': 'drugacije' });

    await act(async () => {
      fireEvent.press(screen.getByText('Otvori nalog'));
    });

    expect(mockRegister).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith('Greska', 'Lozinke se ne poklapaju.');
  });

  test('prekratka lozinka se odbija', async () => {
    await prikazi();
    await popuni({ ...ISPRAVNO, Lozinka: 'kratk', 'Ponovite lozinku': 'kratk' });

    await act(async () => {
      fireEvent.press(screen.getByText('Otvori nalog'));
    });

    expect(mockRegister).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith(
      'Greska',
      'Lozinka mora imati najmanje 6 karaktera.'
    );
  });
});

describe('RegisterScreen - slanje', () => {
  test('salje ocisceno ime i email malim slovima', async () => {
    await prikazi();
    await popuni({ ...ISPRAVNO, Ime: '  Ana ', Email: '  Ana@Primer.RS ' });

    await act(async () => {
      fireEvent.press(screen.getByText('Otvori nalog'));
    });

    expect(mockRegister).toHaveBeenCalledWith({
      firstName: 'Ana',
      lastName: 'Petrovic',
      email: 'ana@primer.rs',
      password: 'tajna123',
    });
  });

  // Ponovljena lozinka je samo provera, ne salje se serveru.
  test('potvrda lozinke ne ide na server', async () => {
    await prikazi();
    await popuni(ISPRAVNO);

    await act(async () => {
      fireEvent.press(screen.getByText('Otvori nalog'));
    });

    expect(mockRegister.mock.calls[0][0]).not.toHaveProperty('confirmPassword');
  });

  test('greska sa servera se pokazuje korisniku', async () => {
    mockRegister.mockRejectedValue(new Error('Email je vec zauzet.'));
    await prikazi();
    await popuni(ISPRAVNO);

    await act(async () => {
      fireEvent.press(screen.getByText('Otvori nalog'));
    });

    expect(Alert.alert).toHaveBeenCalledWith('Greska', 'Email je vec zauzet.');
  });
});
