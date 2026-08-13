import { Linking, Platform } from 'react-native';

// Otvaranje telefona, mejla i mape. Izdvojeno iz ekrana da bi moglo da se
// testira bez rendera, jer je logika oko URL-ova platformski zavisna.

// Telefon se u linku mora ocistiti od razmaka i crtica ("021 123-456"), inace
// ga sistem ne prepozna kao broj.
export function telUrl(phone) {
  const clean = String(phone || '').replace(/[^\d+]/g, '');
  return clean ? `tel:${clean}` : null;
}

export function mailUrl(email) {
  const clean = String(email || '').trim();
  return clean ? `mailto:${clean}` : null;
}

// Koordinate stizu iz podesavanja kao tekst, pa mogu biti prazne ili
// pogresno unete. Bez ispravne dve vrednosti nema dugmeta za mapu - bolje
// nista nego dugme koje otvara pogresno mesto.
export function parseCoords(lat, lng) {
  const sirovoA = String(lat ?? '').trim();
  const sirovoB = String(lng ?? '').trim();

  // Prazan tekst se mora odbiti pre Number(): Number('') je 0, pa bi
  // obrisana koordinata u adminu tiho postala nula i dugme bi vodilo na
  // pogresno mesto umesto da nestane.
  if (!sirovoA || !sirovoB) return null;

  const a = Number(sirovoA);
  const b = Number(sirovoB);

  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  if (a < -90 || a > 90 || b < -180 || b > 180) return null;
  // Tacna nula na obe ose je skoro sigurno neunet podatak, a ne lokacija
  // usred Atlantika.
  if (a === 0 && b === 0) return null;

  return { lat: a, lng: b };
}

// iOS otvara Apple Maps, Android geo: semu koja pusta korisnika da izabere
// aplikaciju. `label` je ime koje se vidi na pribadaci.
export function mapsUrl(coords, label = '') {
  if (!coords) return null;

  const { lat, lng } = coords;
  const ime = encodeURIComponent(label || 'Kids club');

  return Platform.OS === 'ios'
    ? `http://maps.apple.com/?ll=${lat},${lng}&q=${ime}`
    : `geo:${lat},${lng}?q=${lat},${lng}(${ime})`;
}

// Otvara URL i javlja da li je uspelo.
//
// Vraca false kada sistem nema cime da otvori link: simulator nema aplikaciju
// Telefon, a uredjaj bez podesenog naloga nema gde da otvori mailto. Ranije se
// to gutalo nemo, pa se dodir koji nista ne uradi nije razlikovao od pokvarenog
// dugmeta - zato ekran sada na `false` javi korisniku.
export async function open(url) {
  if (!url) return false;
  try {
    if (!(await Linking.canOpenURL(url))) return false;
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}
