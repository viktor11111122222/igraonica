const request = require('supertest');
const app = require('../src/app');
const { prisma, cleanDB, createTestUser, disconnectDB, TEST_ADMIN, TEST_PARENT } = require('./setup');

let adminToken;
let parentToken;
let createdUserId;

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

describe('Authorization guards', () => {
  test('parent ne moze da pristupi /api/users', async () => {
    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${parentToken}`);

    expect(res.status).toBe(403);
    expect(res.body.message).toContain('Nemate dozvolu');
  });

  test('neprijavljen korisnik ne moze da pristupi /api/users', async () => {
    const res = await request(app).get('/api/users');

    expect(res.status).toBe(401);
  });

  test('nevazeci token je odbijen', async () => {
    const res = await request(app)
      .get('/api/users')
      .set('Authorization', 'Bearer nevazeci123');

    expect(res.status).toBe(401);
  });
});

describe('GET /api/users', () => {
  test('admin dobija listu korisnika', async () => {
    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.users).toBeDefined();
    expect(res.body.users.length).toBeGreaterThanOrEqual(2);
    expect(res.body.pagination).toBeDefined();
    expect(res.body.pagination.total).toBeGreaterThanOrEqual(2);

    res.body.users.forEach((user) => {
      expect(user.password).toBeUndefined();
    });
  });

  test('paginacija radi', async () => {
    const res = await request(app)
      .get('/api/users?page=1&limit=1')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.users.length).toBe(1);
    expect(res.body.pagination.pages).toBeGreaterThanOrEqual(2);
  });

  test('pretraga po imenu radi', async () => {
    const res = await request(app)
      .get('/api/users?search=Test')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.users.length).toBeGreaterThanOrEqual(1);
  });

  test('filter po roli radi', async () => {
    const res = await request(app)
      .get('/api/users?role=ADMIN')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    res.body.users.forEach((user) => {
      expect(user.role).toBe('ADMIN');
    });
  });
});

describe('POST /api/users', () => {
  test('admin kreira novog korisnika', async () => {
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email: 'kreiran@test.com',
        password: 'test123',
        firstName: 'Kreiran',
        lastName: 'Korisnik',
        phone: '0641112222',
      });

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('kreiran@test.com');
    expect(res.body.user.role).toBe('PARENT');
    expect(res.body.user.password).toBeUndefined();
    createdUserId = res.body.user.id;
  });

  test('admin kreira korisnika sa admin rolom', async () => {
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email: 'noviadmin@test.com',
        password: 'test123',
        firstName: 'Novi',
        lastName: 'Admin',
        role: 'ADMIN',
      });

    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('ADMIN');
  });

  test('ne dozvoljava duplikat emaila', async () => {
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email: 'kreiran@test.com',
        password: 'test123',
        firstName: 'Dupli',
        lastName: 'Korisnik',
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('vec postoji');
  });

  test('validira obavezna polja', async () => {
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: 'bad' });

    expect(res.status).toBe(400);
    expect(res.body.errors).toBeDefined();
  });

  test('parent ne moze da kreira korisnika', async () => {
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${parentToken}`)
      .send({
        email: 'parent_try@test.com',
        password: 'test123',
        firstName: 'Pokusaj',
        lastName: 'Parent',
      });

    expect(res.status).toBe(403);
  });
});

