import { render, screen, fireEvent } from '@testing-library/react-native';
import PodsetnikSaglasnosti from '../PodsetnikSaglasnosti';

const popunjeno = {
  id: 'a',
  firstName: 'Ana',
  photoConsent: true,
  eatsLunch: false,
  eatsSnack: true,
  pickupPersons: 'Baka Mira',
};
const prazno = {
  id: 'm',
  firstName: 'Marko',
  photoConsent: null,
  eatsLunch: null,
  eatsSnack: null,
  pickupPersons: null,
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
