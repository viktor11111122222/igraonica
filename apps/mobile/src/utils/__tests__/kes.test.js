import { kesiraj, ponisti, stanje, NAJVISE_KLJUCEVA } from '../kes';

// Odlozeni odgovor, da se moze uhvatiti trenutak dok je zahtev jos u letu.
function odlozi(vrednost) {
  let pusti;
  const obecanje = new Promise((r) => {
    pusti = () => r(vrednost);
  });
  return { obecanje, pusti };
}

beforeEach(() => {
  ponisti();
  jest.useRealTimers();
});

describe('kes - pamcenje', () => {
  test('drugi poziv ne ide na mrezu', async () => {
    const donesi = jest.fn().mockResolvedValue({ a: 1 });

    expect(await kesiraj('/menu', donesi)).toEqual({ a: 1 });
    expect(await kesiraj('/menu', donesi)).toEqual({ a: 1 });

    expect(donesi).toHaveBeenCalledTimes(1);
  });

  test('razliciti kljucevi se ne mesaju', async () => {
    await kesiraj('/menu', async () => 'jelovnik');
    await kesiraj('/schedule', async () => 'raspored');

    expect(await kesiraj('/menu', async () => 'novo')).toBe('jelovnik');
    expect(await kesiraj('/schedule', async () => 'novo')).toBe('raspored');
  });

  test('upit je deo kljuca', async () => {
    const donesi = jest.fn(async () => 'x');

    await kesiraj('/menu?date=2026-09-20', donesi);
    await kesiraj('/menu?date=2026-09-21', donesi);

    expect(donesi).toHaveBeenCalledTimes(2);
  });

  test('posle isteka roka se ponovo pita server', async () => {
    const donesi = jest.fn().mockResolvedValue('staro');

    await kesiraj('/menu', donesi, { trajanje: 10 });
    await new Promise((r) => setTimeout(r, 25));
    await kesiraj('/menu', donesi, { trajanje: 10 });

    expect(donesi).toHaveBeenCalledTimes(2);
  });
});

describe('kes - zahtevi u letu', () => {
  test('dva istovremena poziva dele jedan zahtev', async () => {
    const { obecanje, pusti } = odlozi({ a: 1 });
    const donesi = jest.fn(() => obecanje);

    const prvi = kesiraj('/menu', donesi);
    const drugi = kesiraj('/menu', donesi);
    pusti();

    expect(await prvi).toEqual({ a: 1 });
    expect(await drugi).toEqual({ a: 1 });
    expect(donesi).toHaveBeenCalledTimes(1);
  });

  test('posle zavrsetka nista ne ostaje u letu', async () => {
    await kesiraj('/menu', async () => 'x');
    expect(stanje().uLetu).toBe(0);
  });
});

describe('kes - greske se ne pamte', () => {
  test('neuspeh se propusta pozivaocu', async () => {
    await expect(kesiraj('/menu', async () => { throw new Error('Puklo.'); })).rejects.toThrow(
      'Puklo.'
    );
  });

  test('posle neuspeha sledeci poziv ponovo proba', async () => {
    const donesi = jest
      .fn()
      .mockRejectedValueOnce(new Error('Puklo.'))
      .mockResolvedValueOnce('uspelo');

    await expect(kesiraj('/menu', donesi)).rejects.toThrow('Puklo.');
    expect(await kesiraj('/menu', donesi)).toBe('uspelo');
    expect(donesi).toHaveBeenCalledTimes(2);
  });

  test('neuspeh ne ostaje u letu', async () => {
    await expect(kesiraj('/menu', async () => { throw new Error('Puklo.'); })).rejects.toThrow();
    expect(stanje().uLetu).toBe(0);
  });

  test('oba cekaoca dobiju istu gresku', async () => {
    const donesi = jest.fn(() => Promise.reject(new Error('Puklo.')));

    const prvi = kesiraj('/menu', donesi);
    const drugi = kesiraj('/menu', donesi);

    await expect(prvi).rejects.toThrow('Puklo.');
    await expect(drugi).rejects.toThrow('Puklo.');
    expect(donesi).toHaveBeenCalledTimes(1);
  });
});

