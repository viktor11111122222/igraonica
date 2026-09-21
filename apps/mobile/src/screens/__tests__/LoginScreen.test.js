import { render, screen, fireEvent, act } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import LoginScreen from '../LoginScreen';
import * as storage from '../../utils/storage';

const mockLogin = jest.fn();
jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ login: mockLogin }),
  ZAPAMCEN_EMAIL: 'zapamcen_email',
}));

jest.mock('../../utils/storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => {}),
  deleteItem: jest.fn(async () => {}),
}));

let mockPodesavanja = {};
jest.mock('../../context/SettingsContext', () => ({
  useSettings: () => ({ settings: mockPodesavanja }),
}));

const navigation = { navigate: jest.fn() };

// Ekran racuna gornju ivicu iz sigurne zone, a ona van providera puca, pa
// test zadaje meru uredjaja umesto simulatora.
const metrika = {
  frame: { x: 0, y: 0, width: 393, height: 852 },
  insets: { top: 59, left: 0, right: 0, bottom: 34 },
};

// `render` je u ovoj verziji RNTL-a asinhron - bez await-a `screen` ostaje
// nevezan i svaki upit javi da render nije ni pozvan.
const prikazi = () =>
  render(
    <SafeAreaProvider initialMetrics={metrika}>
      <LoginScreen navigation={navigation} />
    </SafeAreaProvider>
  );

beforeEach(() => {
  jest.clearAllMocks();
  mockPodesavanja = {};
  mockLogin.mockResolvedValue(undefined);
  storage.getItem.mockResolvedValue(null);
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

    expect(mockLogin).toHaveBeenCalledWith('ana@primer.rs', 'tajna123', true);
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

describe('LoginScreen - "Zapamti me"', () => {
  const kvacica = () => screen.getByLabelText('Zapamti me');
  const stiklirana = () => kvacica().props.accessibilityState.checked;

  async function popuni() {
    await act(async () => {
      fireEvent.changeText(screen.getByPlaceholderText('Email'), 'ana@primer.rs');
    });
    await act(async () => {
      fireEvent.changeText(screen.getByPlaceholderText('Lozinka'), 'tajna123');
    });
  }

  async function posalji() {
    await act(async () => {
      fireEvent.press(screen.getByText('Prijavi se'));
    });
  }

  async function prebaci() {
    await act(async () => {
      fireEvent.press(kvacica());
    });
  }

  // Telefon je licni uredjaj - ocekivanje je da prijava traje.
  test('kvacica je podrazumevano ukljucena', async () => {
    await prikazi();
    expect(stiklirana()).toBe(true);
  });

  test('iskljucena kvacica stize do prijave', async () => {
    await prikazi();
    await prebaci();
    await popuni();
    await posalji();

    expect(mockLogin).toHaveBeenCalledWith('ana@primer.rs', 'tajna123', false);
  });

  test('ukljucena kvacica stize do prijave', async () => {
    await prikazi();
    await popuni();
    await posalji();

    expect(mockLogin).toHaveBeenCalledWith('ana@primer.rs', 'tajna123', true);
  });

  test('kvacica se moze vratiti nazad', async () => {
    await prikazi();

    await prebaci();
    expect(stiklirana()).toBe(false);

    await prebaci();
    expect(stiklirana()).toBe(true);
  });

  test('zapamcen email popunjava polje', async () => {
    storage.getItem.mockResolvedValue('vicko@primer.rs');
    await prikazi();

    await screen.findByDisplayValue('vicko@primer.rs');
    expect(storage.getItem).toHaveBeenCalledWith('zapamcen_email');
  });

  // Polje za lozinku uvek krece prazno: pamti se samo email.
  test('lozinka se ne popunjava unapred', async () => {
    storage.getItem.mockResolvedValue('vicko@primer.rs');
    await prikazi();

    await screen.findByDisplayValue('vicko@primer.rs');
    expect(screen.getByPlaceholderText('Lozinka').props.value).toBe('');
  });

  // Ako odgovor iz Keychain-a stigne kasno, ne sme da pregazi ono sto je
  // korisnik u medjuvremenu ukucao.
  test('zapamcen email ne gazi vec ukucan tekst', async () => {
    let odblokiraj;
    storage.getItem.mockReturnValue(
      new Promise((r) => {
        odblokiraj = r;
      })
    );

    await prikazi();
    await act(async () => {
      fireEvent.changeText(screen.getByPlaceholderText('Email'), 'drugi@primer.rs');
    });
    await act(async () => {
      odblokiraj('vicko@primer.rs');
    });

    expect(screen.getByPlaceholderText('Email').props.value).toBe('drugi@primer.rs');
  });
});
