import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// expo-secure-store je native keychain API i ne radi na webu.
// Na webu se koristi localStorage (samo za dev pregled), na uredjaju SecureStore.
const isWeb = Platform.OS === 'web';

// Bez "Zapamti me" vrednost ne sme da nadzivi zatvaranje aplikacije. Telefon
// nema "sesiju kartice" kao pretrazivac, pa je ovde sesija jedno pokretanje:
// vrednost stoji samo u memoriji procesa i nestaje kad se aplikacija ugasi.
//
// Memorija ima prednost nad Keychain-om pri citanju, da prijava "samo za sada"
// pregazi token koji je od ranije ostao trajno zapisan.
const memorija = new Map();

export async function getItem(key) {
  if (memorija.has(key)) return memorija.get(key);

  if (isWeb) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }
  return SecureStore.getItemAsync(key);
}

// `trajno: false` znaci "do gasenja aplikacije".
export async function setItem(key, value, { trajno = true } = {}) {
  if (!trajno) {
    memorija.set(key, value);
    // Stara trajna vrednost mora da ode, inace bi se vratila pri sledecem
    // pokretanju i ponistila izbor da se prijava ne pamti.
    return obrisiTrajno(key);
  }

  memorija.delete(key);

  if (isWeb) {
    try {
      window.localStorage.setItem(key, value);
    } catch {}
    return;
  }
  return SecureStore.setItemAsync(key, value);
}

export async function deleteItem(key) {
  memorija.delete(key);
  return obrisiTrajno(key);
}

async function obrisiTrajno(key) {
  if (isWeb) {
    try {
      window.localStorage.removeItem(key);
    } catch {}
    return;
  }
  return SecureStore.deleteItemAsync(key);
}
