const request = require('supertest');
const app = require('../src/app');
const { cleanDB, createTestUser, disconnectDB, TEST_ADMIN, TEST_PARENT } = require('./setup');
const { CATALOG } = require('../src/config/settings');

let adminToken;
let parentToken;

beforeAll(async () => {
  await cleanDB();

  await createTestUser(TEST_ADMIN);
  await createTestUser(TEST_PARENT);

  const adminRes = await request(app)
    .post('/api/auth/login')
    .send({ email: TEST_ADMIN.email, password: TEST_ADMIN.password });
  adminToken = adminRes.body.token;

  const parentRes = await request(app)
    .post('/api/auth/login')
    .send({ email: TEST_PARENT.email, password: TEST_PARENT.password });
  parentToken = parentRes.body.token;
});

afterAll(async () => {
  await cleanDB();
  await disconnectDB();
});

describe('POST /api/settings', () => {
  test('admin kreira podesavanje', async () => {
    const res = await request(app)
      .post('/api/settings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ key: 'closing_time', value: '21:00', description: 'Vreme zatvaranja' });

    expect(res.status).toBe(201);
    expect(res.body.setting.key).toBe('closing_time');
    expect(res.body.setting.value).toBe('21:00');
    expect(res.body.setting.description).toBe('Vreme zatvaranja');
  });

  test('admin kreira vise podesavanja', async () => {
    const settings = [
      { key: 'hour_grace_minutes', value: '15', description: 'Prag minuta preko punog sata' },
      { key: 'app_name', value: 'Kids Club', description: 'Naziv aplikacije' },
      { key: 'contact_phone', value: '0641234567', description: 'Kontakt telefon' },
      { key: 'address', value: 'Bulevar 123, Beograd', description: 'Adresa' },
    ];

    for (const s of settings) {
      const res = await request(app)
        .post('/api/settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(s);
      expect(res.status).toBe(201);
    }
  });

  test('ne dozvoljava duplikat kljuca', async () => {
    const res = await request(app)
      .post('/api/settings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ key: 'closing_time', value: '22:00' });

    expect(res.status).toBe(409);
    expect(res.body.message).toContain('vec postoji');
  });

  test('validira obavezna polja', async () => {
    const res = await request(app)
      .post('/api/settings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ key: 'test' });

    expect(res.status).toBe(400);
    expect(res.body.errors).toBeDefined();
  });

  test('parent ne moze da kreira podesavanje', async () => {
    const res = await request(app)
      .post('/api/settings')
      .set('Authorization', `Bearer ${parentToken}`)
      .send({ key: 'hack', value: 'true' });

    expect(res.status).toBe(403);
  });
});

describe('GET /api/settings', () => {
  test('admin vidi sva podesavanja', async () => {
    const res = await request(app)
      .get('/api/settings')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);

    // Tacan broj se namerno ne proverava - katalog podesavanja raste. Bitno je
    // da su svi kljucevi iz kataloga tu, i to redom kojim su u katalogu:
    // panel ih tako prikazuje grupisane po smislu, a ne azbucno.
    const keys = res.body.settings.map((s) => s.key);
    expect(keys.slice(0, CATALOG.length)).toEqual(CATALOG.map((c) => c.key));
  });

  test('parent ne moze da vidi podesavanja', async () => {
    const res = await request(app)
      .get('/api/settings')
      .set('Authorization', `Bearer ${parentToken}`);

    expect(res.status).toBe(403);
  });

  test('neprijavljen korisnik ne moze da vidi podesavanja', async () => {
    const res = await request(app).get('/api/settings');

    expect(res.status).toBe(401);
  });
});

describe('GET /api/settings/:key', () => {
  test('admin cita jedno podesavanje', async () => {
    const res = await request(app)
      .get('/api/settings/closing_time')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.setting.key).toBe('closing_time');
    expect(res.body.setting.value).toBe('21:00');
  });

  test('vraca 404 za nepostojeci kljuc', async () => {
    const res = await request(app)
      .get('/api/settings/nepostoji')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/settings/:key', () => {
  test('admin menja vrednost podesavanja', async () => {
    const res = await request(app)
      .patch('/api/settings/closing_time')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ value: '22:00' });

    expect(res.status).toBe(200);
    expect(res.body.setting.value).toBe('22:00');
    expect(res.body.setting.description).toBe('Vreme zatvaranja');
  });

  test('admin menja i opis podesavanja', async () => {
    const res = await request(app)
      .patch('/api/settings/closing_time')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ value: '21:30', description: 'Novo vreme zatvaranja' });

    expect(res.status).toBe(200);
    expect(res.body.setting.value).toBe('21:30');
    expect(res.body.setting.description).toBe('Novo vreme zatvaranja');
  });

  // Prazna vrednost je dozvoljena namerno: telefon, adresa i obavestenje u
  // aplikaciji se brisu tako sto se ostave prazni.
  test('dozvoljava praznu vrednost, tako se podesavanje brise', async () => {
    const res = await request(app)
      .patch('/api/settings/closing_time')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ value: '' });

    expect(res.status).toBe(200);
    expect(res.body.setting.value).toBe('');
  });

  test('odbija vrednost koja nije tekst', async () => {
    const res = await request(app)
      .patch('/api/settings/closing_time')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ value: 42 });

    expect(res.status).toBe(400);
  });

  test('vraca 404 za nepostojeci kljuc', async () => {
    const res = await request(app)
      .patch('/api/settings/nepostoji')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ value: 'test' });

    expect(res.status).toBe(404);
  });

  test('parent ne moze da menja podesavanja', async () => {
    const res = await request(app)
      .patch('/api/settings/closing_time')
      .set('Authorization', `Bearer ${parentToken}`)
      .send({ value: '23:00' });

    expect(res.status).toBe(403);
  });
});

