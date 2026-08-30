import { apiRequest, mediaUrl, onSessionExpired } from '../api';
import * as storage from '../storage';

jest.mock('../storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  deleteItem: jest.fn(),
}));

function odgovor({ ok = true, status = 200, body = {} } = {}) {
  return { ok, status, json: async () => body };
}

beforeEach(() => {
  jest.clearAllMocks();
  storage.getItem.mockResolvedValue(null);
  global.fetch = jest.fn().mockResolvedValue(odgovor());
});

describe('apiRequest - oblik zahteva', () => {
  test('gadja podesenu adresu servera', async () => {
    await apiRequest('/children');
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/children'),
      expect.anything()
    );
  });

  test('bez tokena nema Authorization zaglavlja', async () => {
    await apiRequest('/menu');
    expect(fetch.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });

  test('sa tokenom salje Bearer', async () => {
    storage.getItem.mockResolvedValue('abc123');
    await apiRequest('/children');
    expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer abc123');
  });

  test('objekat u telu se pretvara u JSON', async () => {
    await apiRequest('/children', { method: 'POST', body: { firstName: 'Lena' } });

    const poziv = fetch.mock.calls[0][1];
    expect(poziv.method).toBe('POST');
    expect(poziv.body).toBe('{"firstName":"Lena"}');
    expect(poziv.headers['Content-Type']).toBe('application/json');
  });

  test('vec pripremljen tekst se ne pakuje ponovo', async () => {
    await apiRequest('/children', { method: 'POST', body: '{"vec":"tekst"}' });
    expect(fetch.mock.calls[0][1].body).toBe('{"vec":"tekst"}');
  });

  test('odgovor se vraca kao objekat', async () => {
    fetch.mockResolvedValue(odgovor({ body: { children: [{ id: 'c1' }] } }));
    await expect(apiRequest('/children')).resolves.toEqual({ children: [{ id: 'c1' }] });
  });
});

describe('apiRequest - greske', () => {
  test('poruka sa servera stize do pozivaoca', async () => {
    fetch.mockResolvedValue(odgovor({ ok: false, status: 400, body: { message: 'Ime je obavezno.' } }));
    await expect(apiRequest('/children', { method: 'POST' })).rejects.toThrow('Ime je obavezno.');
  });

  test('bez poruke sa servera ide opsta', async () => {
    fetch.mockResolvedValue(odgovor({ ok: false, status: 500, body: {} }));
    await expect(apiRequest('/children')).rejects.toThrow('Greska na serveru.');
  });

  test('greska nosi status i telo odgovora', async () => {
    fetch.mockResolvedValue(
      odgovor({ ok: false, status: 409, body: { message: 'Vec prijavljen.', visit: { id: 'v1' } } })
    );

    await expect(apiRequest('/visits/check-in', { method: 'POST' })).rejects.toMatchObject({
      status: 409,
      data: { visit: { id: 'v1' } },
    });
  });
});

