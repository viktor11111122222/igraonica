const request = require('supertest');
const app = require('../src/app');
const { prisma, cleanDB, createTestUser, disconnectDB, TEST_ADMIN, TEST_PARENT } = require('./setup');

let adminToken;
let parentToken;
let parentId;
let packageId;
let userPackageId;

beforeAll(async () => {
  await cleanDB();

  const admin = await createTestUser(TEST_ADMIN);
  const parent = await createTestUser(TEST_PARENT);
  parentId = parent.id;

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

// ==================== TEMPLATE PAKETI ====================

describe('POST /api/packages', () => {
  test('admin kreira paket', async () => {
    const res = await request(app)
      .post('/api/packages')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Paket 10 sati',
        description: 'Osnovni paket',
        totalHours: 10,
        price: 3000,
        validityDays: 30,
      });

    expect(res.status).toBe(201);
    expect(res.body.package.name).toBe('Paket 10 sati');
    expect(Number(res.body.package.totalHours)).toBe(10);
    expect(Number(res.body.package.price)).toBe(3000);
    expect(res.body.package.validityDays).toBe(30);
    packageId = res.body.package.id;
  });

  test('admin kreira drugi paket', async () => {
    const res = await request(app)
      .post('/api/packages')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Mesecni paket',
        totalHours: 40,
        price: 8000,
        validityDays: 30,
      });

    expect(res.status).toBe(201);
    expect(res.body.package.name).toBe('Mesecni paket');
  });

  test('parent ne moze da kreira paket', async () => {
    const res = await request(app)
      .post('/api/packages')
      .set('Authorization', `Bearer ${parentToken}`)
      .send({
        name: 'Hack paket',
        totalHours: 100,
        price: 0,
        validityDays: 365,
      });

    expect(res.status).toBe(403);
  });

  test('validira obavezna polja', async () => {
    const res = await request(app)
      .post('/api/packages')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Samo ime' });

    expect(res.status).toBe(400);
    expect(res.body.errors).toBeDefined();
  });

  test('ne dozvoljava negativne sate', async () => {
    const res = await request(app)
      .post('/api/packages')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Negativan',
        totalHours: -5,
        price: 1000,
        validityDays: 30,
      });

    expect(res.status).toBe(400);
  });
});

describe('GET /api/packages', () => {
  test('svako moze da vidi dostupne pakete', async () => {
    const res = await request(app).get('/api/packages');

    expect(res.status).toBe(200);
    expect(res.body.packages.length).toBe(2);
    expect(res.body.packages[0].name).toBeDefined();
  });

  test('paketi su sortirani po satima rastuce', async () => {
    const res = await request(app).get('/api/packages');

    const hours = res.body.packages.map((p) => Number(p.totalHours));
    expect(hours[0]).toBeLessThanOrEqual(hours[1]);
  });
});

describe('PATCH /api/packages/:id', () => {
  test('admin azurira paket', async () => {
    const res = await request(app)
      .patch(`/api/packages/${packageId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Paket 10h (azurirano)', price: 3500 });

    expect(res.status).toBe(200);
    expect(res.body.package.name).toBe('Paket 10h (azurirano)');
    expect(Number(res.body.package.price)).toBe(3500);
  });

  test('parent ne moze da azurira paket', async () => {
    const res = await request(app)
      .patch(`/api/packages/${packageId}`)
      .set('Authorization', `Bearer ${parentToken}`)
      .send({ price: 0 });

    expect(res.status).toBe(403);
  });

  test('vraca 404 za nepostojeci paket', async () => {
    const res = await request(app)
      .patch('/api/packages/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Test' });

    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/packages/:id', () => {
  let deletePackageId;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/packages')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Za brisanje',
        totalHours: 5,
        price: 1000,
        validityDays: 7,
      });
    deletePackageId = res.body.package.id;
  });

  test('admin deaktivira paket', async () => {
    const res = await request(app)
      .delete(`/api/packages/${deletePackageId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('deaktiviran');

    // deaktivirani paket se ne pojavljuje u listi
    const listRes = await request(app).get('/api/packages');
    const ids = listRes.body.packages.map((p) => p.id);
    expect(ids).not.toContain(deletePackageId);
  });

  test('vraca 404 za nepostojeci paket', async () => {
    const res = await request(app)
      .delete('/api/packages/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });
});

// ==================== DODELJENI PAKETI ====================

describe('POST /api/packages/assign', () => {
  test('admin dodeljuje paket korisniku', async () => {
    const res = await request(app)
      .post('/api/packages/assign')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        userId: parentId,
        packageId,
        notes: 'Kupljen na licu mesta',
      });

    expect(res.status).toBe(201);
    expect(res.body.userPackage.userId).toBe(parentId);
    expect(res.body.userPackage.packageId).toBe(packageId);
    expect(Number(res.body.userPackage.remainingHours)).toBe(10);
    expect(res.body.userPackage.expiresAt).toBeDefined();
    expect(res.body.userPackage.notes).toBe('Kupljen na licu mesta');
    expect(res.body.userPackage.package).toBeDefined();
    userPackageId = res.body.userPackage.id;
  });

  test('admin moze dodeliti isti paket ponovo (novi period)', async () => {
    const res = await request(app)
      .post('/api/packages/assign')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userId: parentId, packageId });

    expect(res.status).toBe(201);
    expect(res.body.userPackage.id).not.toBe(userPackageId);
  });

  test('vraca 404 za nepostojeceg korisnika', async () => {
    const res = await request(app)
      .post('/api/packages/assign')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        userId: '00000000-0000-0000-0000-000000000000',
        packageId,
      });

    expect(res.status).toBe(404);
    expect(res.body.message).toContain('Korisnik');
  });

  test('vraca 404 za nepostojeci paket', async () => {
    const res = await request(app)
      .post('/api/packages/assign')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        userId: parentId,
        packageId: '00000000-0000-0000-0000-000000000000',
      });

    expect(res.status).toBe(404);
    expect(res.body.message).toContain('Paket');
  });

  test('parent ne moze da dodeljuje pakete', async () => {
    const res = await request(app)
      .post('/api/packages/assign')
      .set('Authorization', `Bearer ${parentToken}`)
      .send({ userId: parentId, packageId });

    expect(res.status).toBe(403);
  });
});

