import { render, screen, waitFor } from '@testing-library/react-native';
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