// Token vazi 30 dana. Kada istekne, roditelj nema nikakav izlaz - token je u
// Keychain-u i nema dugmeta koje ga brise.
describe('apiRequest - istekla sesija', () => {
  test('401 brise token', async () => {
    fetch.mockResolvedValue(odgovor({ ok: false, status: 401, body: { message: 'Nevazeci token.' } }));

    await expect(apiRequest('/children')).rejects.toThrow();

    expect(storage.deleteItem).toHaveBeenCalledWith('token');
  });

  test('401 javlja da je sesija istekla', async () => {
    const javi = jest.fn();
    const odjavi = onSessionExpired(javi);
    fetch.mockResolvedValue(odgovor({ ok: false, status: 401, body: {} }));

    await expect(apiRequest('/children')).rejects.toThrow();

    expect(javi).toHaveBeenCalledTimes(1);
    odjavi();
  });

  // Backend vraca 401 i za pogresnu lozinku. Da se to pomesa, neuspela prijava
  // bi izgledala kao istekla sesija.
  test('pogresna lozinka nije istekla sesija', async () => {
    const javi = jest.fn();
    const odjavi = onSessionExpired(javi);
    fetch.mockResolvedValue(
      odgovor({ ok: false, status: 401, body: { message: 'Pogresan email ili lozinka.' } })
    );

    await expect(
      apiRequest('/auth/login', { method: 'POST', body: { email: 'a@b.c', password: 'x' } })
    ).rejects.toThrow('Pogresan email ili lozinka.');

    expect(javi).not.toHaveBeenCalled();
    expect(storage.deleteItem).not.toHaveBeenCalled();
    odjavi();
  });

  test('neuspela registracija ne obara sesiju', async () => {
    const javi = jest.fn();
    const odjavi = onSessionExpired(javi);
    fetch.mockResolvedValue(odgovor({ ok: false, status: 401, body: {} }));

    await expect(apiRequest('/auth/register', { method: 'POST', body: {} })).rejects.toThrow();

    expect(javi).not.toHaveBeenCalled();
    odjavi();
  });

  test('403 nije istekla sesija', async () => {
    const javi = jest.fn();
    const odjavi = onSessionExpired(javi);
    fetch.mockResolvedValue(odgovor({ ok: false, status: 403, body: { message: 'Nemate dozvolu.' } }));

    await expect(apiRequest('/users')).rejects.toThrow('Nemate dozvolu.');

    expect(javi).not.toHaveBeenCalled();
    expect(storage.deleteItem).not.toHaveBeenCalled();
    odjavi();
  });

  test('odjava sa osluskivanja prestaje da javlja', async () => {
    const javi = jest.fn();
    onSessionExpired(javi)();
    fetch.mockResolvedValue(odgovor({ ok: false, status: 401, body: {} }));

    await expect(apiRequest('/children')).rejects.toThrow();

    expect(javi).not.toHaveBeenCalled();
  });
});

// Slike koje osoblje okaci backend vraca kao putanju ("/uploads/ime.jpg"), a
// telefonu treba puna adresa - inace baner ostane prazan.
describe('mediaUrl', () => {
  test('relativnu putanju spaja sa adresom servera', () => {
    const url = mediaUrl('/uploads/leto.jpg');

    expect(url).toMatch(/^https?:\/\/.+\/uploads\/leto\.jpg$/);
    // Bez zavrsnog "/api" - slike ne stoje iza API putanje.
    expect(url).not.toContain('/api/uploads');
  });

  test('punu adresu ostavlja kakva jeste', () => {
    expect(mediaUrl('https://cdn.primer.rs/slika.jpg')).toBe('https://cdn.primer.rs/slika.jpg');
  });

  test('bez putanje vraca null', () => {
    expect(mediaUrl(null)).toBeNull();
    expect(mediaUrl('')).toBeNull();
  });
});

// Server koji ne odgovara i pad mreze su za roditelja ista stvar, ali poruka
// mora da bude ljudska - bez ovoga ekran pise "AbortError" ili "JSON Parse
// error".
describe('apiRequest - kad server ne odgovori kako treba', () => {
  test('istek roka javlja da se server ne javlja', async () => {
    global.fetch = jest.fn().mockRejectedValue(
      Object.assign(new Error('Aborted'), { name: 'AbortError' })
    );

    await expect(apiRequest('/schedule')).rejects.toThrow('Server se ne javlja');
  });

  test('pad mreze javlja da nema veze', async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError('Network request failed'));

    await expect(apiRequest('/schedule')).rejects.toThrow('Nema veze sa serverom');
  });

  // Proxy ume da vrati HTML stranicu greske; ranije je to izlazilo kao
  // "JSON Parse error".
  test('odgovor koji nije JSON ne prolazi kao greska u parsiranju', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => {
        throw new SyntaxError('Unexpected token <');
      },
    });

    await expect(apiRequest('/schedule')).rejects.toThrow('Greska na serveru.');
  });

  test('uspesan odgovor bez tela ne obara poziv', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError('Unexpected end of JSON input');
      },
    });

    await expect(apiRequest('/schedule')).rejects.toThrow('Neocekivan odgovor servera.');
  });
});
