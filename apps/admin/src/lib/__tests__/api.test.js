import { describe, test, expect, beforeEach, vi } from 'vitest';
import { api, get, post, patch, del, getToken, setToken, ApiError, uploadImage } from '../api';

// Odgovor servera se pravi rucno, da se ne zavisi od pravog backenda.
function odgovor({ ok = true, status = 200, body = {} } = {}) {
  return {
    ok,
    status,
    json: async () => {
      if (body === null) throw new Error('nema tela');
      return body;
    },
  };
}

beforeEach(() => {
  global.fetch = vi.fn().mockResolvedValue(odgovor());
});

describe('token', () => {
  test('cuva i cita token', () => {
    expect(getToken()).toBeNull();
    setToken('abc123');
    expect(getToken()).toBe('abc123');
  });

  test('prazna vrednost brise token', () => {
    setToken('abc123');
    setToken(null);
    expect(getToken()).toBeNull();
  });
});

describe('api', () => {
  test('gadja /api prefiks', async () => {
    await api('/menu');
    expect(fetch).toHaveBeenCalledWith('/api/menu', expect.anything());
  });

  test('salje Authorization kada token postoji', async () => {
    setToken('token-123');
    await api('/menu');

    const [, opcije] = fetch.mock.calls[0];
    expect(opcije.headers.Authorization).toBe('Bearer token-123');
  });

  test('bez tokena nema Authorization zaglavlja', async () => {
    await api('/menu');

    const [, opcije] = fetch.mock.calls[0];
    expect(opcije.headers.Authorization).toBeUndefined();
  });

  test('telo ide kao JSON', async () => {
    await post('/menu', { name: 'Pasulj' });

    const [, opcije] = fetch.mock.calls[0];
    expect(opcije.method).toBe('POST');
    expect(opcije.headers['Content-Type']).toBe('application/json');
    expect(opcije.body).toBe(JSON.stringify({ name: 'Pasulj' }));
  });

  test('GET nema telo ni Content-Type', async () => {
    await get('/menu');

    const [, opcije] = fetch.mock.calls[0];
    expect(opcije.body).toBeUndefined();
    expect(opcije.headers['Content-Type']).toBeUndefined();
  });

  test('patch i del salju ispravan metod', async () => {
    await patch('/menu/1', { name: 'Novo' });
    expect(fetch.mock.calls[0][1].method).toBe('PATCH');

    await del('/menu/1');
    expect(fetch.mock.calls[1][1].method).toBe('DELETE');
  });

  test('vraca telo odgovora', async () => {
    fetch.mockResolvedValue(odgovor({ body: { items: [1, 2] } }));
    await expect(get('/menu')).resolves.toEqual({ items: [1, 2] });
  });

  // Neke rute nemaju telo (204) - to ne sme da bude greska.
  test('odgovor bez tela ne puca', async () => {
    fetch.mockResolvedValue(odgovor({ status: 204, body: null }));
    await expect(get('/menu')).resolves.toBeNull();
  });
});

describe('greske', () => {
  test('koristi message sa backenda', async () => {
    fetch.mockResolvedValue(
      odgovor({ ok: false, status: 409, body: { message: 'Stavka vec postoji.' } })
    );

    await expect(get('/menu')).rejects.toThrow('Stavka vec postoji.');
  });

  // express-validator vraca listu gresaka; korisniku treba jedna recenica.
  test('spaja greske iz express-validator-a', async () => {
    fetch.mockResolvedValue(
      odgovor({
        ok: false,
        status: 400,
        body: { errors: [{ msg: 'Datum nije validan.' }, { msg: 'Naziv je obavezan.' }] },
      })
    );

    await expect(get('/menu')).rejects.toThrow('Datum nije validan. Naziv je obavezan.');
  });

  test('bez poruke pada na status', async () => {
    fetch.mockResolvedValue(odgovor({ ok: false, status: 500, body: {} }));
    await expect(get('/menu')).rejects.toThrow('Greska 500.');
  });

  test('greska nosi status', async () => {
    fetch.mockResolvedValue(odgovor({ ok: false, status: 401, body: { message: 'Nije prijavljen.' } }));

    await expect(get('/menu')).rejects.toBeInstanceOf(ApiError);
    await get('/menu').catch((e) => expect(e.status).toBe(401));
  });
});

describe('uploadImage', () => {
  // Content-Type se namerno ne postavlja - browser ga sam dodaje sa boundary-jem.
  test('salje FormData bez Content-Type zaglavlja', async () => {
    const file = new File(['x'], 'slika.png', { type: 'image/png' });
    await uploadImage(file);

    const [putanja, opcije] = fetch.mock.calls[0];
    expect(putanja).toBe('/api/upload/image');
    expect(opcije.headers['Content-Type']).toBeUndefined();
    expect(opcije.body).toBeInstanceOf(FormData);
    expect(opcije.body.get('image')).toBe(file);
  });
});
