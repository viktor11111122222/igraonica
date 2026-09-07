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

// "Ana@Primer.rs" i "ana@primer.rs" su isti nalog. Ranije su se pravila dva, a
// prijava sa drugacije otkucanim slovima nije prolazila.
describe('Email ne mari za velika slova', () => {
  const EMAIL = 'Velika.Slova@Primer.RS';

  test('registracija cuva email malim slovima', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: `  ${EMAIL}  `,
      password: 'tajna123',
      firstName: 'Velika',
      lastName: 'Slova',
    });

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('velika.slova@primer.rs');
  });

  test('prijava prolazi bez obzira kako je email otkucan', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'VELIKA.SLOVA@primer.rs', password: 'tajna123' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  test('isti email drugim slovima ne pravi drugi nalog', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'velika.slova@PRIMER.rs',
      password: 'tajna123',
      firstName: 'Duplikat',
      lastName: 'Nalog',
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('vec postoji');
  });
});

// Promena lozinke mora da izbaci uredjaj koji je ostao prijavljen - inace stari
// token vazi jos 30 dana.
describe('Promena lozinke obara stare sesije', () => {
  let stariToken;
  let noviToken;

  beforeAll(async () => {
    const email = `sesija.${Date.now()}@primer.rs`;
    await createTestUser({ email, password: 'stara123', firstName: 'Sesija', lastName: 'Test' });

    const prijava = await request(app)
      .post('/api/auth/login')
      .send({ email, password: 'stara123' });
    stariToken = prijava.body.token;

    const promena = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${stariToken}`)
      .send({ currentPassword: 'stara123', newPassword: 'nova1234' });
    noviToken = promena.body.token;
  });

  test('stari token vise ne prolazi', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${stariToken}`);

    expect(res.status).toBe(401);
    expect(res.body.message).toContain('Lozinka je promenjena');
  });

  // Uredjaj sa kog je lozinka promenjena ostaje prijavljen.
  test('token dobijen pri promeni radi', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${noviToken}`);
    expect(res.status).toBe(200);
  });
});

// Deaktiviran nalog nije obrisan nalog; ista poruka za oba je izgledala kao da
// je nalog nestao.
describe('Deaktiviran nalog dobija svoju poruku', () => {
  test('token deaktiviranog naloga javlja da je nalog iskljucen', async () => {
    const email = `deaktiviran.${Date.now()}@primer.rs`;
    const korisnik = await createTestUser({
      email,
      password: 'tajna123',
      firstName: 'Deaktiviran',
      lastName: 'Nalog',
    });
    const prijava = await request(app).post('/api/auth/login').send({ email, password: 'tajna123' });

    await prisma.user.update({ where: { id: korisnik.id }, data: { isActive: false } });

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${prijava.body.token}`);

    expect(res.status).toBe(401);
    expect(res.body.message).toContain('deaktiviran');
  });
});

