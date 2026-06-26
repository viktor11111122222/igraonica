const request = require('supertest');
const app = require('../src/app');
const { prisma, cleanDB, createTestUser, disconnectDB, TEST_ADMIN, TEST_PARENT } = require('./setup');

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
      { key: 'rounding_minutes', value: '15', description: 'Zaokruzivanje minuta' },
      { key: 'minimum_charge_minutes', value: '30', description: 'Minimalna naplata' },
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
    expect(res.body.settings.length).toBe(6);

    // sortirano po kljucu
    const keys = res.body.settings.map((s) => s.key);
    const sorted = [...keys].sort();
    expect(keys).toEqual(sorted);
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

  test('validira da vrednost nije prazna', async () => {
    const res = await request(app)
      .patch('/api/settings/closing_time')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ value: '' });

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
