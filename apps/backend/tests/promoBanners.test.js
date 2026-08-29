const request = require('supertest');
const app = require('../src/app');
const { prisma, cleanDB, createTestUser, disconnectDB, TEST_ADMIN, TEST_PARENT } = require('./setup');

let adminToken;
let parentToken;

const napravi = (telo) =>
  request(app).post('/api/promo-banners').set('Authorization', `Bearer ${adminToken}`).send(telo);

const javno = () => request(app).get('/api/promo-banners');

beforeAll(async () => {
  await cleanDB();
  await createTestUser(TEST_ADMIN);
  await createTestUser(TEST_PARENT);

  const a = await request(app)
    .post('/api/auth/login')
    .send({ email: TEST_ADMIN.email, password: TEST_ADMIN.password });
  adminToken = a.body.token;

  const r = await request(app)
    .post('/api/auth/login')
    .send({ email: TEST_PARENT.email, password: TEST_PARENT.password });
  parentToken = r.body.token;
});

afterEach(async () => {
  await prisma.promoBanner.deleteMany();
});

afterAll(async () => {
  await cleanDB();
  await disconnectDB();
});

describe('POST /api/promo-banners', () => {
  test('admin pravi promociju sa slikom i opisom', async () => {
    const res = await napravi({
      title: 'Letnji popust',
      description: 'Svaki drugi dolazak gratis.',
      imageUrl: '/uploads/leto.jpg',
    });

    expect(res.status).toBe(201);
    expect(res.body.promoBanner.title).toBe('Letnji popust');
    expect(res.body.promoBanner.imageUrl).toBe('/uploads/leto.jpg');
    // Podrazumevano: aktivna i pokazuje se kao iskacuci prozor.
    expect(res.body.promoBanner.isActive).toBe(true);
    expect(res.body.promoBanner.showPopup).toBe(true);
  });

  test('promocija moze i bez slike', async () => {
    const res = await napravi({ title: 'Samo tekst' });

    expect(res.status).toBe(201);
    expect(res.body.promoBanner.imageUrl).toBeNull();
  });

  test('naslov je obavezan', async () => {
    const res = await napravi({ description: 'bez naslova' });
    expect(res.status).toBe(400);
  });



  test('roditelj ne moze da pravi promocije', async () => {
    const res = await request(app)
      .post('/api/promo-banners')
      .set('Authorization', `Bearer ${parentToken}`)
      .send({ title: 'Ne moze' });

    expect(res.status).toBe(403);
  });
});

// Aplikaciju cita i neprijavljen uredjaj - baner je reklama, ne licni podatak.
describe('GET /api/promo-banners (javno)', () => {
  test('bez prijave vraca ukljucene promocije', async () => {
    await napravi({ title: 'Prva promocija' });
    await napravi({ title: 'Druga promocija' });

    const res = await javno();

    expect(res.status).toBe(200);
    const naslovi = res.body.promoBanners.map((p) => p.title);
    expect(naslovi).toContain('Prva promocija');
    expect(naslovi).toContain('Druga promocija');
  });

  test('iskljucena promocija se ne prikazuje', async () => {
    await napravi({ title: 'Iskljucena', isActive: false });

    const res = await javno();
    expect(res.body.promoBanners.map((p) => p.title)).not.toContain('Iskljucena');
  });


  test('vise promocija vazi istovremeno, najnovija prva', async () => {
    await napravi({ title: 'Prva' });
    await napravi({ title: 'Druga' });
    await napravi({ title: 'Treca' });

    const res = await javno();
    expect(res.body.promoBanners).toHaveLength(3);
    expect(res.body.promoBanners[0].title).toBe('Treca');
  });

  test('nosi sve sto aplikaciji treba za baner', async () => {
    await napravi({ title: 'Baner', description: 'Opis', imageUrl: '/uploads/a.jpg', showPopup: false });

    const p = (await javno()).body.promoBanners[0];
    expect(p).toMatchObject({
      title: 'Baner',
      description: 'Opis',
      imageUrl: '/uploads/a.jpg',
      showPopup: false,
    });
    expect(p.id).toBeDefined();
  });
});

describe('GET /api/promo-banners/all (admin)', () => {
  test('admin vidi i iskljucene promocije', async () => {
    await napravi({ title: 'Iskljucena', isActive: false });
    await napravi({ title: 'Ukljucena' });

    const res = await request(app)
      .get('/api/promo-banners/all')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.promoBanners).toHaveLength(2);
  });

  test('roditelj ne vidi admin listu', async () => {
    const res = await request(app)
      .get('/api/promo-banners/all')
      .set('Authorization', `Bearer ${parentToken}`);

    expect(res.status).toBe(403);
  });
});

describe('PATCH /api/promo-banners/:id', () => {
  test('admin iskljucuje promociju', async () => {
    const { body } = await napravi({ title: 'Za gasenje' });

    const res = await request(app)
      .patch(`/api/promo-banners/${body.promoBanner.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: false });

    expect(res.status).toBe(200);
    expect(res.body.promoBanner.isActive).toBe(false);
    expect((await javno()).body.promoBanners).toHaveLength(0);
  });

  // Iskljucena promocija se ne brise - osoblje je vraca kad god hoce.
  test('iskljucena promocija moze ponovo da se ukljuci', async () => {
    const { body } = await napravi({ title: 'Vraca se', isActive: false });
    expect((await javno()).body.promoBanners).toHaveLength(0);

    const res = await request(app)
      .patch(`/api/promo-banners/${body.promoBanner.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: true });

    expect(res.status).toBe(200);
    expect(res.body.promoBanner.isActive).toBe(true);
    expect((await javno()).body.promoBanners).toHaveLength(1);
  });

  test('admin menja tekst i sliku', async () => {
    const { body } = await napravi({ title: 'Staro', imageUrl: '/uploads/staro.jpg' });

    const res = await request(app)
      .patch(`/api/promo-banners/${body.promoBanner.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Novo', description: 'Nov opis', imageUrl: '/uploads/novo.jpg' });

    expect(res.body.promoBanner).toMatchObject({
      title: 'Novo',
      description: 'Nov opis',
      imageUrl: '/uploads/novo.jpg',
    });
  });


  // Pomeranje samo jednog datuma ne sme da napravi promociju koja se zavrsava
  // pre nego sto pocne - drugi se uzima iz zapisa.

  test('vraca 404 za nepostojecu promociju', async () => {
    const res = await request(app)
      .patch('/api/promo-banners/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: false });

    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/promo-banners/:id', () => {
  test('admin brise promociju', async () => {
    const { body } = await napravi({ title: 'Za brisanje' });

    const res = await request(app)
      .delete(`/api/promo-banners/${body.promoBanner.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect((await javno()).body.promoBanners).toHaveLength(0);
  });

  test('vraca 404 za nepostojecu promociju', async () => {
    const res = await request(app)
      .delete('/api/promo-banners/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });

  test('roditelj ne moze da brise', async () => {
    const { body } = await napravi({ title: 'Zasticena' });

    const res = await request(app)
      .delete(`/api/promo-banners/${body.promoBanner.id}`)
      .set('Authorization', `Bearer ${parentToken}`);

    expect(res.status).toBe(403);
  });
});
