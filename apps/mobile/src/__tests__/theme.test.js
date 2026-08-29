import { type, font } from '../theme';

// Android po metrici fonta dodaje razmak iznad i ispod svakog reda, iOS ne. Sa
// tim razmakom isti tekst je na Androidu visi, pa brojevi u krugovima sede
// nize a polja za unos ispadnu visa nego na iPhone-u.
describe('Tipografija - isti tekst na oba sistema', () => {
  test('svi stilovi gase Android razmak oko teksta', () => {
    for (const [ime, stil] of Object.entries(type)) {
      expect({ ime, includeFontPadding: stil.includeFontPadding }).toEqual({
        ime,
        includeFontPadding: false,
      });
    }
  });

  // Na RN se tezina bira preko fontFamily: `fontWeight` uz Montserrat radi samo
  // na iOS-u, a na Androidu bi tekst ostao tanak.
  test('tezina ide preko fontFamily, ne preko fontWeight', () => {
    for (const [ime, stil] of Object.entries(type)) {
      expect({ ime, fontWeight: stil.fontWeight }).toEqual({ ime, fontWeight: undefined });
      expect(Object.values(font)).toContain(stil.fontFamily);
    }
  });
});
