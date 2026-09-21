import { render, screen, waitFor, act, fireEvent } from '@testing-library/react-native';
import { Text, Pressable } from 'react-native';
import { AuthProvider, useAuth } from '../AuthContext';
import { apiRequest, onSessionExpired } from '../../utils/api';
import * as storage from '../../utils/storage';
import * as kes from '../../utils/kes';

jest.mock('../../utils/api', () => ({
  apiRequest: jest.fn(),
  onSessionExpired: jest.fn(() => () => {}),
}));

jest.mock('../../utils/storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  deleteItem: jest.fn(),
}));

const KORISNIK = { id: 'u1', firstName: 'Ana', lastName: 'Petrovic', role: 'PARENT' };

function Ekran() {
  const { user, loading, login, register, logout, updateProfile } = useAuth();
  return (
    <>
      <Text testID="stanje">
        {loading ? 'ucitava' : user ? `prijavljen:${user.firstName}` : 'odjavljen'}
      </Text>
      <Pressable testID="prijava" onPress={() => login('a@b.c', 'tajna').catch(() => {})}>
        <Text>Prijava</Text>
      </Pressable>
      <Pressable testID="registracija" onPress={() => register({ email: 'a@b.c' }).catch(() => {})}>
        <Text>Registracija</Text>
      </Pressable>
      <Pressable
        testID="prijava-pamti"
        onPress={() => login('a@b.c', 'tajna', true).catch(() => {})}
      >
        <Text>Prijava sa pamcenjem</Text>
      </Pressable>
      <Pressable testID="odjava" onPress={logout}>
        <Text>Odjava</Text>
      </Pressable>
      <Pressable testID="profil" onPress={() => updateProfile({ phone: '060' }).catch(() => {})}>
        <Text>Profil</Text>
      </Pressable>
    </>
  );
}

const prikazi = () => render(<AuthProvider><Ekran /></AuthProvider>);
const stanje = () => screen.getByTestId('stanje').props.children;

beforeEach(() => {
  jest.clearAllMocks();
  storage.getItem.mockResolvedValue(null);
  onSessionExpired.mockReturnValue(() => {});
});

describe('AuthContext - pokretanje', () => {
  test('bez tokena odmah zavrsava ucitavanje', async () => {
    prikazi();
    await waitFor(() => expect(stanje()).toBe('odjavljen'));
    expect(apiRequest).not.toHaveBeenCalled();
  });

  test('sa tokenom pita server ko je korisnik', async () => {
    storage.getItem.mockResolvedValue('token');
    apiRequest.mockResolvedValue({ user: KORISNIK });

    prikazi();

    await waitFor(() => expect(stanje()).toBe('prijavljen:Ana'));
    expect(apiRequest).toHaveBeenCalledWith('/auth/me');
  });

  test('neispravan token se brise', async () => {
    storage.getItem.mockResolvedValue('pokvaren');
    apiRequest.mockRejectedValue(new Error('Nevazeci token.'));

    prikazi();

    await waitFor(() => expect(storage.deleteItem).toHaveBeenCalledWith('token'));
    expect(stanje()).toBe('odjavljen');
  });
});

