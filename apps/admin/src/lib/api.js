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
export const del = (path) => api(path, { method: 'DELETE' });

// Upload ide kao multipart, bez Content-Type headera (browser ga sam postavi
// sa boundary-jem).
export async function uploadImage(file) {
  const form = new FormData();
  form.append('image', file);
  return api('/upload/image', { method: 'POST', body: form, raw: true });
}
