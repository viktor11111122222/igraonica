// Jedna tacka za sve pozive ka backendu. Vite proxy salje /api na :3001,
// pa ovde nema hardkodovanog hosta.

const TOKEN_KEY = 'igraonica_admin_token';
const EMAIL_KEY = 'igraonica_admin_email';

// Gde token zivi zavisi od "Zapamti me":
//
//   localStorage   - prezivi zatvaranje pretrazivaca (kvacica je ukljucena)
//   sessionStorage - nestane cim se kartica zatvori (podrazumevano)
//
// Racunar na recepciji deli vise ljudi, pa je kratka sesija podrazumevano
// ponasanje: ko ustane od stola, ne ostavlja otvoren panel sledecem. Duzina
// samog tokena je posebna prica i nju odredjuje backend - brisanje iz
// pretrazivaca ne ponistava token, pa bi trajan token u kratkoj sesiji i dalje
// vazio da ga neko prepise.
export function getToken() {
  // Sesija kartice ima prednost: ako se neko prijavio "samo za sada" dok je u
  // localStorage ostao tudji stariji token, vazi onaj noviji.
  return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY);
}

export function setToken(token, { trajno = false } = {}) {
  // Uvek se cisti i jedno i drugo: inace bi posle odjave ostao token u onom
  // skladistu koje ovaj poziv ne dodiruje.
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);

  if (!token) return;
  (trajno ? localStorage : sessionStorage).setItem(TOKEN_KEY, token);
}

// Email se pamti odvojeno od tokena, da bi polje bilo popunjeno i kada sesija
// istekne. Lozinka se NE pamti nigde - OWASP to izricito navodi kao propust
// ("Testing for Vulnerable Remember Password").
export function getRememberedEmail() {
  return localStorage.getItem(EMAIL_KEY) || '';
}

export function setRememberedEmail(email) {
  if (email) localStorage.setItem(EMAIL_KEY, email);
  else localStorage.removeItem(EMAIL_KEY);
}

// Baca ApiError sa porukom sa backenda. Backend vraca ili { message } ili
// { errors: [{ msg }] } iz express-validator-a - spajamo oba u jednu poruku.
export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

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

export async function api(path, { method = 'GET', body, raw } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body && !raw) headers['Content-Type'] = 'application/json';

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: raw ? body : body ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    // Neke rute (npr. 204) nemaju telo.
  }

  if (!res.ok) {
    // Istekao token ili deaktiviran nalog: bez ovoga bi svaki sledeci zahtev
    // pucao istom greskom, a jedini izlaz bilo bi rucno brisanje localStorage.
    if (res.status === 401 && !RUTE_PRIJAVE.includes(path)) {
      setToken(null);
      naIstekluSesiju?.();
    }

    const message =
      data?.errors?.map((e) => e.msg).join(' ') ||
      data?.message ||
      `Greska ${res.status}.`;
    throw new ApiError(message, res.status);
  }

  return data;
}

export const get = (path) => api(path);
export const post = (path, body) => api(path, { method: 'POST', body });
export const patch = (path, body) => api(path, { method: 'PATCH', body });
export const del = (path, body) => api(path, { method: 'DELETE', body });

// Upload ide kao multipart, bez Content-Type headera (browser ga sam postavi
// sa boundary-jem).
export async function uploadImage(file) {
  const form = new FormData();
  form.append('image', file);
  return api('/upload/image', { method: 'POST', body: form, raw: true });
}
