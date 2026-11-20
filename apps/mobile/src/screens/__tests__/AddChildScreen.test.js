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
  test('preskocena pitanja idu kao "nije odgovoreno" (null)', async () => {
    await prikazi();
    await popuniObavezno();

    await pritisni('Dodaj dete');

    await waitFor(() =>
      expect(apiRequest).toHaveBeenCalledWith('/children', {
        method: 'POST',
        body: expect.objectContaining({
          photoConsent: null,
          eatsLunch: null,
          eatsSnack: null,
          pickupPersons: null,
        }),
      })
    );
  });

  test('odgovori i osobe koje preuzimaju dete se salju', async () => {
    await prikazi();
    await popuniObavezno();

    await act(async () => {
      fireEvent.press(screen.getByLabelText('Da li dete sme da se slika?: Ne'));
      fireEvent.press(screen.getByLabelText('Da li dete jede rucak u igraonici?: Da'));
    });
    await upisi('npr. baka Mira, 064 111 2222', ' Baka Mira 064 111 2222 ');

    await pritisni('Dodaj dete');

    await waitFor(() =>
      expect(apiRequest).toHaveBeenCalledWith('/children', {
        method: 'POST',
        body: expect.objectContaining({
          photoConsent: false,
          eatsLunch: true,
          eatsSnack: null,
          pickupPersons: 'Baka Mira 064 111 2222',
        }),
      })
    );
  });

  test('ponovni dodir vraca odgovor na "nije odgovoreno"', async () => {
    await prikazi();
    await popuniObavezno();

    const da = () => screen.getByLabelText('Da li dete jede uzinu u igraonici?: Da');
    await act(async () => {
      fireEvent.press(da());
    });
    await act(async () => {
      fireEvent.press(da());
    });

    await pritisni('Dodaj dete');

    await waitFor(() =>
      expect(apiRequest).toHaveBeenCalledWith(
        '/children',
        expect.objectContaining({ body: expect.objectContaining({ eatsSnack: null }) })
      )
    );
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
    pickupPersons: null,
  };
  const prikaziIzmenu = () =>
    render(<AddChildScreen navigation={navigation} route={{ params: { child: dete } }} />);

  test('popunjava formu postojecim podacima', async () => {
    await prikaziIzmenu();

    expect(screen.getByPlaceholderText('Ime deteta').props.value).toBe('Lena');
    expect(screen.getByPlaceholderText('Nesto drugo? Upisite ovde').props.value).toBe('kivi');
    expect(
      screen.getByLabelText('Da li dete sme da se slika?: Da').props.accessibilityState.selected
    ).toBe(true);
    expect(screen.getByText('Sacuvaj izmene')).toBeTruthy();
  });

  test('cuva izmene preko PATCH i vraca na ekran deteta', async () => {
    await prikaziIzmenu();

    await act(async () => {
      fireEvent.press(screen.getByLabelText('Da li dete jede rucak u igraonici?: Da'));
    });
    await upisi('npr. baka Mira, 064 111 2222', 'Deka Pera');

    await pritisni('Sacuvaj izmene');

    await waitFor(() =>
      expect(apiRequest).toHaveBeenCalledWith('/children/d1', {
        method: 'PATCH',
        body: expect.objectContaining({
          allergies: 'Mleko, kivi',
          photoConsent: true,
          eatsLunch: true,
          eatsSnack: false,
          pickupPersons: 'Deka Pera',
        }),
      })
    );
    expect(navigation.goBack).toHaveBeenCalled();
  });
});

describe('AddChildScreen - otvoren sa podsetnika na pocetnoj', () => {
  const dete = {
    id: 'd2',
    firstName: 'Marko',
    lastName: 'Probni',
    dateOfBirth: '2021-03-14T00:00:00.000Z',
    photoConsent: true,
  };
  const raspored = { nativeEvent: { layout: { x: 0, y: 900, width: 400, height: 500 } } };

  test('skroluje do saglasnosti, i to samo jednom', async () => {
    const scrollTo = jest.spyOn(require('react-native').ScrollView.prototype, 'scrollTo');
    await render(
      <AddChildScreen
        navigation={navigation}
        route={{ params: { child: dete, naSaglasnosti: true } }}
      />
    );

    await act(async () => {
      fireEvent(screen.getByTestId('saglasnosti'), 'layout', raspored);
      fireEvent(screen.getByTestId('saglasnosti'), 'layout', raspored);
    });

    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo.mock.calls[0][0].y).toBeGreaterThan(0);
    scrollTo.mockRestore();
  });

  test('obicna izmena ostaje na vrhu', async () => {
    const scrollTo = jest.spyOn(require('react-native').ScrollView.prototype, 'scrollTo');
    await render(
      <AddChildScreen navigation={navigation} route={{ params: { child: dete } }} />
    );

    await act(async () => {
      fireEvent(screen.getByTestId('saglasnosti'), 'layout', raspored);
    });

    expect(scrollTo).not.toHaveBeenCalled();
    scrollTo.mockRestore();
  });
});