describe('kes - ponistavanje', () => {
  test('bez argumenta brise sve', async () => {
    await kesiraj('/menu', async () => 'a');
    await kesiraj('/schedule', async () => 'b');

    ponisti();

    expect(stanje().zapisa).toBe(0);
  });

  test('sa prefiksom brise samo svoje', async () => {
    await kesiraj('/menu?date=1', async () => 'a');
    await kesiraj('/menu?date=2', async () => 'b');
    await kesiraj('/schedule', async () => 'c');

    ponisti('/menu');

    expect(await kesiraj('/schedule', async () => 'novo')).toBe('c');
    expect(await kesiraj('/menu?date=1', async () => 'novo')).toBe('novo');
  });

  // Ovo je najvazniji slucaj: zahtev je krenuo PRE izmene, a vratio se POSLE
  // nje. Njegov odgovor je zastareo i ne sme da zavrsi u kesu.
  test('odgovor koji je krenuo pre izmene se ne pamti', async () => {
    const { obecanje, pusti } = odlozi('staro');
    const prvi = kesiraj('/packages/my', () => obecanje);

    // U medjuvremenu stigne izmena (npr. prijava deteta).
    ponisti();

    pusti();
    await prvi;

    // Kes mora biti prazan, pa sledeci poziv ide na server.
    expect(stanje().zapisa).toBe(0);
    const donesi = jest.fn().mockResolvedValue('novo');
    expect(await kesiraj('/packages/my', donesi)).toBe('novo');
    expect(donesi).toHaveBeenCalledTimes(1);
  });

  test('prazan kes se moze ponistiti bez greske', () => {
    expect(() => ponisti()).not.toThrow();
    expect(() => ponisti('/nema')).not.toThrow();
  });
});

describe('kes - odvojene kopije', () => {
  test('izmena vracenog objekta ne kvari zapamceno', async () => {
    await kesiraj('/menu', async () => ({ items: ['supa'] }));

    const prvi = await kesiraj('/menu', async () => ({ items: [] }));
    prvi.items.push('pokvareno');

    const drugi = await kesiraj('/menu', async () => ({ items: [] }));
    expect(drugi.items).toEqual(['supa']);
  });

  test('izmena izvornog objekta ne kvari zapamceno', async () => {
    const izvor = { items: ['supa'] };
    await kesiraj('/menu', async () => izvor);

    izvor.items.push('pokvareno');

    const iz = await kesiraj('/menu', async () => ({ items: [] }));
    expect(iz.items).toEqual(['supa']);
  });

  test('proste vrednosti prolaze nedirnute', async () => {
    expect(await kesiraj('/a', async () => null)).toBeNull();
    expect(await kesiraj('/b', async () => 42)).toBe(42);
    expect(await kesiraj('/c', async () => 'tekst')).toBe('tekst');
  });
});

describe('kes - gornja granica', () => {
  test('ne raste preko granice', async () => {
    for (let i = 0; i < NAJVISE_KLJUCEVA + 15; i++) {
      await kesiraj(`/menu?date=${i}`, async () => i);
    }

    expect(stanje().zapisa).toBeLessThanOrEqual(NAJVISE_KLJUCEVA);
  });

  test('najstariji kljuc ispada prvi', async () => {
    for (let i = 0; i < NAJVISE_KLJUCEVA + 1; i++) {
      await kesiraj(`/k${i}`, async () => i);
    }

    // Prvi upisani je izbacen, pa se za njega ponovo pita.
    const donesi = jest.fn().mockResolvedValue('ponovo');
    expect(await kesiraj('/k0', donesi)).toBe('ponovo');
    expect(donesi).toHaveBeenCalledTimes(1);
  });
});