describe('GET /api/packages/my', () => {
  test('roditelj vidi svoje pakete', async () => {
    const res = await request(app)
      .get('/api/packages/my')
      .set('Authorization', `Bearer ${parentToken}`);

    expect(res.status).toBe(200);
    expect(res.body.userPackages.length).toBe(2);
    res.body.userPackages.forEach((up) => {
      expect(up.userId).toBe(parentId);
      expect(up.package).toBeDefined();
      expect(up.package.name).toBeDefined();
    });
  });

  test('admin bez paketa dobija praznu listu', async () => {
    const res = await request(app)
      .get('/api/packages/my')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.userPackages.length).toBe(0);
  });
});

describe('GET /api/packages/user/:userId', () => {
  test('admin vidi pakete korisnika', async () => {
    const res = await request(app)
      .get(`/api/packages/user/${parentId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.userPackages.length).toBe(2);
  });

  test('parent ne moze da vidi tudje pakete', async () => {
    const res = await request(app)
      .get(`/api/packages/user/${parentId}`)
      .set('Authorization', `Bearer ${parentToken}`);

    expect(res.status).toBe(403);
  });

  test('vraca 404 za nepostojeceg korisnika', async () => {
    const res = await request(app)
      .get('/api/packages/user/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });
});

// ==================== HOUR ADJUSTMENTS ====================

describe('POST /api/packages/:userPackageId/adjust-hours', () => {
  test('admin dodaje sate', async () => {
    const res = await request(app)
      .post(`/api/packages/${userPackageId}/adjust-hours`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ hours: 5, reason: 'Poklon za rodjendan' });

    expect(res.status).toBe(200);
    expect(Number(res.body.userPackage.remainingHours)).toBe(15);
    expect(res.body.adjustment).toBeDefined();
    expect(Number(res.body.adjustment.hoursBefore)).toBe(10);
    expect(Number(res.body.adjustment.hoursAfter)).toBe(15);
    expect(res.body.adjustment.reason).toBe('Poklon za rodjendan');
  });

  test('admin oduzima sate', async () => {
    const res = await request(app)
      .post(`/api/packages/${userPackageId}/adjust-hours`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ hours: -3, reason: 'Korekcija' });

    expect(res.status).toBe(200);
    expect(Number(res.body.userPackage.remainingHours)).toBe(12);
    expect(Number(res.body.adjustment.hoursBefore)).toBe(15);
    expect(Number(res.body.adjustment.hoursAfter)).toBe(12);
  });

  test('sati ne mogu ici ispod 0', async () => {
    const res = await request(app)
      .post(`/api/packages/${userPackageId}/adjust-hours`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ hours: -100 });

    expect(res.status).toBe(200);
    expect(Number(res.body.userPackage.remainingHours)).toBe(0);
  });

  test('parent ne moze da menja sate', async () => {
    const res = await request(app)
      .post(`/api/packages/${userPackageId}/adjust-hours`)
      .set('Authorization', `Bearer ${parentToken}`)
      .send({ hours: 100 });

    expect(res.status).toBe(403);
  });

  test('vraca 404 za nepostojeci korisnicki paket', async () => {
    const res = await request(app)
      .post('/api/packages/00000000-0000-0000-0000-000000000000/adjust-hours')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ hours: 5 });

    expect(res.status).toBe(404);
  });
});

describe('GET /api/packages/:userPackageId/adjustments', () => {
  test('admin vidi istoriju promena sati', async () => {
    const res = await request(app)
      .get(`/api/packages/${userPackageId}/adjustments`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.adjustments.length).toBe(3);
    res.body.adjustments.forEach((a) => {
      expect(a.adjustedBy).toBeDefined();
      expect(a.adjustedBy.password).toBeUndefined();
    });
  });

  test('parent ne moze da vidi istoriju promena', async () => {
    const res = await request(app)
      .get(`/api/packages/${userPackageId}/adjustments`)
      .set('Authorization', `Bearer ${parentToken}`);

    expect(res.status).toBe(403);
  });

  test('vraca 404 za nepostojeci korisnicki paket', async () => {
    const res = await request(app)
      .get('/api/packages/00000000-0000-0000-0000-000000000000/adjustments')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });
});
