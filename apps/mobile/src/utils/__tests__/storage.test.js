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

// "Zapamti me": trajno u Keychain / localStorage, privremeno samo u memoriju,
// gde nestane cim se aplikacija ugasi.
describe('privremeno cuvanje (bez "Zapamti me")', () => {
  test('na uredjaju ne dira Keychain', async () => {
    const { storage, SecureStore } = ucitaj('ios');

    await storage.setItem('token', 'kratki', { trajno: false });

    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
    await expect(storage.getItem('token')).resolves.toBe('kratki');
  });

  test('na webu ne dira localStorage', async () => {
    const lager = postaviLocalStorage();
    const { storage } = ucitaj('web');

    await storage.setItem('token', 'kratki', { trajno: false });

    expect(lager.getItem('token')).toBeNull();
    await expect(storage.getItem('token')).resolves.toBe('kratki');
  });

  // Inace bi se pri sledecem pokretanju vratio stari trajni token i ponistio
  // izbor da se prijava ne pamti.
  test('brise raniju trajnu vrednost', async () => {
    const { storage, SecureStore } = ucitaj('ios');
    SecureStore.getItemAsync.mockResolvedValue('stari-trajni');

    await storage.setItem('token', 'kratki', { trajno: false });

    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('token');
  });

  test('privremena vrednost ima prednost nad trajnom', async () => {
    const { storage, SecureStore } = ucitaj('ios');
    SecureStore.getItemAsync.mockResolvedValue('trajni');

    await storage.setItem('token', 'privremeni', { trajno: false });

    await expect(storage.getItem('token')).resolves.toBe('privremeni');
  });

  test('trajno cuvanje posle privremenog pregazi memoriju', async () => {
    const { storage, SecureStore } = ucitaj('ios');
    SecureStore.getItemAsync.mockResolvedValue('trajni');

    await storage.setItem('token', 'privremeni', { trajno: false });
    await storage.setItem('token', 'trajni', { trajno: true });

    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('token', 'trajni');
    await expect(storage.getItem('token')).resolves.toBe('trajni');
  });

  test('brisanje cisti i memoriju i trajno skladiste', async () => {
    const { storage, SecureStore } = ucitaj('ios');
    SecureStore.getItemAsync.mockResolvedValue(null);

    await storage.setItem('token', 'privremeni', { trajno: false });
    await storage.deleteItem('token');

    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('token');
    await expect(storage.getItem('token')).resolves.toBeNull();
  });

  test('podrazumevano je i dalje trajno', async () => {
    const { storage, SecureStore } = ucitaj('ios');

    await storage.setItem('token', 'podrazumevani');

    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('token', 'podrazumevani');
  });
});
