const request = require('supertest');
const app = require('../src/app');
const { prisma, cleanDB, createTestUser, disconnectDB, TEST_ADMIN, TEST_PARENT } = require('./setup');

let adminToken;
let parentToken;
let parent2Token;
let parentId;
let parent2Id;
let childId;

beforeAll(async () => {
  await cleanDB();

  await createTestUser(TEST_ADMIN);
  const parent = await createTestUser(TEST_PARENT);
  const parent2 = await createTestUser({
    email: 'roditelj2@test.com',
    password: 'test123',
    firstName: 'Drugi',
    lastName: 'Roditelj',
  });

  parentId = parent.id;
  parent2Id = parent2.id;

  const adminRes = await request(app)
    .post('/api/auth/login')
    .send({ email: TEST_ADMIN.email, password: TEST_ADMIN.password });
  adminToken = adminRes.body.token;

  const parentRes = await request(app)
    .post('/api/auth/login')
    .send({ email: TEST_PARENT.email, password: TEST_PARENT.password });
  parentToken = parentRes.body.token;

  const parent2Res = await request(app)
    .post('/api/auth/login')
    .send({ email: 'roditelj2@test.com', password: 'test123' });
  parent2Token = parent2Res.body.token;
});

afterAll(async () => {
  await cleanDB();
  await disconnectDB();
});

describe('POST /api/children', () => {
  test('roditelj dodaje dete', async () => {
    const res = await request(app)
      .post('/api/children')
      .set('Authorization', `Bearer ${parentToken}`)
      .send({
        firstName: 'Marko',
        lastName: 'Markovic',
        dateOfBirth: '2020-05-15',
        gender: 'MALE',
        allergies: 'kikiriki',
      });

    expect(res.status).toBe(201);
    expect(res.body.child.firstName).toBe('Marko');
    expect(res.body.child.lastName).toBe('Markovic');
    expect(res.body.child.qrCode).toMatch(/^IGR-[A-F0-9]{8}$/);
    expect(res.body.child.parentId).toBe(parentId);
    expect(res.body.child.gender).toBe('MALE');
    expect(res.body.child.allergies).toBe('kikiriki');
    childId = res.body.child.id;
  });

  test('roditelj dodaje drugo dete', async () => {
    const res = await request(app)
      .post('/api/children')
      .set('Authorization', `Bearer ${parentToken}`)
      .send({
        firstName: 'Ana',
        lastName: 'Markovic',
        dateOfBirth: '2022-01-10',
        gender: 'FEMALE',
      });

    expect(res.status).toBe(201);
    expect(res.body.child.firstName).toBe('Ana');
    expect(res.body.child.qrCode).toMatch(/^IGR-/);
  });

  test('admin dodaje dete drugom roditelju', async () => {
    const res = await request(app)
      .post('/api/children')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        firstName: 'Nikola',
        lastName: 'Nikolic',
        dateOfBirth: '2019-08-20',
        parentId: parent2Id,
      });

    expect(res.status).toBe(201);
    expect(res.body.child.parentId).toBe(parent2Id);
  });

  test('svako dete dobija unikatan QR kod', async () => {
    const children = await prisma.child.findMany();
    const qrCodes = children.map((c) => c.qrCode);
    const unique = new Set(qrCodes);
    expect(unique.size).toBe(qrCodes.length);
  });

  test('validira obavezna polja', async () => {
    const res = await request(app)
      .post('/api/children')
      .set('Authorization', `Bearer ${parentToken}`)
      .send({ firstName: 'Samo Ime' });

    expect(res.status).toBe(400);
    expect(res.body.errors).toBeDefined();
  });

  test('validira datum rodjenja', async () => {
    const res = await request(app)
      .post('/api/children')
      .set('Authorization', `Bearer ${parentToken}`)
      .send({
        firstName: 'Test',
        lastName: 'Test',
        dateOfBirth: 'nije-datum',
      });

    expect(res.status).toBe(400);
  });

  test('admin ne moze da doda dete nepostojecem roditelju', async () => {
    const res = await request(app)
      .post('/api/children')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        firstName: 'Test',
        lastName: 'Test',
        dateOfBirth: '2020-01-01',
        parentId: '00000000-0000-0000-0000-000000000000',
      });

    expect(res.status).toBe(404);
    expect(res.body.message).toContain('Roditelj');
  });

  test('neprijavljen korisnik ne moze da dodaje decu', async () => {
    const res = await request(app)
      .post('/api/children')
      .send({
        firstName: 'Test',
        lastName: 'Test',
        dateOfBirth: '2020-01-01',
      });

    expect(res.status).toBe(401);
  });
});

describe('GET /api/children', () => {
  test('roditelj vidi samo svoju decu', async () => {
    const res = await request(app)
      .get('/api/children')
      .set('Authorization', `Bearer ${parentToken}`);

    expect(res.status).toBe(200);
    expect(res.body.children.length).toBe(2);
    res.body.children.forEach((child) => {
      expect(child.parentId).toBe(parentId);
    });
  });

  test('drugi roditelj vidi samo svoju decu', async () => {
    const res = await request(app)
      .get('/api/children')
      .set('Authorization', `Bearer ${parent2Token}`);

    expect(res.status).toBe(200);
    expect(res.body.children.length).toBe(1);
    expect(res.body.children[0].firstName).toBe('Nikola');
  });
});