describe('DELETE /api/auth/me', () => {
  async function prijavi(email, password, role = 'PARENT') {
    const korisnik = await createTestUser({
      email,
      password,
      firstName: 'Za',
      lastName: 'Brisanje',
      role,
    });
    const prijava = await request(app).post('/api/auth/login').send({ email, password });
    return { korisnik, token: prijava.body.token };
  }

  test('brise sopstveni nalog kad je lozinka tacna', async () => {
    const { korisnik, token } = await prijavi(`brisem.${Date.now()}@primer.rs`, 'tajna123');

    const res = await request(app)
      .delete('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ password: 'tajna123' });

    expect(res.status).toBe(200);
    expect(await prisma.user.findUnique({ where: { id: korisnik.id } })).toBeNull();
  });

  test('odbija pogresnu lozinku i ostavlja nalog', async () => {
    const { korisnik, token } = await prijavi(`ostajem.${Date.now()}@primer.rs`, 'tajna123');

    const res = await request(app)
      .delete('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ password: 'pogresna' });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('nije tacna');
    expect(await prisma.user.findUnique({ where: { id: korisnik.id } })).not.toBeNull();
  });

  test('trazi lozinku', async () => {
    const { token } = await prijavi(`bezlozinke.${Date.now()}@primer.rs`, 'tajna123');

    const res = await request(app)
      .delete('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
  });

  test('trazi prijavu', async () => {
    const res = await request(app).delete('/api/auth/me').send({ password: 'tajna123' });
    expect(res.status).toBe(401);
  });

  test('ne pusta poslednjeg administratora da obrise sebe', async () => {
    await prisma.user.deleteMany({ where: { role: { in: ['ADMIN', 'SUPERADMIN'] } } });
    const { korisnik, token } = await prijavi(`jedini.${Date.now()}@primer.rs`, 'tajna123', 'ADMIN');

    const res = await request(app)
      .delete('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ password: 'tajna123' });

    expect(res.status).toBe(409);
    expect(res.body.message).toContain('jedini administrator');
    expect(await prisma.user.findUnique({ where: { id: korisnik.id } })).not.toBeNull();
  });

  test('pusta administratora kad postoji jos jedan', async () => {
    await createTestUser({
      email: `drugi.${Date.now()}@primer.rs`,
      password: 'tajna123',
      firstName: 'Drugi',
      lastName: 'Admin',
      role: 'ADMIN',
    });
    const { korisnik, token } = await prijavi(`odlazim.${Date.now()}@primer.rs`, 'tajna123', 'ADMIN');

    const res = await request(app)
      .delete('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ password: 'tajna123' });

    expect(res.status).toBe(200);
    expect(await prisma.user.findUnique({ where: { id: korisnik.id } })).toBeNull();
  });

  test('posete ostaju u bazi kad nalog osoblja nestane', async () => {
    await createTestUser({
      email: `rezerva.${Date.now()}@primer.rs`,
      password: 'tajna123',
      firstName: 'Rezervni',
      lastName: 'Admin',
      role: 'ADMIN',
    });
    const { korisnik, token } = await prijavi(`prijavio.${Date.now()}@primer.rs`, 'tajna123', 'ADMIN');
    const roditelj = await createTestUser({
      email: `roditelj.${Date.now()}@primer.rs`,
      password: 'tajna123',
      firstName: 'Tudji',
      lastName: 'Roditelj',
    });
    const dete = await prisma.child.create({
      data: {
        parentId: roditelj.id,
        firstName: 'Tudje',
        lastName: 'Dete',
        dateOfBirth: new Date('2020-05-05'),
        qrCode: `qr-${Date.now()}`,
      },
    });
    const poseta = await prisma.visit.create({
      data: { childId: dete.id, checkedInAt: new Date(), checkedInById: korisnik.id },
    });

    const res = await request(app)
      .delete('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ password: 'tajna123' });

    expect(res.status).toBe(200);
    const ostala = await prisma.visit.findUnique({ where: { id: poseta.id } });
    expect(ostala).not.toBeNull();
    expect(ostala.checkedInById).toBeNull();
  });

  test('brise decu i njihove posete uz roditeljski nalog', async () => {
    const { korisnik, token } = await prijavi(`saDecom.${Date.now()}@primer.rs`, 'tajna123');
    const admin = await createTestUser({
      email: `prijavljivac.${Date.now()}@primer.rs`,
      password: 'tajna123',
      firstName: 'Prijavni',
      lastName: 'Admin',
      role: 'ADMIN',
    });
    const dete = await prisma.child.create({
      data: {
        parentId: korisnik.id,
        firstName: 'Moje',
        lastName: 'Dete',
        dateOfBirth: new Date('2020-05-05'),
        qrCode: `qr-d-${Date.now()}`,
      },
    });
    const poseta = await prisma.visit.create({
      data: { childId: dete.id, checkedInAt: new Date(), checkedInById: admin.id },
    });

    const res = await request(app)
      .delete('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ password: 'tajna123' });

    expect(res.status).toBe(200);
    expect(await prisma.child.findUnique({ where: { id: dete.id } })).toBeNull();
    expect(await prisma.visit.findUnique({ where: { id: poseta.id } })).toBeNull();
  });
});