describe('DELETE /api/settings/:key', () => {
  test('admin brise podesavanje', async () => {
    const res = await request(app)
      .delete('/api/settings/contact_phone')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('obrisano');

    // provera da je obrisano
    const getRes = await request(app)
      .get('/api/settings/contact_phone')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(getRes.status).toBe(404);
  });

  test('vraca 404 za nepostojeci kljuc', async () => {
    const res = await request(app)
      .delete('/api/settings/nepostoji')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });

  test('parent ne moze da brise podesavanja', async () => {
    const res = await request(app)
      .delete('/api/settings/closing_time')
      .set('Authorization', `Bearer ${parentToken}`);

    expect(res.status).toBe(403);
  });
});

// Spisak ekrana za obavestenje se menjao (nekada je postojao "gallery", a
// "home" je dodat kasnije), pa stara vrednost ume da ostane u bazi kao
// nevidljivo smece koje panel ne moze da skine.
describe('PATCH /api/settings/announcement_tabs', () => {
  const sacuvaj = (value) =>
    request(app)
      .patch('/api/settings/announcement_tabs')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ value });

  test('cuva poznate ekrane', async () => {
    const res = await sacuvaj('home,menu');

    expect(res.status).toBe(200);
    expect(res.body.setting.value).toBe('home,menu');
  });

  test('odbacuje ekran koji ne postoji', async () => {
    const res = await sacuvaj('home,gallery,menu');

    expect(res.body.setting.value).toBe('home,menu');
  });

  test('cisti razmake i prazne delove', async () => {
    const res = await sacuvaj(' home , , menu ,');

    expect(res.body.setting.value).toBe('home,menu');
  });

  test('uklanja duplikate', async () => {
    const res = await sacuvaj('home,home,menu');

    expect(res.body.setting.value).toBe('home,menu');
  });

  test('prazna vrednost ostaje prazna', async () => {
    const res = await sacuvaj('');

    expect(res.status).toBe(200);
    expect(res.body.setting.value).toBe('');
  });

  test('sve same nepoznate vrednosti daju prazno', async () => {
    const res = await sacuvaj('gallery,nepostoji');

    expect(res.body.setting.value).toBe('');
  });

  // Druga podesavanja se ne diraju ovim ciscenjem.
  test('ne dira ostale kljuceve', async () => {
    const res = await request(app)
      .patch('/api/settings/club_name')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ value: 'home,gallery' });

    expect(res.body.setting.value).toBe('home,gallery');
  });
});

// Brojcana podesavanja ulaze u racunicu naplate. Dok se nisu proveravala, "abc"
// je prolazilo, a onda pri odjavi davalo NaN: poseta bi se zatvorila bez
// trajanja i bez naplate, a paket bi ostao obrisan na nulu.
describe('Provera brojcanih podesavanja', () => {
  const losi = [
    ['hour_grace_minutes', 'abc', 'tekst umesto broja'],
    ['hour_grace_minutes', '-5', 'negativan prag'],
    ['hour_grace_minutes', '60', 'prag od 60 bi svaki boravak sveo na jedan sat'],
    ['hour_grace_minutes', '75', 'iznad gornje granice'],
    ['hour_grace_minutes', '15abc', 'broj sa repom'],
    ['hour_grace_minutes', '1.9', 'decimalan broj'],
    ['hour_grace_minutes', '', 'prazno'],
  ];

  for (const [key, value, zasto] of losi) {
    test(`${key} = "${value}" se odbija (${zasto})`, async () => {
      const res = await request(app)
        .patch(`/api/settings/${key}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ value });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/ceo broj/);
    });
  }

  const dobri = [
    ['hour_grace_minutes', '0'],
    ['hour_grace_minutes', '15'],
    ['hour_grace_minutes', '59'],
  ];

  for (const [key, value] of dobri) {
    test(`${key} = "${value}" prolazi`, async () => {
      const res = await request(app)
        .patch(`/api/settings/${key}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ value });

      expect(res.status).toBe(200);
      expect(res.body.setting.value).toBe(value);
    });
  }

  // Druga brana: cak i ako u bazi zavrsi neupotrebljiva vrednost (rucni upis,
  // stariji podatak, migracija), naplata mora da radi po podrazumevanom umesto
  // da racuna sa NaN.
  test('neupotrebljiva vrednost pada na podrazumevanu, ne na NaN', () => {
    const { numericSetting } = require('../src/config/settings');

    expect(numericSetting('hour_grace_minutes', 'pokvareno')).toBe(15);
    expect(numericSetting('hour_grace_minutes', '60')).toBe(15);
    expect(numericSetting('hour_grace_minutes', null)).toBe(15);

    // Ispravna vrednost se postuje.
    expect(numericSetting('hour_grace_minutes', '10')).toBe(10);
    expect(numericSetting('hour_grace_minutes', '0')).toBe(0);
  });
});
