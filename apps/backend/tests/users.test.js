const request = require('supertest');
const app = require('../src/app');
const { cleanDB, createTestUser, disconnectDB, TEST_ADMIN, TEST_PARENT } = require('./setup');

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