describe('GET /api/children/all (admin)', () => {
  test('admin vidi svu decu sa roditeljima', async () => {
    const res = await request(app)
      .get('/api/children/all')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.children.length).toBe(3);
    expect(res.body.pagination).toBeDefined();
    expect(res.body.pagination.total).toBe(3);
    res.body.children.forEach((child) => {
      expect(child.parent).toBeDefined();
      expect(child.parent.password).toBeUndefined();
    });
  });

  test('admin pretraga po imenu', async () => {
    const res = await request(app)
      .get('/api/children/all?search=Marko')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.children.length).toBeGreaterThanOrEqual(1);
  });

  test('parent ne moze da pristupi admin listi', async () => {
    const res = await request(app)
      .get('/api/children/all')
      .set('Authorization', `Bearer ${parentToken}`);

    expect(res.status).toBe(403);
  });
});

describe('GET /api/children/:id', () => {
  test('roditelj vidi detalje svog deteta', async () => {
    const res = await request(app)
      .get(`/api/children/${childId}`)
      .set('Authorization', `Bearer ${parentToken}`);

    expect(res.status).toBe(200);
    expect(res.body.child.id).toBe(childId);
    expect(res.body.child.parent).toBeDefined();
  });

  test('roditelj ne moze da vidi tudje dete', async () => {
    const res = await request(app)
      .get(`/api/children/${childId}`)
      .set('Authorization', `Bearer ${parent2Token}`);

    expect(res.status).toBe(403);
  });

  test('admin moze da vidi bilo koje dete', async () => {
    const res = await request(app)
      .get(`/api/children/${childId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.child.id).toBe(childId);
  });

  test('vraca 404 za nepostojece dete', async () => {
    const res = await request(app)
      .get('/api/children/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${parentToken}`);

    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/children/:id', () => {
  test('roditelj azurira svoje dete', async () => {
    const res = await request(app)
      .patch(`/api/children/${childId}`)
      .set('Authorization', `Bearer ${parentToken}`)
      .send({ firstName: 'Marko Updated', allergies: 'gluten' });

    expect(res.status).toBe(200);
    expect(res.body.child.firstName).toBe('Marko Updated');
    expect(res.body.child.allergies).toBe('gluten');
  });

  test('roditelj ne moze da azurira tudje dete', async () => {
    const res = await request(app)
      .patch(`/api/children/${childId}`)
      .set('Authorization', `Bearer ${parent2Token}`)
      .send({ firstName: 'Hack' });

    expect(res.status).toBe(403);
  });

  test('admin moze da azurira bilo koje dete', async () => {
    const res = await request(app)
      .patch(`/api/children/${childId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ notes: 'Admin beleska' });

    expect(res.status).toBe(200);
    expect(res.body.child.notes).toBe('Admin beleska');
  });

  test('vraca 404 za nepostojece dete', async () => {
    const res = await request(app)
      .patch('/api/children/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${parentToken}`)
      .send({ firstName: 'Test' });

    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/children/:id', () => {
  test('roditelj ne moze da obrise tudje dete', async () => {
    const res = await request(app)
      .delete(`/api/children/${childId}`)
      .set('Authorization', `Bearer ${parent2Token}`);

    expect(res.status).toBe(403);
  });

  test('roditelj brise svoje dete (soft delete)', async () => {
    const res = await request(app)
      .delete(`/api/children/${childId}`)
      .set('Authorization', `Bearer ${parentToken}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('uklonjeno');

    // obrisano dete se ne pojavljuje u listi
    const listRes = await request(app)
      .get('/api/children')
      .set('Authorization', `Bearer ${parentToken}`);

    const ids = listRes.body.children.map((c) => c.id);
    expect(ids).not.toContain(childId);
  });

  test('vraca 404 za nepostojece dete', async () => {
    const res = await request(app)
      .delete('/api/children/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${parentToken}`);

    expect(res.status).toBe(404);
  });
});

// Roditelj istim QR kodom i prijavljuje i odjavljuje dete, pa mora da vidi u
// kom je stanju - inace ne zna sta ce sledece skeniranje uraditi.
describe('Stanje deteta u listi roditelja', () => {
  test('dete koje nije prijavljeno nema otvorenu posetu', async () => {
    const res = await request(app)
      .get('/api/children')
      .set('Authorization', `Bearer ${parentToken}`);

    expect(res.status).toBe(200);
    for (const dete of res.body.children) {
      expect(dete).toHaveProperty('activeVisit');
    }
  });

  test('prijavljeno dete nosi vreme dolaska', async () => {
    const napravljeno = await request(app)
      .post('/api/children')
      .set('Authorization', `Bearer ${parentToken}`)
      .send({ firstName: 'Stanje', lastName: 'Provera', dateOfBirth: '2021-01-01' });
    const dete = napravljeno.body.child;

    const pkg = await prisma.package.create({
      data: { name: 'Stanje 5h', totalHours: 5, validityDays: 30 },
    });
    await request(app)
      .post('/api/packages/assign')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userId: parentId, packageId: pkg.id });

    await request(app)
      .post('/api/visits/check-in')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ qrCode: dete.qrCode });

    const res = await request(app)
      .get('/api/children')
      .set('Authorization', `Bearer ${parentToken}`);
    const naslo = res.body.children.find((c) => c.id === dete.id);

    expect(naslo.activeVisit).not.toBeNull();
    expect(naslo.activeVisit.checkedInAt).toBeTruthy();

    await request(app)
      .post('/api/visits/check-out')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ qrCode: dete.qrCode });

    const posle = await request(app)
      .get('/api/children')
      .set('Authorization', `Bearer ${parentToken}`);
    expect(posle.body.children.find((c) => c.id === dete.id).activeVisit).toBeNull();
  });
});
