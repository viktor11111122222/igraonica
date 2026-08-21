import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Alert } from 'react-native';
import LoginScreen from '../LoginScreen';

const mockLogin = jest.fn();
jest.mock('../../context/AuthContext', () => ({ useAuth: () => ({ login: mockLogin }) }));

let mockPodesavanja = {};
jest.mock('../../context/SettingsContext', () => ({
  useSettings: () => ({ settings: mockPodesavanja }),
}));

const navigation = { navigate: jest.fn() };
// `render` je u ovoj verziji RNTL-a asinhron - bez await-a `screen` ostaje
// nevezan i svaki upit javi da render nije ni pozvan.
const prikazi = () => render(<LoginScreen navigation={navigation} />);

beforeEach(() => {
  jest.clearAllMocks();
  mockPodesavanja = {};
  mockLogin.mockResolvedValue(undefined);
  Alert.alert = jest.fn();
});

describe('LoginScreen - jezik i sadrzaj', () => {
  // Ceo ostatak aplikacije je na srpskom; ovaj ekran je bio na engleskom.
  test('sve je na srpskom', async () => {
    await prikazi();

    expect(screen.getByPlaceholderText('Email')).toBeTruthy();
    expect(screen.getByPlaceholderText('Lozinka')).toBeTruthy();
    expect(screen.getByText('Prijavi se')).toBeTruthy();
    expect(screen.getByText('Nemate nalog? ')).toBeTruthy();
    expect(screen.getByText('Registrujte se')).toBeTruthy();
  });

  // Ovo je bio kvar: na ekranu za prijavu je pisalo "Already have an account?
  // Login", a link je vodio na registraciju.
  test('nema natpisa koji obecava prijavu a vodi na registraciju', async () => {
    await prikazi();

    expect(screen.queryByText('Login')).toBeNull();
    expect(screen.queryByText('Create Account')).toBeNull();
  });

  test('ka registraciji vodi tacno jedan izlaz', async () => {
    await prikazi();

    fireEvent.press(screen.getByText('Registrujte se'));

    expect(navigation.navigate).toHaveBeenCalledTimes(1);
    expect(navigation.navigate).toHaveBeenCalledWith('Register');
  });

  test('logo nosi naziv kluba za citace ekrana', async () => {
    mockPodesavanja = { club_name: '  Igraonica Cika Mika  ' };
    await prikazi();

    expect(screen.getByLabelText('Igraonica Cika Mika')).toBeTruthy();
  });

  test('bez podesenog naziva ostaje podrazumevani', async () => {
    await prikazi();
    expect(screen.getByLabelText('Kids club')).toBeTruthy();
  });
});

describe('LoginScreen - prijava', () => {
  test('salje email malim slovima i bez razmaka', async () => {
    await prikazi();

    await act(async () => {

      fireEvent.changeText(screen.getByPlaceholderText('Email'), '  Ana@Primer.RS ');

    });
    await act(async () => {
      fireEvent.changeText(screen.getByPlaceholderText('Lozinka'), 'tajna123');
    });
    await act(async () => {
      fireEvent.press(screen.getByText('Prijavi se'));
    });

    expect(mockLogin).toHaveBeenCalledWith('ana@primer.rs', 'tajna123');
  });

  test('prazna polja ne salju zahtev', async () => {
    await prikazi();

    await act(async () => {
      fireEvent.press(screen.getByText('Prijavi se'));
    });

    expect(mockLogin).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith('Greska', 'Unesite email i lozinku.');
  });

  test('sama lozinka bez email-a ne prolazi', async () => {
    await prikazi();
    await act(async () => {
      fireEvent.changeText(screen.getByPlaceholderText('Lozinka'), 'tajna123');
    });

    await act(async () => {
      fireEvent.press(screen.getByText('Prijavi se'));
    });

    expect(mockLogin).not.toHaveBeenCalled();
  });

  test('greska sa servera se pokazuje korisniku', async () => {
    mockLogin.mockRejectedValue(new Error('Pogresan email ili lozinka.'));
    await prikazi();
    await act(async () => {
      fireEvent.changeText(screen.getByPlaceholderText('Email'), 'ana@primer.rs');
    });
    await act(async () => {
      fireEvent.changeText(screen.getByPlaceholderText('Lozinka'), 'lose');
    });

    await act(async () => {
      fireEvent.press(screen.getByText('Prijavi se'));
    });

    expect(Alert.alert).toHaveBeenCalledWith('Greska', 'Pogresan email ili lozinka.');
  });

  test('lozinka se ne vidi na ekranu', async () => {
    await prikazi();
    expect(screen.getByPlaceholderText('Lozinka').props.secureTextEntry).toBe(true);
  });

  test('email polje ne diže prvo slovo i ne ispravlja tekst', async () => {
    await prikazi();
    const polje = screen.getByPlaceholderText('Email');
    expect(polje.props.autoCapitalize).toBe('none');
    expect(polje.props.autoCorrect).toBe(false);
    expect(polje.props.keyboardType).toBe('email-address');
  });

  test('posle greske se dugme opet moze pritisnuti', async () => {
    mockLogin.mockRejectedValue(new Error('Puklo.'));
    await prikazi();
    await act(async () => {
      fireEvent.changeText(screen.getByPlaceholderText('Email'), 'ana@primer.rs');
    });
    await act(async () => {
      fireEvent.changeText(screen.getByPlaceholderText('Lozinka'), 'x');
    });

    await act(async () => {
      fireEvent.press(screen.getByText('Prijavi se'));
    });
    await act(async () => {
      fireEvent.press(screen.getByText('Prijavi se'));
    });

    expect(mockLogin).toHaveBeenCalledTimes(2);
  });
});
