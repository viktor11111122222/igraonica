const request = require('supertest');
const app = require('../src/app');
const { prisma, cleanDB, createTestUser, disconnectDB, TEST_ADMIN, TEST_PARENT } = require('./setup');

beforeAll(async () => {
  await cleanDB();
});

afterAll(async () => {
  await cleanDB();
  await disconnectDB();
});

describe('POST /api/auth/register', () => {
  test('registruje novog korisnika', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'novi@test.com',
        password: 'test123',
        firstName: 'Novi',
        lastName: 'Korisnik',
        phone: '0641234567',
      });

    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe('novi@test.com');
    expect(res.body.user.firstName).toBe('Novi');
    expect(res.body.user.role).toBe('PARENT');
    expect(res.body.user.password).toBeUndefined();
  });

  test('ne dozvoljava duplikat emaila', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'novi@test.com',
        password: 'test123',
        firstName: 'Dupli',
        lastName: 'Korisnik',
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('vec postoji');
  });

  test('validira obavezna polja', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'bad' });

    expect(res.status).toBe(400);
    expect(res.body.errors).toBeDefined();
    expect(res.body.errors.length).toBeGreaterThan(0);
  });

  test('validira minimalan duzinu lozinke', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'short@test.com',
        password: '123',
        firstName: 'Short',
        lastName: 'Pass',
      });

    expect(res.status).toBe(400);
    expect(res.body.errors).toBeDefined();
  });
});

describe('POST /api/auth/login', () => {
  beforeAll(async () => {
    await createTestUser(TEST_ADMIN);
    await createTestUser(TEST_PARENT);
  });

  test('loguje korisnika sa ispravnim podacima', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: TEST_ADMIN.email, password: TEST_ADMIN.password });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe(TEST_ADMIN.email);
    expect(res.body.user.role).toBe('ADMIN');
    expect(res.body.user.password).toBeUndefined();
  });

  test('odbija pogresan password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: TEST_ADMIN.email, password: 'pogresna' });

    expect(res.status).toBe(401);
    expect(res.body.message).toContain('Pogresan');
  });

  test('odbija nepostojeci email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nepostoji@test.com', password: 'test123' });

    expect(res.status).toBe(401);
  });

  test('odbija deaktiviranog korisnika', async () => {
    const deactivated = await createTestUser({
      email: 'deaktiviran@test.com',
      password: 'test123',
      firstName: 'Deaktiviran',
      lastName: 'User',
    });
    await prisma.user.update({
      where: { id: deactivated.id },
      data: { isActive: false },
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'deaktiviran@test.com', password: 'test123' });

    expect(res.status).toBe(401);
    expect(res.body.message).toContain('deaktiviran');
  });

  test('validira email format', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nijevalidan', password: 'test123' });

    expect(res.status).toBe(400);
    expect(res.body.errors).toBeDefined();
  });
});

describe('GET /api/auth/me', () => {
  let token;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: TEST_ADMIN.email, password: TEST_ADMIN.password });
    token = res.body.token;
  });

  test('vraca trenutnog korisnika sa validnim tokenom', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(TEST_ADMIN.email);
    expect(res.body.user.password).toBeUndefined();
  });

  test('odbija zahtev bez tokena', async () => {
    const res = await request(app).get('/api/auth/me');

    expect(res.status).toBe(401);
    expect(res.body.message).toContain('Niste prijavljeni');
  });

  test('odbija nevazeci token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer nevazeci_token_123');

    expect(res.status).toBe(401);
    expect(res.body.message).toContain('Nevazeci token');
  });
});

describe('PATCH /api/auth/profile', () => {
  let token;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: TEST_PARENT.email, password: TEST_PARENT.password });
    token = res.body.token;
  });

  test('azurira profil korisnika', async () => {
    const res = await request(app)
      .patch('/api/auth/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ firstName: 'Azuriran', phone: '0651111111' });

    expect(res.status).toBe(200);
    expect(res.body.user.firstName).toBe('Azuriran');
    expect(res.body.user.phone).toBe('0651111111');
    expect(res.body.user.password).toBeUndefined();
  });

  test('ne dozvoljava promenu role kroz profil', async () => {
    const res = await request(app)
      .patch('/api/auth/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ role: 'ADMIN' });

    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('PARENT');
  });

  test('ne dozvoljava prazno ime', async () => {
    const res = await request(app)
      .patch('/api/auth/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ firstName: '' });

    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/change-password', () => {
  let token;
  const testEmail = 'changepass@test.com';

  beforeAll(async () => {
    await createTestUser({
      email: testEmail,
      password: 'stara123',
      firstName: 'Change',
      lastName: 'Pass',
    });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: testEmail, password: 'stara123' });
    token = res.body.token;
  });

  test('menja lozinku sa ispravnom trenutnom', async () => {
    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'stara123', newPassword: 'nova123' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.message).toContain('uspesno promenjena');

    // login sa novom lozinkom
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: testEmail, password: 'nova123' });
    expect(loginRes.status).toBe(200);
  });

  test('odbija pogresan trenutni password', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: testEmail, password: 'nova123' });

    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${loginRes.body.token}`)
      .send({ currentPassword: 'pogresna', newPassword: 'novija123' });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('nije tacna');
  });

  test('validira duzinu nove lozinke', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: testEmail, password: 'nova123' });

    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${loginRes.body.token}`)
      .send({ currentPassword: 'nova123', newPassword: '12' });

    expect(res.status).toBe(400);
    expect(res.body.errors).toBeDefined();
  });
});
