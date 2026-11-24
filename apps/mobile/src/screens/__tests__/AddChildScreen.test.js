import { render, screen, fireEvent, act, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import AddChildScreen from '../AddChildScreen';
import { apiRequest } from '../../utils/api';

jest.mock('../../utils/api', () => ({ apiRequest: jest.fn() }));

const mockUpdateProfile = jest.fn();
let mockUser = { phone: '064 123 4567' };
let mockNovNalog = false;
jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: mockUser, updateProfile: mockUpdateProfile, novNalog: mockNovNalog }),
}));

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

const navigation = { goBack: jest.fn(), navigate: jest.fn(), getState: () => ({ index: 1 }) };
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

// Obavezne saglasnosti (1, 2, 3 i 7) - bez njih se dete ne cuva.
const OBAVEZNE = [
  'Saglasnost za fotografisanje i snimanje deteta',
  'Saglasnost za konzumiranje rucka',
  'Saglasnost za konzumiranje uzine',
  'Saglasnost za odlazak u setnju',
];

async function odgovoriNaSve(odgovor = 'Da') {
  for (const naslov of OBAVEZNE) {
    await act(async () => {
      fireEvent.press(screen.getByLabelText(`${naslov}: ${odgovor}`));
    });
  }
}

async function popuniObavezno() {
  await upisi('Ime deteta', 'Lena');
  await upisi('Prezime deteta', 'Petrovic');
  await act(async () => {
    fireEvent.press(screen.getByTestId('izaberi-datum'));
  });
  await odgovoriNaSve();
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUser = { phone: '064 123 4567' };
  mockNovNalog = false;
  mockUpdateProfile.mockResolvedValue({});
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
    await odgovoriNaSve();

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

  test('bez izabranog pola ne salje pol - server odbija null', async () => {
    await prikazi();
    await popuniObavezno();

    await pritisni('Dodaj dete');

    await waitFor(() => expect(apiRequest).toHaveBeenCalled());
    const [, { body }] = apiRequest.mock.calls[0];
    expect(body.gender).toBeUndefined();
    expect(JSON.parse(JSON.stringify(body))).not.toHaveProperty('gender');
  });

  test('izabrani pol se salje', async () => {
    await prikazi();
    await popuniObavezno();
    await pritisni('Zenski');

    await pritisni('Dodaj dete');

    await waitFor(() =>
      expect(apiRequest).toHaveBeenCalledWith(
        '/children',
        expect.objectContaining({ body: expect.objectContaining({ gender: 'FEMALE' }) })
      )
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

describe('AddChildScreen - saglasnosti', () => {
  test('bez odgovora na obavezne saglasnosti dete se ne cuva', async () => {
    await prikazi();
    await upisi('Ime deteta', 'Lena');
    await upisi('Prezime deteta', 'Petrovic');
    await act(async () => {
      fireEvent.press(screen.getByTestId('izaberi-datum'));
    });

    await pritisni('Dodaj dete');

    expect(apiRequest).not.toHaveBeenCalled();
    expect(Alert.alert.mock.calls[0][0]).toBe('Nedostaju saglasnosti');
    expect(screen.getAllByText('Izaberite Da ili Ne.')).toHaveLength(4);
  });

  test('bez telefona roditelja dete se ne cuva', async () => {
    mockUser = { phone: null };
    await prikazi();
    await popuniObavezno();

    await pritisni('Dodaj dete');

    expect(apiRequest).not.toHaveBeenCalled();
    expect(screen.getByText('Unesite ispravan broj telefona.')).toBeTruthy();
  });

  test('salje sve stavke; neobavezne prazne idu kao null', async () => {
    await prikazi();
    await popuniObavezno();
    await act(async () => {
      fireEvent.press(
        screen.getByLabelText('Saglasnost za fotografisanje i snimanje deteta: Ne')
      );
    });

    await pritisni('Dodaj dete');

    await waitFor(() =>
      expect(apiRequest).toHaveBeenCalledWith('/children', {
        method: 'POST',
        body: expect.objectContaining({
          photoConsent: false,
          eatsLunch: true,
          eatsSnack: true,
          walksConsent: true,
          pickupPersons: null,
          extraContactPhone: null,
        }),
      })
    );
    expect(mockUpdateProfile).not.toHaveBeenCalled();
  });

  test('dodatni kontakt i ovlascene osobe se salju', async () => {
    await prikazi();
    await popuniObavezno();
    await upisi('npr. 065 222 3333', ' 065 222 3333 ');
    await upisi('npr. Mira Petrovic, 064 111 2222\nJovan Petrovic, 065 333 4444', ' Baka Mira 064 111 2222 ');

    await pritisni('Dodaj dete');

    await waitFor(() =>
      expect(apiRequest).toHaveBeenCalledWith(
        '/children',
        expect.objectContaining({
          body: expect.objectContaining({
            extraContactPhone: '065 222 3333',
            pickupPersons: 'Baka Mira 064 111 2222',
          }),
        })
      )
    );
  });

  test('neispravan dodatni kontakt se odbija', async () => {
    await prikazi();
    await popuniObavezno();
    await upisi('npr. 065 222 3333', 'nemam');

    await pritisni('Dodaj dete');

    expect(apiRequest).not.toHaveBeenCalled();
    expect(screen.getByText('Broj telefona nije ispravan.')).toBeTruthy();
  });

  test('promenjen telefon roditelja se cuva na nalogu', async () => {
    mockUser = { phone: null };
    await prikazi();
    await popuniObavezno();
    await upisi('npr. 064 123 4567', '064 999 8888');

    await pritisni('Dodaj dete');

    await waitFor(() => expect(apiRequest).toHaveBeenCalled());
    expect(mockUpdateProfile).toHaveBeenCalledWith({ phone: '064 999 8888' });
  });
});

describe('AddChildScreen - posle registracije', () => {
  test('prvi ekran posle registracije pozdravlja i posle cuvanja vodi na pocetnu', async () => {
    mockNovNalog = true;
    const nav = { goBack: jest.fn(), navigate: jest.fn(), getState: () => ({ index: 0 }) };
    await render(<AddChildScreen navigation={nav} />);

    expect(screen.getByText('Dobro dosli!')).toBeTruthy();
    await popuniObavezno();
    await pritisni('Dodaj dete');

    await waitFor(() => expect(Alert.alert).toHaveBeenCalled());
    Alert.alert.mock.calls[0][2][0].onPress();
    expect(nav.navigate).toHaveBeenCalledWith('Tabs');
    expect(nav.goBack).not.toHaveBeenCalled();
  });

  test('obicno dodavanje deteta nema pozdrav', async () => {
    await prikazi();
    expect(screen.queryByText('Dobro dosli!')).toBeNull();
  });
});

describe('AddChildScreen - izmena postojeceg deteta', () => {
  const dete = {
    id: 'd1',
    firstName: 'Lena',
    lastName: 'Petrovic',
    dateOfBirth: '2020-05-10T00:00:00.000Z',
    gender: 'FEMALE',
    allergies: 'Mleko, kivi',
    notes: null,
    photoConsent: true,
    eatsLunch: null,
    eatsSnack: false,
    walksConsent: true,
    pickupPersons: null,
    extraContactPhone: null,
  };
  const prikaziIzmenu = (params = {}) =>
    render(<AddChildScreen navigation={navigation} route={{ params: { child: dete, ...params } }} />);

  test('popunjava formu postojecim podacima', async () => {
    await prikaziIzmenu();

    expect(screen.getByPlaceholderText('Ime deteta').props.value).toBe('Lena');
    expect(screen.getByPlaceholderText('Nesto drugo? Upisite ovde').props.value).toBe('kivi');
    expect(
      screen.getByLabelText('Saglasnost za fotografisanje i snimanje deteta: Da').props
        .accessibilityState.selected
    ).toBe(true);
    expect(screen.getByText('Sacuvaj izmene')).toBeTruthy();
  });

  test('cuva izmene preko PATCH i vraca na ekran deteta', async () => {
    await prikaziIzmenu();
    await act(async () => {
      fireEvent.press(screen.getByLabelText('Saglasnost za konzumiranje rucka: Da'));
    });
    await upisi('npr. Mira Petrovic, 064 111 2222\nJovan Petrovic, 065 333 4444', 'Deka Pera');

    await pritisni('Sacuvaj izmene');

    await waitFor(() =>
      expect(apiRequest).toHaveBeenCalledWith('/children/d1', {
        method: 'PATCH',
        body: expect.objectContaining({
          allergies: 'Mleko, kivi',
          photoConsent: true,
          eatsLunch: true,
          eatsSnack: false,
          walksConsent: true,
          pickupPersons: 'Deka Pera',
        }),
      })
    );
    expect(navigation.goBack).toHaveBeenCalled();
  });

  test('ni izmena se ne cuva dok fali obavezan odgovor', async () => {
    await prikaziIzmenu();
    await pritisni('Sacuvaj izmene');
    expect(apiRequest).not.toHaveBeenCalled();
  });

  test('otvoren sa podsetnika skroluje do saglasnosti, i to samo jednom', async () => {
    const scrollTo = jest.spyOn(require('react-native').ScrollView.prototype, 'scrollTo');
    await prikaziIzmenu({ naSaglasnosti: true });
    const raspored = { nativeEvent: { layout: { x: 0, y: 900, width: 400, height: 500 } } };

    await act(async () => {
      fireEvent(screen.getByTestId('saglasnosti'), 'layout', raspored);
      fireEvent(screen.getByTestId('saglasnosti'), 'layout', raspored);
    });

    expect(scrollTo).toHaveBeenCalledTimes(1);
    scrollTo.mockRestore();
  });

  test('obicna izmena ostaje na vrhu', async () => {
    const scrollTo = jest.spyOn(require('react-native').ScrollView.prototype, 'scrollTo');
    await prikaziIzmenu();
    await act(async () => {
      fireEvent(screen.getByTestId('saglasnosti'), 'layout', {
        nativeEvent: { layout: { x: 0, y: 900, width: 400, height: 500 } },
      });
    });
    expect(scrollTo).not.toHaveBeenCalled();
    scrollTo.mockRestore();
  });
});