describe('GET /api/users/:id', () => {
  test('admin dobija detalje korisnika', async () => {
    const res = await request(app)
      .get(`/api/users/${createdUserId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(createdUserId);
    expect(res.body.user.email).toBe('kreiran@test.com');
    expect(res.body.user.children).toBeDefined();
    expect(res.body.user.userPackages).toBeDefined();
    expect(res.body.user.password).toBeUndefined();
  });

  test('vraca 404 za nepostojeci id', async () => {
    const res = await request(app)
      .get('/api/users/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/users/:id', () => {
  test('admin azurira korisnika', async () => {
    const res = await request(app)
      .patch(`/api/users/${createdUserId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ firstName: 'Azuriran', phone: '0659999999' });

    expect(res.status).toBe(200);
    expect(res.body.user.firstName).toBe('Azuriran');
    expect(res.body.user.phone).toBe('0659999999');
    expect(res.body.user.password).toBeUndefined();
  });

  test('admin menja rolu korisnika', async () => {
    const res = await request(app)
      .patch(`/api/users/${createdUserId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'ADMIN' });

    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('ADMIN');

    // vrati nazad na PARENT
    await request(app)
      .patch(`/api/users/${createdUserId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'PARENT' });
  });

  test('vraca 404 za nepostojeci id', async () => {
    const res = await request(app)
      .patch('/api/users/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ firstName: 'Test' });

    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/users/:id', () => {
  test('admin deaktivira korisnika (soft delete)', async () => {
    const res = await request(app)
      .delete(`/api/users/${createdUserId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('deaktiviran');

    // proveri da je deaktiviran
    const userRes = await request(app)
      .get(`/api/users/${createdUserId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(userRes.body.user.isActive).toBe(false);
  });

  test('deaktivirani korisnik ne moze da se loguje', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'kreiran@test.com', password: 'test123' });

    expect(res.status).toBe(401);
    expect(res.body.message).toContain('deaktiviran');
  });

  test('vraca 404 za nepostojeci id', async () => {
    const res = await request(app)
      .delete('/api/users/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });
});

describe('GET /api/health', () => {
  test('vraca status ok', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.timestamp).toBeDefined();
  });
});

describe('404 handler', () => {
  test('vraca 404 za nepostojecu rutu', async () => {
    const res = await request(app).get('/api/nepostoji');

    expect(res.status).toBe(404);
    expect(res.body.message).toContain('Ruta nije pronadjena');
  });
});

// Obican admin je mogao da spusti superadmina na PARENT ili da ga iskljuci -
// dovoljno da igraonica ostane bez vlasnika naloga.
describe('Zastita naloga', () => {
  let superadminId;
  let adminId;

  beforeAll(async () => {
    const sa = await createTestUser({
      email: `superadmin.${Date.now()}@primer.rs`,
      password: 'tajna123',
      firstName: 'Super',
      lastName: 'Admin',
      role: 'SUPERADMIN',
    });
    superadminId = sa.id;

    const ja = await prisma.user.findFirst({ where: { email: TEST_ADMIN.email } });
    adminId = ja.id;
  });

  test('admin ne moze da promeni ulogu superadminu', async () => {
    const res = await request(app)
      .patch(`/api/users/${superadminId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'PARENT' });

    expect(res.status).toBe(403);
    expect(res.body.message).toContain('superadmin');
  });

  test('admin ne moze da iskljuci superadmina', async () => {
    const res = await request(app)
      .delete(`/api/users/${superadminId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(403);

    const posle = await prisma.user.findUnique({ where: { id: superadminId } });
    expect(posle.isActive).toBe(true);
  });

  // Inace se admin zakljuca napolju i nema ko da ga vrati.
  test('admin ne moze sam sebe da iskljuci', async () => {
    const res = await request(app)
      .patch(`/api/users/${adminId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: false });

    expect(res.status).toBe(403);
    expect(res.body.message).toContain('sopstveni');
  });

  test('admin ne moze sam sebi da promeni ulogu', async () => {
    const res = await request(app)
      .patch(`/api/users/${adminId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'PARENT' });

    expect(res.status).toBe(403);
  });

  test('obicnog roditelja admin i dalje menja', async () => {
    const roditelj = await createTestUser({
      email: `obican.${Date.now()}@primer.rs`,
      password: 'tajna123',
      firstName: 'Obican',
      lastName: 'Roditelj',
    });

    const res = await request(app)
      .patch(`/api/users/${roditelj.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: false });

    expect(res.status).toBe(200);
    expect(res.body.user.isActive).toBe(false);
  });
});

// Bez gornje granice `?limit=100000` povuce celu tabelu odjednom.
describe('Stranicenje ima gornju granicu', () => {
  test('preveliki limit se svodi na 100', async () => {
    const res = await request(app)
      .get('/api/users?limit=100000')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.pagination.limit).toBe(100);
  });

  test('besmislen limit pada na podrazumevani', async () => {
    const res = await request(app)
      .get('/api/users?limit=-5')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.body.pagination.limit).toBe(1);
  });

  test('strana ne moze biti nula ili negativna', async () => {
    const res = await request(app)
      .get('/api/users?page=0')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.body.pagination.page).toBe(1);
  });
});
