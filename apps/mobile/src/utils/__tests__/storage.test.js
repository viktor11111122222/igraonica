// Modul cita Platform.OS pri ucitavanju, pa se platforma mora namestiti pre
// nego sto se modul uveze. Uz to, `isolateModules` pravi svoj registar modula -
// SecureStore se zato uzima iz istog opsega, inace bi mock isao na drugu kopiju.
function ucitaj(os) {
  let modul;
  let SecureStore;
  jest.isolateModules(() => {
    jest.doMock('react-native', () => ({ Platform: { OS: os } }));
    modul = require('../storage');
    SecureStore = require('expo-secure-store');
  });
  return { storage: modul, SecureStore };
}

// jsdom nije deo jest-expo preseta, pa web grana dobija minimalni localStorage.
function postaviLocalStorage() {
  const mapa = new Map();
  const lager = {
    getItem: (k) => (mapa.has(k) ? mapa.get(k) : null),
    setItem: (k, v) => mapa.set(k, String(v)),
    removeItem: (k) => mapa.delete(k),
    clear: () => mapa.clear(),
  };
  Object.defineProperty(global, 'window', {
    configurable: true,
    writable: true,
    value: { localStorage: lager },
  });
  return lager;
}

describe('storage na uredjaju', () => {
  let storage;
  let SecureStore;

  beforeEach(() => {
    jest.resetModules();
    ({ storage, SecureStore } = ucitaj('ios'));
  });

  test('cita iz keychaina', async () => {
    SecureStore.getItemAsync.mockResolvedValue('token123');
    await expect(storage.getItem('token')).resolves.toBe('token123');
    expect(SecureStore.getItemAsync).toHaveBeenCalledWith('token');
  });

  test('upisuje u keychain', async () => {
    await storage.setItem('token', 'abc');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('token', 'abc');
  });

  test('brise iz keychaina', async () => {
    await storage.deleteItem('token');
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('token');
  });

  test('nepostojeci kljuc vraca null', async () => {
    SecureStore.getItemAsync.mockResolvedValue(null);
    await expect(storage.getItem('nema')).resolves.toBeNull();
  });
});

// SecureStore je nativni keychain i na webu ne postoji.
describe('storage na webu', () => {
  let storage;

  beforeEach(() => {
    jest.resetModules();
    postaviLocalStorage();
    ({ storage } = ucitaj('web'));
  });

  test('cuva i cita iz localStorage', async () => {
    await storage.setItem('token', 'abc');
    await expect(storage.getItem('token')).resolves.toBe('abc');
  });

  test('brisanje uklanja kljuc', async () => {
    await storage.setItem('token', 'abc');
    await storage.deleteItem('token');
    await expect(storage.getItem('token')).resolves.toBeNull();
  });

  // Privatni rezim pregledaca ume da zabrani pristup - aplikacija tada mora da
  // nastavi bez pamcenja, ne da padne.
  test('nedostupan localStorage ne obara aplikaciju', async () => {
    Object.defineProperty(global.window, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('nedostupan');
      },
    });

    await expect(storage.getItem('token')).resolves.toBeNull();
    await expect(storage.setItem('token', 'x')).resolves.toBeUndefined();
    await expect(storage.deleteItem('token')).resolves.toBeUndefined();
  });
});
