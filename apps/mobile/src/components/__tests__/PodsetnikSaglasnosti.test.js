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

describe('PodsetnikSaglasnosti - stavke 4 i 5 su obavezne', () => {
  test('podseca i kad fale samo dodatni kontakt ili ovlascene osobe', async () => {
    await render(
      <PodsetnikSaglasnosti
        deca={[{ ...popunjeno, extraContactPhone: null }]}
        navigation={navigation}
      />
    );

    expect(screen.getByText('Popunite saglasnosti')).toBeTruthy();
  });

  test('"Nema" i "Samo roditelji" su odgovor', async () => {
    await render(
      <PodsetnikSaglasnosti
        deca={[{ ...popunjeno, extraContactPhone: 'Nema', pickupPersons: 'Samo roditelji' }]}
        navigation={navigation}
      />
    );

    expect(screen.queryByText('Popunite saglasnosti')).toBeNull();
  });
});

describe('PodsetnikSaglasnosti - sklanjanje i kontrola osoblja', () => {
  const { podsetnikVidljiv } = require('../PodsetnikSaglasnosti');

  test('roditelj sklanja podsetnik preko X, uz potvrdu', async () => {
    const { Alert } = require('react-native');
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const onSakrij = jest.fn();
    await render(
      <PodsetnikSaglasnosti deca={[prazno]} navigation={navigation} onSakrij={onSakrij} />
    );

    fireEvent.press(screen.getByLabelText('Sakrij podsetnik'));
    alert.mock.calls[0][2].find((d) => d.text === 'Sakrij').onPress();

    expect(onSakrij).toHaveBeenCalled();
    expect(navigation.navigate).not.toHaveBeenCalled();
    alert.mockRestore();
  });

  test('sklonjen podsetnik se ne prikazuje', async () => {
    await render(
      <PodsetnikSaglasnosti
        deca={[prazno]}
        navigation={navigation}
        vidljiv={podsetnikVidljiv({ contactReminderHiddenAt: '2026-11-24' }, {})}
      />
    );
    expect(screen.queryByText('Popunite saglasnosti')).toBeNull();
  });

  test('osoblje gasi podsetnik roditelju ili svima', async () => {
    expect(podsetnikVidljiv({ consentReminder: false }, {})).toBe(false);
    expect(podsetnikVidljiv({}, { mobile_consent_reminder: 'false' })).toBe(false);
    expect(podsetnikVidljiv({ consentReminder: true }, { mobile_consent_reminder: 'true' })).toBe(true);
  });
});
