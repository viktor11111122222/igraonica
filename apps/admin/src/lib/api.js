// Jedna tacka za sve pozive ka backendu. Vite proxy salje /api na :3001,
// pa ovde nema hardkodovanog hosta.

const TOKEN_KEY = 'igraonica_admin_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
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
