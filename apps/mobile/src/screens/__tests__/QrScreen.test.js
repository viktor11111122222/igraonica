import { render, screen, waitFor, fireEvent } from '@testing-library/react-native';
import * as Brightness from 'expo-brightness';
import QRCodeLib from 'qrcode';
import QrScreen from '../QrScreen';
import { apiRequest } from '../../utils/api';

jest.mock('../../utils/api', () => ({ apiRequest: jest.fn() }));

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (callback) => require('react').useEffect(callback, [callback]),
}));

// Prava komponenta crta SVG; ovde je dovoljno zadrzati proslede propse, jer se
// bas oni proveravaju.
let propsKoda;

jest.mock('react-native-qrcode-svg', () => {
  const { Text } = require('react-native');
  return function LazniQRCode(props) {
    propsKoda = props;
    return <Text testID="qr">{props.value}</Text>;
  };
});

const dete = {
  id: 'c1',
  firstName: 'Vuk',
  lastName: 'Jovanovic',
  qrCode: 'IGR-00021641',
  dateOfBirth: '2019-04-26',
  allergies: null,
};

const navigation = { navigate: jest.fn(), setParams: jest.fn() };

beforeEach(() => {
  propsKoda = undefined;
  apiRequest.mockResolvedValue({ children: [dete] });
});

async function prikazi() {
  render(<QrScreen navigation={navigation} route={{ params: {} }} />);
  await waitFor(() => expect(screen.getByTestId('qr')).toBeTruthy());
}

describe('QrScreen - sadrzaj koda', () => {
  test('u kod ide tacno QR kod deteta, bez ukrasa', async () => {
    await prikazi();
    expect(propsKoda.value).toBe(dete.qrCode);
  });
});

// Ovo je jedini deo aplikacije koji rucni citac uopste vidi. Standard trazi
// belu marginu ("quiet zone") od bar cetiri modula; bez nje mnogi imageri ne
// nadju ivicu koda. Kamera telefona je tolerantnija, pa greska ne bi bila
// vidljiva sve dok se ne proba pravim citacem.
describe('QrScreen - da li citac moze da procita kod', () => {
  test('bela margina je bar cetiri modula', async () => {
    await prikazi();

    const { size, quietZone, ecl } = propsKoda;
    const matrica = QRCodeLib.create(dete.qrCode, { errorCorrectionLevel: ecl });
    const modul = (size - 2 * quietZone) / matrica.modules.size;

    expect(quietZone / modul).toBeGreaterThanOrEqual(4);
  });

  test('nivo ispravke ne gura kod u gusciju mrezu', async () => {
    await prikazi();

    const { ecl } = propsKoda;
    const izabrani = QRCodeLib.create(dete.qrCode, { errorCorrectionLevel: ecl });
    const podrazumevani = QRCodeLib.create(dete.qrCode, { errorCorrectionLevel: 'M' });

    // Vise ispravke je dobrodoslo samo dok mreza ostaje ista - gusca mreza
    // znaci sitnije module, sto citacu odmaze vise nego sto mu ispravka pomaze.
    expect(izabrani.modules.size).toBeLessThanOrEqual(podrazumevani.modules.size);
    expect(['Q', 'H']).toContain(ecl);
  });
});

// Isti kod i prijavljuje i odjavljuje dete. Roditelj koji ga pokazuje mora da
// vidi u kom je stanju - inace ne zna sta ce skeniranje uraditi.
describe('QrScreen - stanje deteta', () => {
  test('dete koje nije unutra to i kaze', async () => {
    apiRequest.mockResolvedValue({ children: [{ ...dete, activeVisit: null }] });
    await prikazi();

    expect(screen.getByText('Nije u igraonici')).toBeTruthy();
    expect(screen.getByText('Pokazite kod na recepciji za prijavu.')).toBeTruthy();
  });

  test('prijavljeno dete pokazuje od kada je unutra', async () => {
    apiRequest.mockResolvedValue({
      children: [
        { ...dete, activeVisit: { id: 'v1', checkedInAt: '2026-08-22T15:22:00' } },
      ],
    });
    await prikazi();

    expect(screen.getByText(/U igraonici od 15[:.]22/)).toBeTruthy();
  });

  // Ovo je ono zbog cega traka postoji: da roditelj zna sta sledi.
  test('prijavljenom detetu pise da ga sledece skeniranje odjavljuje', async () => {
    apiRequest.mockResolvedValue({
      children: [
        { ...dete, activeVisit: { id: 'v1', checkedInAt: '2026-08-22T15:22:00' } },
      ],
    });
    await prikazi();

    expect(
      screen.getByText('Sledece skeniranje odjavljuje dete i obracunava vreme.')
    ).toBeTruthy();
  });
});

// Pad mreze je ranije upisivao praznu listu, pa je roditelj sa troje dece
// dobijao ekran "Nemate dodatu decu" i poziv da doda dete.
describe('QrScreen - kad podaci ne stignu', () => {
  test('greska se javlja kao greska, ne kao prazan spisak', async () => {
    apiRequest.mockRejectedValue(new Error('Nema veze sa serverom.'));
    await render(<QrScreen navigation={navigation} route={{ params: {} }} />);

    expect(await screen.findByText('Podaci nisu stigli')).toBeTruthy();
    expect(screen.getByText('Nema veze sa serverom.')).toBeTruthy();
    expect(screen.queryByText('Nemate dodatu decu')).toBeNull();
  });

  test('nudi ponovni pokusaj', async () => {
    apiRequest.mockRejectedValue(new Error('Nema veze sa serverom.'));
    await render(<QrScreen navigation={navigation} route={{ params: {} }} />);
    await screen.findByText('Podaci nisu stigli');

    apiRequest.mockResolvedValue({ children: [dete] });
    fireEvent.press(screen.getByText('Pokusaj ponovo'));

    await waitFor(() => expect(screen.getByTestId('qr')).toBeTruthy());
  });

  // Roditelj koji stvarno nema decu i dalje dobija poziv da ga doda.
  test('prazan spisak bez greske i dalje poziva da se doda dete', async () => {
    apiRequest.mockResolvedValue({ children: [] });
    await render(<QrScreen navigation={navigation} route={{ params: {} }} />);

    expect(await screen.findByText('Nemate dodatu decu')).toBeTruthy();
  });
});

// Kod se cita sa ekrana; na prigusenom ekranu ga citac tesko hvata.
describe('QrScreen - osvetljenost ekrana', () => {
  test('ekran se pojacava dok je kod otvoren', async () => {
    await prikazi();
    expect(Brightness.setBrightnessAsync).toHaveBeenCalledWith(1);
  });

  test('po izlasku se vraca sistemska osvetljenost', async () => {
    const { unmount } = await render(<QrScreen navigation={navigation} route={{ params: {} }} />);
    await waitFor(() => expect(screen.getByTestId('qr')).toBeTruthy());

    unmount();
    expect(Brightness.restoreSystemBrightnessAsync).toHaveBeenCalled();
  });
});