describe('AuthContext - prijava i registracija', () => {
  test('prijava cuva token i korisnika', async () => {
    apiRequest.mockResolvedValue({ token: 'nov', user: KORISNIK });
    prikazi();
    await waitFor(() => expect(stanje()).toBe('odjavljen'));

    await act(async () => {
      fireEvent.press(screen.getByTestId('prijava'));
    });

    await waitFor(() => expect(stanje()).toBe('prijavljen:Ana'));
    // Bez kvacice token zivi samo do gasenja aplikacije.
    expect(storage.setItem).toHaveBeenCalledWith('token', 'nov', { trajno: false });
  });

  test('neuspela prijava ne menja stanje', async () => {
    apiRequest.mockRejectedValue(new Error('Pogresan email ili lozinka.'));
    prikazi();
    await waitFor(() => expect(stanje()).toBe('odjavljen'));

    await act(async () => {
      fireEvent.press(screen.getByTestId('prijava'));
    });

    expect(stanje()).toBe('odjavljen');
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  test('registracija odmah prijavljuje korisnika', async () => {
    apiRequest.mockResolvedValue({ token: 'nov', user: KORISNIK });
    prikazi();
    await waitFor(() => expect(stanje()).toBe('odjavljen'));

    await act(async () => {
      fireEvent.press(screen.getByTestId('registracija'));
    });

    await waitFor(() => expect(stanje()).toBe('prijavljen:Ana'));
    expect(apiRequest).toHaveBeenCalledWith('/auth/register', expect.objectContaining({ method: 'POST' }));
  });
});

describe('AuthContext - odjava i profil', () => {
  test('odjava brise token', async () => {
    apiRequest.mockResolvedValue({ token: 't', user: KORISNIK });
    prikazi();
    await waitFor(() => expect(stanje()).toBe('odjavljen'));
    await act(async () => {
      fireEvent.press(screen.getByTestId('prijava'));
    });
    await waitFor(() => expect(stanje()).toBe('prijavljen:Ana'));

    await act(async () => {
      fireEvent.press(screen.getByTestId('odjava'));
    });

    expect(stanje()).toBe('odjavljen');
    expect(storage.deleteItem).toHaveBeenCalledWith('token');
  });

  test('izmena profila osvezava korisnika bez nove prijave', async () => {
    apiRequest.mockResolvedValue({ token: 't', user: KORISNIK });
    prikazi();
    await waitFor(() => expect(stanje()).toBe('odjavljen'));
    await act(async () => {
      fireEvent.press(screen.getByTestId('prijava'));
    });
    await waitFor(() => expect(stanje()).toBe('prijavljen:Ana'));

    apiRequest.mockResolvedValue({ user: { ...KORISNIK, firstName: 'Anja' } });
    await act(async () => {
      fireEvent.press(screen.getByTestId('profil'));
    });

    await waitFor(() => expect(stanje()).toBe('prijavljen:Anja'));
    expect(storage.setItem).toHaveBeenCalledTimes(1);
  });

  // Ovo je bio kvar: istekao token niko nije hvatao, pa je roditelju ostajala
  // samo reinstalacija aplikacije.
  test('istekla sesija sama vraca na prijavu', async () => {
    let javiIstek;
    onSessionExpired.mockImplementation((fn) => {
      javiIstek = fn;
      return () => {};
    });
    apiRequest.mockResolvedValue({ token: 't', user: KORISNIK });
    prikazi();
    await waitFor(() => expect(stanje()).toBe('odjavljen'));
    await act(async () => {
      fireEvent.press(screen.getByTestId('prijava'));
    });
    await waitFor(() => expect(stanje()).toBe('prijavljen:Ana'));

    await act(async () => {
      javiIstek();
    });

    expect(stanje()).toBe('odjavljen');
  });
});

describe('AuthContext - "Zapamti me"', () => {
  test('kvacica trajno cuva token i pamti email', async () => {
    apiRequest.mockResolvedValue({ token: 'dugi', user: KORISNIK });
    prikazi();
    await waitFor(() => expect(stanje()).toBe('odjavljen'));

    await act(async () => {
      fireEvent.press(screen.getByTestId('prijava-pamti'));
    });

    await waitFor(() => expect(stanje()).toBe('prijavljen:Ana'));
    // Backend po ovome bira rok tokena...
    expect(apiRequest).toHaveBeenCalledWith('/auth/login', {
      method: 'POST',
      body: { email: 'a@b.c', password: 'tajna', rememberMe: true },
    });
    // ...a telefon po istoj vrednosti bira da li token prezivi gasenje.
    expect(storage.setItem).toHaveBeenCalledWith('token', 'dugi', { trajno: true });
    expect(storage.setItem).toHaveBeenCalledWith('zapamcen_email', 'a@b.c');
  });

  test('bez kvacice se zapamcen email brise', async () => {
    apiRequest.mockResolvedValue({ token: 'kratki', user: KORISNIK });
    prikazi();
    await waitFor(() => expect(stanje()).toBe('odjavljen'));

    await act(async () => {
      fireEvent.press(screen.getByTestId('prijava'));
    });

    await waitFor(() => expect(stanje()).toBe('prijavljen:Ana'));
    expect(storage.deleteItem).toHaveBeenCalledWith('zapamcen_email');
    expect(storage.setItem).not.toHaveBeenCalledWith('zapamcen_email', 'a@b.c');
  });
});

// Kes zivi na nivou modula i prezivljava promenu naloga, pa mora da se prazni
// na svakoj - inace bi novi korisnik u prvim sekundama video tudje podatke.
describe('AuthContext - kes se prazni uz nalog', () => {
  async function napuniKes() {
    await kes.kesiraj('/packages/my', async () => ({ tajna: 'prethodni nalog' }));
    expect(kes.stanje().zapisa).toBe(1);
  }

  test('prijava prazni kes prethodnog naloga', async () => {
    await napuniKes();
    apiRequest.mockResolvedValue({ token: 'nov', user: KORISNIK });
    prikazi();
    await waitFor(() => expect(stanje()).toBe('odjavljen'));

    await act(async () => {
      fireEvent.press(screen.getByTestId('prijava'));
    });

    await waitFor(() => expect(stanje()).toBe('prijavljen:Ana'));
    expect(kes.stanje().zapisa).toBe(0);
  });

  test('odjava prazni kes', async () => {
    apiRequest.mockResolvedValue({ token: 'nov', user: KORISNIK });
    prikazi();
    await waitFor(() => expect(stanje()).toBe('odjavljen'));
    await act(async () => {
      fireEvent.press(screen.getByTestId('prijava'));
    });
    await waitFor(() => expect(stanje()).toBe('prijavljen:Ana'));

    await napuniKes();

    await act(async () => {
      fireEvent.press(screen.getByTestId('odjava'));
    });

    await waitFor(() => expect(stanje()).toBe('odjavljen'));
    expect(kes.stanje().zapisa).toBe(0);
  });
});
