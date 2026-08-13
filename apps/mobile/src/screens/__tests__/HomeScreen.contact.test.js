import { Alert, Linking } from 'react-native';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import HomeScreen from '../HomeScreen';
import { apiRequest } from '../../utils/api';

jest.mock('../../utils/api', () => ({ apiRequest: jest.fn() }));

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (callback) => require('react').useEffect(callback, [callback]),
}));

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: { firstName: 'Test' } }),
}));

jest.mock('../../context/ClosedDaysContext', () => ({
  useClosedDays: () => ({
    closedDays: {},
    loading: false,
    reload: () => {},
    closedOn: () => null,
    isClosed: () => false,
  }),
}));

let mockPodesavanja = {};

jest.mock('../../context/SettingsContext', () => ({
  useSettings: () => ({ settings: mockPodesavanja }),
}));

const PUNA = {
  club_name: 'Igraonica Cika Mika',
  club_phone: '021 123-456',
  club_email: 'kontakt@igraonica.rs',
  club_address: 'Zmaj Jovina 5, Novi Sad',
  working_hours: '09:00 - 21:00',
  club_latitude: '45.267136',
  club_longitude: '19.833549',
  mobile_tab_gallery: 'false',
};

let openSpy;
let mozeSpy;

beforeEach(() => {
  mockPodesavanja = { ...PUNA };
  apiRequest.mockResolvedValue({});
  mozeSpy = jest.spyOn(Linking, 'canOpenURL').mockResolvedValue(true);
  openSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
  mozeSpy.mockClear();
  openSpy.mockClear();
});

afterEach(() => {
  jest.restoreAllMocks();
});

const prikazi = () => render(<HomeScreen navigation={{ navigate: jest.fn() }} />);

describe('Kontakt - podaci', () => {
  test('prikazuje sve podatke o igraonici', async () => {
    await prikazi();

    expect(screen.getByText('09:00 - 21:00')).toBeTruthy();
    expect(screen.getByText('021 123-456')).toBeTruthy();
    expect(screen.getByText('kontakt@igraonica.rs')).toBeTruthy();
    expect(screen.getByText('Zmaj Jovina 5, Novi Sad')).toBeTruthy();
  });

  test('svaki podatak ima svoj naziv', async () => {
    await prikazi();

    expect(screen.getByText('Radno vreme')).toBeTruthy();
    expect(screen.getByText('Telefon')).toBeTruthy();
    expect(screen.getByText('Email')).toBeTruthy();
    expect(screen.getByText('Adresa')).toBeTruthy();
  });

  // Prazno podesavanje ne sme da ostavi red sa praznom vrednoscu.
  test('nepopunjen podatak se ne prikazuje', async () => {
    mockPodesavanja = { ...PUNA, club_email: '', club_phone: '' };
    await prikazi();

    expect(screen.queryByText('Email')).toBeNull();
    expect(screen.queryByText('Telefon')).toBeNull();
    expect(screen.getByText('Adresa')).toBeTruthy();
  });
});

describe('Kontakt - dugme za mapu', () => {
  test('prikazuje se kada su koordinate unete', async () => {
    await prikazi();
    expect(screen.getByText('Prikazi na mapi')).toBeTruthy();
  });

  test('otvara mapu na tacnoj lokaciji', async () => {
    await prikazi();

    fireEvent.press(screen.getByLabelText('Prikazi igraonicu na mapi'));

    await waitFor(() =>
      expect(openSpy).toHaveBeenCalledWith(
        expect.stringContaining('45.267136,19.833549')
      )
    );
  });

  test('naziv igraonice ide uz pribadacu', async () => {
    await prikazi();

    fireEvent.press(screen.getByLabelText('Prikazi igraonicu na mapi'));

    await waitFor(() =>
      expect(openSpy).toHaveBeenCalledWith(
        expect.stringContaining('Igraonica%20Cika%20Mika')
      )
    );
  });

  test('nema dugmeta kada koordinate nisu unete', async () => {
    mockPodesavanja = { ...PUNA, club_latitude: '', club_longitude: '' };
    await prikazi();

    expect(screen.queryByText('Prikazi na mapi')).toBeNull();
  });

  // Poluprazan unos je najopasniji slucaj: dugme bi vodilo na pogresno mesto.
  test('nema dugmeta kada je uneta samo jedna koordinata', async () => {
    mockPodesavanja = { ...PUNA, club_longitude: '' };
    await prikazi();

    expect(screen.queryByText('Prikazi na mapi')).toBeNull();
  });

  test('nema dugmeta kada koordinate nisu brojevi', async () => {
    mockPodesavanja = { ...PUNA, club_latitude: 'negde', club_longitude: 'tamo' };
    await prikazi();

    expect(screen.queryByText('Prikazi na mapi')).toBeNull();
  });
});

describe('Kontakt - pozivanje i mejl', () => {
  test('dodir na telefon otvara pozivanje sa ociscenim brojem', async () => {
    await prikazi();

    fireEvent.press(screen.getByLabelText('Telefon: 021 123-456'));

    await waitFor(() => expect(openSpy).toHaveBeenCalledWith('tel:021123456'));
  });

  test('dodir na email otvara mejl', async () => {
    await prikazi();

    fireEvent.press(screen.getByLabelText('Email: kontakt@igraonica.rs'));

    await waitFor(() =>
      expect(openSpy).toHaveBeenCalledWith('mailto:kontakt@igraonica.rs')
    );
  });

  // Radno vreme i adresa nisu dugmad - ne vode nikuda.
  test('radno vreme nije dugme', async () => {
    await prikazi();

    expect(screen.queryByLabelText('Radno vreme: 09:00 - 21:00')).toBeNull();
  });
});

// Simulator nema aplikaciju Telefon, a uredjaj bez naloga nema gde da otvori
// mailto. Ranije je dodir u tom slucaju prolazio bez ikakvog traga, pa se nije
// razlikovao od pokvarenog dugmeta.
describe('Kontakt - kada sistem ne moze da otvori link', () => {
  let alertSpy;

  beforeEach(() => {
    mozeSpy.mockResolvedValue(false);
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  test('telefon javlja poruku umesto da cuti', async () => {
    await prikazi();

    fireEvent.press(screen.getByLabelText('Telefon: 021 123-456'));

    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    const [naslov, telo] = alertSpy.mock.calls[0];
    expect(naslov).toBe('Telefon');
    expect(telo).toContain('021 123-456');
    expect(openSpy).not.toHaveBeenCalled();
  });

  test('email javlja poruku i pokazuje adresu', async () => {
    await prikazi();

    fireEvent.press(screen.getByLabelText('Email: kontakt@igraonica.rs'));

    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    const [naslov, telo] = alertSpy.mock.calls[0];
    expect(naslov).toBe('Email');
    expect(telo).toContain('kontakt@igraonica.rs');
  });

  test('mapa javlja poruku sa adresom', async () => {
    await prikazi();

    fireEvent.press(screen.getByLabelText('Prikazi igraonicu na mapi'));

    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    expect(alertSpy.mock.calls[0][1]).toContain('Zmaj Jovina 5, Novi Sad');
  });

  // Kada sistem moze da otvori link, poruke nema - otvara se aplikacija.
  test('bez poruke kada otvaranje uspe', async () => {
    mozeSpy.mockResolvedValue(true);
    await prikazi();

    fireEvent.press(screen.getByLabelText('Telefon: 021 123-456'));

    await waitFor(() => expect(openSpy).toHaveBeenCalled());
    expect(alertSpy).not.toHaveBeenCalled();
  });
});
