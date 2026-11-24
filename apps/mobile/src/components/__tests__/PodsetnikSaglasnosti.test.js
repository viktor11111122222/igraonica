import { render, screen, fireEvent } from '@testing-library/react-native';
import PodsetnikSaglasnosti from '../PodsetnikSaglasnosti';

const popunjeno = {
  id: 'a',
  firstName: 'Ana',
  photoConsent: true,
  eatsLunch: false,
  eatsSnack: true,
  walksConsent: true,
  pickupPersons: 'Baka Mira',
  extraContactPhone: '065 222 3333',
};
const prazno = {
  id: 'm',
  firstName: 'Marko',
  photoConsent: null,
  eatsLunch: null,
  eatsSnack: null,
  walksConsent: null,
  pickupPersons: null,
  extraContactPhone: null,
};

const navigation = { navigate: jest.fn() };
beforeEach(() => jest.clearAllMocks());

describe('PodsetnikSaglasnosti', () => {
  test('ne prikazuje se kad je sve popunjeno', async () => {
    await render(<PodsetnikSaglasnosti deca={[popunjeno]} navigation={navigation} />);
    expect(screen.queryByText('Popunite saglasnosti')).toBeNull();
  });

  test('ne prikazuje se bez dece', async () => {
    await render(<PodsetnikSaglasnosti deca={[]} navigation={navigation} />);
    expect(screen.queryByText('Popunite saglasnosti')).toBeNull();
  });

  // "Ne" je odgovor - podsetnik trazi samo ono na sta nije odgovoreno.
  test('"ne" se racuna kao odgovor', async () => {
    await render(
      <PodsetnikSaglasnosti
        deca={[{ ...popunjeno, photoConsent: false }]}
        navigation={navigation}
      />
    );
    expect(screen.queryByText('Popunite saglasnosti')).toBeNull();
  });

  test('jedno dete vodi pravo na obrazac za to dete', async () => {
    await render(<PodsetnikSaglasnosti deca={[popunjeno, prazno]} navigation={navigation} />);

    expect(screen.getByText('Popunite saglasnosti')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Popunite saglasnosti za Marko'));

    expect(navigation.navigate).toHaveBeenCalledWith('AddChild', {
      child: prazno,
      naSaglasnosti: true,
    });
  });

  test('vise dece vodi na Moj paket', async () => {
    const drugo = { ...prazno, id: 'l', firstName: 'Lena', pickupPersons: 'Deka' };
    await render(<PodsetnikSaglasnosti deca={[prazno, drugo]} navigation={navigation} />);

    fireEvent.press(screen.getByLabelText('Popunite saglasnosti za Marko, Lena'));

    expect(navigation.navigate).toHaveBeenCalledWith('Package');
  });
});

describe('PodsetnikSaglasnosti - neobavezne stavke', () => {
  test('podseca i kad fale samo dodatni kontakt i ovlascene osobe, blazim tekstom', async () => {
    await render(
      <PodsetnikSaglasnosti
        deca={[{ ...popunjeno, extraContactPhone: null }]}
        navigation={navigation}
      />
    );

    expect(screen.queryByText('Popunite saglasnosti')).toBeNull();
    expect(screen.getByText('Dopunite kontakte')).toBeTruthy();
  });

  test('obavezne imaju prednost u naslovu', async () => {
    await render(
      <PodsetnikSaglasnosti
        deca={[{ ...popunjeno, extraContactPhone: null }, prazno]}
        navigation={navigation}
      />
    );

    expect(screen.getByText('Popunite saglasnosti')).toBeTruthy();
  });
});

describe('PodsetnikSaglasnosti - sklanjanje i kontrola osoblja', () => {
  const samoKontakti = { ...popunjeno, extraContactPhone: null };

  test('roditelj sklanja blazi podsetnik preko X, uz potvrdu', async () => {
    const { Alert } = require('react-native');
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const onSakrij = jest.fn();
    await render(
      <PodsetnikSaglasnosti deca={[samoKontakti]} navigation={navigation} onSakrij={onSakrij} />
    );

    fireEvent.press(screen.getByLabelText('Sakrij podsetnik'));
    const dugmad = alert.mock.calls[0][2];
    dugmad.find((d) => d.text === 'Sakrij').onPress();

    expect(onSakrij).toHaveBeenCalled();
    expect(navigation.navigate).not.toHaveBeenCalled();
    alert.mockRestore();
  });

  test('obavezne saglasnosti nemaju X', async () => {
    await render(
      <PodsetnikSaglasnosti deca={[prazno]} navigation={navigation} onSakrij={() => {}} />
    );

    expect(screen.getByText('Popunite saglasnosti')).toBeTruthy();
    expect(screen.queryByLabelText('Sakrij podsetnik')).toBeNull();
  });

  test('sklonjen blazi podsetnik se ne prikazuje, obavezni i dalje da', async () => {
    const { podsetnikDozvoljen } = require('../PodsetnikSaglasnosti');
    const dozvola = podsetnikDozvoljen({ contactReminderHiddenAt: '2026-11-24' }, {});

    await render(
      <PodsetnikSaglasnosti deca={[samoKontakti]} navigation={navigation} dozvola={dozvola} />
    );
    expect(screen.queryByText('Dopunite kontakte')).toBeNull();

    await render(
      <PodsetnikSaglasnosti deca={[prazno]} navigation={navigation} dozvola={dozvola} />
    );
    expect(screen.getByText('Popunite saglasnosti')).toBeTruthy();
  });

  test('osoblje gasi ceo podsetnik roditelju ili svima', async () => {
    const { podsetnikDozvoljen } = require('../PodsetnikSaglasnosti');

    for (const dozvola of [
      podsetnikDozvoljen({ consentReminder: false }, {}),
      podsetnikDozvoljen({}, { mobile_consent_reminder: 'false' }),
    ]) {
      await render(
        <PodsetnikSaglasnosti deca={[prazno]} navigation={navigation} dozvola={dozvola} />
      );
      expect(screen.queryByText('Popunite saglasnosti')).toBeNull();
    }
  });
});
