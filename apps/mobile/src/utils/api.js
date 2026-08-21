import * as storage from './storage';

// Na pravom telefonu 'localhost' je sam telefon, pa adresa servera stize
// kroz EXPO_PUBLIC_API_URL (vidi .env.local). Na simulatoru/webu ostaje localhost.
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001/api';

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

  const response = await fetch(`${API_URL}${endpoint}`, config);
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
