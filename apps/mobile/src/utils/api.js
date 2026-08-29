import { NativeModules } from 'react-native';
import * as storage from './storage';

// Na pravom telefonu 'localhost' je sam telefon, pa server mora da se adresira
// preko mreze. Upisivanje IP adrese u .env.local radi samo dok se racunar ne
// prebaci na drugu mrezu - tada adresa ostaje da visi u prazno i svaki zahtev
// ceka do isteka, pa ekran zauvek stoji na spineru.
//
// Zato se adresa u razvoju izvodi iz adrese Metro servera: telefon i simulator
// vec razgovaraju sa racunarom bas preko nje, pa je po definiciji tacna i kad
// racunar promeni mrezu. EXPO_PUBLIC_API_URL i dalje ima prednost, za slucaj
// da server ne stoji na istom racunaru kao Metro.
// Izuzetak je pravi Android telefon na USB-u: Metro tamo stize preko
// `adb reverse` na localhost:8081, pa se i za server mora jednom pokrenuti
// `adb reverse tcp:3001 tcp:3001` - inace `localhost` opet znaci sam telefon.
// (Emulator nema taj problem: kod njega je racunar 10.0.2.2.)
const PORT = 3001;

function adresaServera() {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL;

  // U produkcijskom build-u scriptURL je file:// putanja i nema hosta.
  const scriptURL = NativeModules?.SourceCode?.getConstants?.().scriptURL;
  const host = /^https?:\/\/([^/:]+)/.exec(scriptURL || '')?.[1];

  return `http://${host || 'localhost'}:${PORT}/api`;
}

const API_URL = adresaServera();

// Slike koje osoblje okaci (promocije, objave) backend vraca kao putanju
// oblika "/uploads/ime.jpg". Telefonu treba puna adresa, a ona je ista kao
// adresa API-ja bez zavrsnog "/api".
export function mediaUrl(path) {
  if (!path) return null;
  if (/^https?:\/\//.test(path)) return path;
  return API_URL.replace(/\/api\/?$/, '') + path;
}

// Bez roka cekanja fetch ka nedostupnom hostu visi minutima. Ekrani se
// osvezavaju na 15s, pa bi se zahtevi gomilali a spiner se nikad ne bi sklonio.
const ROK_MS = 10000;

// Sta uraditi kada server kaze da token vise ne vazi. AuthContext ovde ostavlja
// svoju odjavu - sloj za pozive ne zna nista o React-u.
let naIstekluSesiju = null;

export function onSessionExpired(fn) {
  naIstekluSesiju = fn;
  return () => {
    if (naIstekluSesiju === fn) naIstekluSesiju = null;
  };
}

// Na ovim rutama 401 znaci "pogresan email ili lozinka", a ne "sesija je
// istekla" - backend vraca isti status za oba.
const RUTE_PRIJAVE = ['/auth/login', '/auth/register'];

export async function apiRequest(endpoint, options = {}) {
  const token = await storage.getItem('token');

  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
    ...options,
  };

  if (config.body && typeof config.body === 'object') {
    config.body = JSON.stringify(config.body);
  }

  const prekid = new AbortController();
  const tajmer = setTimeout(() => prekid.abort(), ROK_MS);

  let response;
  try {
    response = await fetch(`${API_URL}${endpoint}`, { signal: prekid.signal, ...config });
  } catch (err) {
    // Prekid po roku i pad mreze su za korisnika ista stvar: server se ne javlja.
    const greska = new Error(
      err?.name === 'AbortError'
        ? 'Server se ne javlja. Proverite vezu.'
        : 'Nema veze sa serverom.'
    );
    greska.cause = err;
    throw greska;
  } finally {
    clearTimeout(tajmer);
  }

  const data = await response.json();

  if (!response.ok) {
    // Token vazi 30 dana. Kada istekne - ili kada admin deaktivira nalog - bez
    // ovoga bi svaki ekran samo pisao "Greska na serveru", a roditelj ne bi imao
    // nikakav izlaz: token je u Keychain-u i nema dugmeta koje ga brise.
    if (response.status === 401 && !RUTE_PRIJAVE.includes(endpoint)) {
      await storage.deleteItem('token');
      naIstekluSesiju?.();
    }

    const error = new Error(data.message || 'Greska na serveru.');
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}
