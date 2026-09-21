import { render, screen, fireEvent, act } from '@testing-library/react-native';
import { BackButton } from '../AppNavigator';

// Roditelji su prijavili da sa Obavestenja "nema cime nazad": strelica je
// postojala, ali kao gola bela linija na banneru punom belih sara. Sada je to
// dugme sa koprenom - a ovde se cuva ponasanje iza njega.
function napraviNavigaciju({ mozeNazad }) {
  return {
    canGoBack: jest.fn(() => mozeNazad),
    goBack: jest.fn(),
    navigate: jest.fn(),
  };
}

const prikazi = async (navigation) => {
  await act(async () => {
    render(<BackButton navigation={navigation} />);
  });
};

describe('BackButton', () => {
  test('kada istorija postoji, vraca korak nazad', async () => {
    const navigation = napraviNavigaciju({ mozeNazad: true });
    await prikazi(navigation);

    fireEvent.press(screen.getByLabelText('Nazad'));

    expect(navigation.goBack).toHaveBeenCalledTimes(1);
    expect(navigation.navigate).not.toHaveBeenCalled();
  });

  // Ekran otvoren direktno ili obnovljeno stanje: bez ovoga bi korisnik ostao
  // zarobljen na ekranu bez tab trake.
  test('kada istorije nema, vraca na tabove', async () => {
    const navigation = napraviNavigaciju({ mozeNazad: false });
    await prikazi(navigation);

    fireEvent.press(screen.getByLabelText('Nazad'));

    expect(navigation.navigate).toHaveBeenCalledWith('Tabs');
    expect(navigation.goBack).not.toHaveBeenCalled();
  });

  test('citac ekrana ga vidi kao dugme', async () => {
    await prikazi(napraviNavigaciju({ mozeNazad: true }));

    const dugme = screen.getByLabelText('Nazad');
    expect(dugme.props.accessibilityRole).toBe('button');
  });

  // Stanje se ne sme zamrznuti pri prvom crtanju: isti ekran moze da izgubi
  // istoriju (povratak na koren), pa se pita pri svakom pritisku.
  test('pita za istoriju pri svakom pritisku, ne samo jednom', async () => {
    const navigation = napraviNavigaciju({ mozeNazad: true });
    await prikazi(navigation);

    const dugme = screen.getByLabelText('Nazad');
    fireEvent.press(dugme);
    navigation.canGoBack.mockReturnValue(false);
    fireEvent.press(dugme);

    expect(navigation.goBack).toHaveBeenCalledTimes(1);
    expect(navigation.navigate).toHaveBeenCalledWith('Tabs');
  });
});
