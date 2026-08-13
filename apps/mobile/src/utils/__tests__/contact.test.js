import { Linking, Platform } from 'react-native';
import { telUrl, mailUrl, parseCoords, mapsUrl, open } from '../contact';

describe('telUrl', () => {
  test('cisti razmake i crtice iz broja', () => {
    expect(telUrl('021 123-456')).toBe('tel:021123456');
    expect(telUrl('+381 21 123 456')).toBe('tel:+38121123456');
  });

  test('prazna vrednost daje null', () => {
    expect(telUrl('')).toBeNull();
    expect(telUrl(null)).toBeNull();
    expect(telUrl(undefined)).toBeNull();
  });

  test('tekst bez ijedne cifre daje null', () => {
    expect(telUrl('nema broja')).toBeNull();
  });
});

describe('mailUrl', () => {
  test('pravi mailto link', () => {
    expect(mailUrl('kontakt@igraonica.rs')).toBe('mailto:kontakt@igraonica.rs');
  });

  test('cisti razmake oko adrese', () => {
    expect(mailUrl('  kontakt@igraonica.rs  ')).toBe('mailto:kontakt@igraonica.rs');
  });

  test('prazna vrednost daje null', () => {
    expect(mailUrl('')).toBeNull();
    expect(mailUrl('   ')).toBeNull();
    expect(mailUrl(null)).toBeNull();
  });
});

describe('parseCoords', () => {
  // Koordinate stizu iz podesavanja kao tekst.
  test('cita brojeve iz teksta', () => {
    expect(parseCoords('45.267136', '19.833549')).toEqual({
      lat: 45.267136,
      lng: 19.833549,
    });
  });

  test('podnosi razmake', () => {
    expect(parseCoords(' 45.26 ', ' 19.83 ')).toEqual({ lat: 45.26, lng: 19.83 });
  });

  test('prihvata negativne vrednosti', () => {
    expect(parseCoords('-33.86', '151.2')).toEqual({ lat: -33.86, lng: 151.2 });
  });

  test('prazna vrednost daje null', () => {
    expect(parseCoords('', '')).toBeNull();
    expect(parseCoords('45.26', '')).toBeNull();
    expect(parseCoords(null, null)).toBeNull();
    expect(parseCoords(undefined, undefined)).toBeNull();
  });

  test('tekst koji nije broj daje null', () => {
    expect(parseCoords('negde', 'tamo')).toBeNull();
  });

  test('vrednosti van opsega daju null', () => {
    expect(parseCoords('91', '19.83')).toBeNull();
    expect(parseCoords('45.26', '181')).toBeNull();
    expect(parseCoords('-91', '0')).toBeNull();
  });

  // Nula na obe ose je skoro sigurno neunet podatak, a ne mesto u okeanu.
  test('nula na obe ose daje null', () => {
    expect(parseCoords('0', '0')).toBeNull();
  });

  test('nula na samo jednoj osi je ispravna', () => {
    expect(parseCoords('0', '19.83')).toEqual({ lat: 0, lng: 19.83 });
  });
});

describe('mapsUrl', () => {
  afterEach(() => {
    Platform.OS = 'ios';
  });

  test('bez koordinata nema linka', () => {
    expect(mapsUrl(null)).toBeNull();
  });

  test('na iOS-u otvara Apple Maps', () => {
    Platform.OS = 'ios';
    expect(mapsUrl({ lat: 45.26, lng: 19.83 }, 'Igraonica')).toBe(
      'http://maps.apple.com/?ll=45.26,19.83&q=Igraonica'
    );
  });

  test('na Androidu koristi geo semu', () => {
    Platform.OS = 'android';
    expect(mapsUrl({ lat: 45.26, lng: 19.83 }, 'Igraonica')).toBe(
      'geo:45.26,19.83?q=45.26,19.83(Igraonica)'
    );
  });

  test('ime se enkodira, razmaci ne kvare link', () => {
    Platform.OS = 'ios';
    expect(mapsUrl({ lat: 45.26, lng: 19.83 }, 'Igraonica Cika Mika')).toContain(
      'q=Igraonica%20Cika%20Mika'
    );
  });

  test('bez imena koristi podrazumevano', () => {
    Platform.OS = 'ios';
    expect(mapsUrl({ lat: 45.26, lng: 19.83 })).toContain('q=Kids%20club');
  });
});

describe('open', () => {
  // Spy se pravi jednom i cisti pred svaki test. Ponovni jest.spyOn nad vec
  // zamenjenom metodom vraca isti mock, pa bi se pozivi prelivali iz testa u
  // test i "ne sme da pozove" bi video tudji poziv.
  let spy;
  let moze;

  beforeEach(() => {
    // open() prvo pita sistem moze li da otvori link, pa i to mora da se
    // zameni - inace test zavisi od toga sta okruzenje podrzava.
    moze = jest.spyOn(Linking, 'canOpenURL').mockResolvedValue(true);
    spy = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    moze.mockClear();
    spy.mockClear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('otvara prosledjeni link', async () => {
    await expect(open('tel:021123456')).resolves.toBe(true);
    expect(spy).toHaveBeenCalledWith('tel:021123456');
  });

  test('prazan link se ne otvara', async () => {
    await expect(open(null)).resolves.toBe(false);
    expect(spy).not.toHaveBeenCalled();
  });

  // Simulator nema telefon - neuhvacena greska bi srusila ekran.
  test('greska sistema ne puca, vraca false', async () => {
    spy.mockRejectedValue(new Error('nema aplikacije'));

    await expect(open('tel:021123456')).resolves.toBe(false);
  });

  // Simulator nema aplikaciju Telefon: canOpenURL vrati false. Ranije se to
  // gutalo nemo, pa je dodir izgledao kao pokvareno dugme.
  test('kada sistem ne moze da otvori link, ne pokusava i vraca false', async () => {
    moze.mockResolvedValue(false);

    await expect(open('tel:021123456')).resolves.toBe(false);
    expect(spy).not.toHaveBeenCalled();
  });
});
