const request = require('supertest');
const app = require('../src/app');
const { prisma, cleanDB, createTestUser, disconnectDB, TEST_ADMIN, TEST_PARENT } = require('./setup');

let adminToken;
let drugaSmenaToken;
let parentToken;
let adminId;
let parentId;
let qrKod;
let deteId;
let userPackageId;
let packageId;

async function prijaviSe(korisnik) {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: korisnik.email, password: korisnik.password });
  return res.body.token;
}

const mojaObavestenja = async (token, upit = '') =>
  (await request(app).get(`/api/notifications${upit}`).set('Authorization', `Bearer ${token}`)).body;

beforeAll(async () => {
  await cleanDB();
  const admin = await createTestUser(TEST_ADMIN);
  const parent = await createTestUser(TEST_PARENT);
  adminId = admin.id;
  parentId = parent.id;
  adminToken = await prijaviSe(TEST_ADMIN);
  parentToken = await prijaviSe(TEST_PARENT);

  // Drugi admin postoji da bi se videlo sta osoblje dobija: onaj ko je izvrsio
  // radnju ne dobija obavestenje o njoj, jer je ishod vec pred njim na ekranu.
  const DRUGA_SMENA = { ...TEST_ADMIN, email: 'druga.smena@igraonica.com' };
  await createTestUser(DRUGA_SMENA);
  drugaSmenaToken = await prijaviSe(DRUGA_SMENA);

  const pkg = await request(app)
    .post('/api/packages')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: 'Obavestenja 10h', totalHours: 10, validityDays: 30 });
  packageId = pkg.body.package.id;
});

afterAll(async () => {
  await cleanDB();
  await disconnectDB();
});

beforeEach(async () => {
  await prisma.notification.deleteMany({});
});

describe('Dogadjaji koji prave obavestenja', () => {
  test('roditelj koji doda dete javi to osoblju', async () => {
    const res = await request(app)
      .post('/api/children')
      .set('Authorization', `Bearer ${parentToken}`)
      .send({ firstName: 'Obavesti', lastName: 'Me', dateOfBirth: '2021-01-01', gender: 'FEMALE' });
    qrKod = res.body.child.qrCode;
    deteId = res.body.child.id;

    const kodAdmina = await mojaObavestenja(adminToken);
    const o = kodAdmina.notifications.find((n) => n.type === 'CHILD_ADDED');
    expect(o).toBeTruthy();
    expect(o.body).toContain('Obavesti Me');
    expect(o.body).toContain(qrKod);
    expect(o.data.childId).toBe(deteId);
  });

  test('roditelj ne dobija obavestenje o svojoj radnji', async () => {
    const kodRoditelja = await mojaObavestenja(parentToken);
    expect(kodRoditelja.notifications.some((n) => n.type === 'CHILD_ADDED')).toBe(false);
  });

  test('dodela paketa javi roditelju, ne osoblju', async () => {
    const res = await request(app)
      .post('/api/packages/assign')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userId: parentId, packageId });
    userPackageId = res.body.userPackage.id;

    const kodRoditelja = await mojaObavestenja(parentToken);
    const o = kodRoditelja.notifications.find((n) => n.type === 'PACKAGE_ASSIGNED');
    expect(o).toBeTruthy();
    expect(o.body).toContain('10,0 h');

    const kodAdmina = await mojaObavestenja(adminToken);
    expect(kodAdmina.notifications.some((n) => n.type === 'PACKAGE_ASSIGNED')).toBe(false);
  });

  // Roditelj cita "Vase dete", osoblje cita puno ime - isti dogadjaj, dva teksta.
  test('prijava deteta javi i roditelju i osoblju, razlicitim tekstom', async () => {
    await request(app)
      .post('/api/visits/check-in')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ qrCode: qrKod });

    const kodRoditelja = await mojaObavestenja(parentToken);
    const rod = kodRoditelja.notifications.find((n) => n.type === 'CHILD_CHECKED_IN');
    expect(rod.title).toBe('Dete je u igraonici');
    expect(rod.body).toMatch(/^Obavesti je prijavljena u \d{2}[:.]\d{2}\./);

    const kodDrugeSmene = await mojaObavestenja(drugaSmenaToken);
    const adm = kodDrugeSmene.notifications.find((n) => n.type === 'CHILD_CHECKED_IN');
    expect(adm.title).toBe('Prijava');
    expect(adm.body).toContain('Obavesti Me je prijavljena');
  });

  // Ishod prijave je vec pred radnikom koji je skenirao; feed ne treba da se
  // puni njegovim sopstvenim radnjama.
  test('onaj ko je skenirao ne dobija obavestenje o tome', async () => {
    const kodAdmina = await mojaObavestenja(adminToken);
    expect(kodAdmina.notifications.some((n) => n.type === 'CHILD_CHECKED_IN')).toBe(false);
  });

  test('odjava javi roditelju koliko je naplaceno i sta je ostalo', async () => {
    await request(app)
      .post('/api/visits/check-out')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ qrCode: qrKod });

    const kodRoditelja = await mojaObavestenja(parentToken);
    const o = kodRoditelja.notifications.find((n) => n.type === 'CHILD_CHECKED_OUT');
    expect(o.body).toContain('Naplaceno 1 h');
    expect(o.body).toContain('ostaje 9,0 h');
    expect(o.data.chargedMinutes).toBe(60);
  });

  // Bez pokrica u paketu roditelju ne znaci "u paketu ostaje 0 h" - mora da
  // vidi da je u minusu.
  test('odjava bez paketa javi roditelju minus, a ne preostalo', async () => {
    const bezPaketa = await createTestUser({
      email: `bezpaketa.${Date.now()}@primer.rs`,
      password: 'tajna123',
      firstName: 'Bez',
      lastName: 'Paketa',
    });
    const prijava = await request(app)
      .post('/api/auth/login')
      .send({ email: bezPaketa.email, password: 'tajna123' });

    const dete = await request(app)
      .post('/api/children')
      .set('Authorization', `Bearer ${prijava.body.token}`)
      .send({ firstName: 'Minus', lastName: 'Dete', dateOfBirth: '2021-05-05' });

    await request(app)
      .post('/api/visits/check-in')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ qrCode: dete.body.child.qrCode });
    await request(app)
      .post('/api/visits/check-out')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ qrCode: dete.body.child.qrCode });

    const kodRoditelja = await mojaObavestenja(prijava.body.token);
    const o = kodRoditelja.notifications.find((n) => n.type === 'CHILD_CHECKED_OUT');
    expect(o.body).toContain('u minusu 1,0 h');
    expect(o.body).not.toContain('u paketu ostaje');
    expect(o.data.debtHours).toBe(1);
  });

  test('ispravka sati javi roditelju iznos i razlog', async () => {
    await request(app)
      .post(`/api/packages/${userPackageId}/adjust-hours`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ hours: 2, reason: 'poklon' });

    const kodRoditelja = await mojaObavestenja(parentToken);
    const o = kodRoditelja.notifications.find((n) => n.type === 'HOURS_ADJUSTED');
    expect(o.body).toContain('+2,0 h');
    expect(o.body).toContain('poklon');
  });

  test('nov nalog iz aplikacije javi osoblju', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ firstName: 'Nov', lastName: 'Roditelj', email: `nov.${Date.now()}@primer.rs`, password: 'tajna123' });

    const kodAdmina = await mojaObavestenja(adminToken);
    const o = kodAdmina.notifications.find((n) => n.type === 'PARENT_REGISTERED');
    expect(o.body).toContain('Nov Roditelj');
  });

  test('uklonjeno dete javi osoblju da QR kod vise ne radi', async () => {
    await request(app)
      .delete(`/api/children/${deteId}`)
      .set('Authorization', `Bearer ${parentToken}`);

    const kodAdmina = await mojaObavestenja(adminToken);
    const o = kodAdmina.notifications.find((n) => n.type === 'CHILD_REMOVED');
    expect(o.body).toContain(qrKod);
  });
});

describe('Citanje obavestenja', () => {
  let mojeId;

  beforeEach(async () => {
    await prisma.notification.createMany({
      data: [
        { userId: parentId, type: 'CHILD_CHECKED_IN', title: 'A', body: 'prvo' },
        { userId: parentId, type: 'CHILD_CHECKED_OUT', title: 'B', body: 'drugo' },
        { userId: adminId, type: 'PARENT_REGISTERED', title: 'C', body: 'tudje' },
      ],
    });
    mojeId = (await prisma.notification.findFirst({ where: { userId: parentId } })).id;
  });

  test('svako vidi samo svoja obavestenja', async () => {
    const kodRoditelja = await mojaObavestenja(parentToken);
    expect(kodRoditelja.notifications).toHaveLength(2);
    expect(kodRoditelja.notifications.some((n) => n.body === 'tudje')).toBe(false);
  });

  test('najnovija su prva', async () => {
    const { notifications } = await mojaObavestenja(parentToken);
    const vremena = notifications.map((n) => new Date(n.createdAt).getTime());
    expect(vremena[0]).toBeGreaterThanOrEqual(vremena[1]);
  });

  test('broj neprocitanih stize uz spisak', async () => {
    const { unreadCount } = await mojaObavestenja(parentToken);
    expect(unreadCount).toBe(2);
  });

  test('broj neprocitanih se moze uzeti i sam', async () => {
    const res = await request(app)
      .get('/api/notifications/unread-count')
      .set('Authorization', `Bearer ${parentToken}`);

    expect(res.status).toBe(200);
    expect(res.body.unreadCount).toBe(2);
  });

  test('jedno se moze oznaciti kao procitano', async () => {
    const res = await request(app)
      .patch(`/api/notifications/${mojeId}/read`)
      .set('Authorization', `Bearer ${parentToken}`);

    expect(res.status).toBe(200);
    expect(res.body.notification.readAt).toBeTruthy();
    expect((await mojaObavestenja(parentToken)).unreadCount).toBe(1);
  });

  // Ponovljeni zahtev ne sme da puca - klik moze da stigne dvaput.
  test('ponovno oznacavanje prolazi bez greske', async () => {
    await request(app).patch(`/api/notifications/${mojeId}/read`).set('Authorization', `Bearer ${parentToken}`);
    const res = await request(app).patch(`/api/notifications/${mojeId}/read`).set('Authorization', `Bearer ${parentToken}`);

    expect(res.status).toBe(200);
  });

  test('tudje obavestenje se ne moze oznaciti', async () => {
    const tudje = await prisma.notification.findFirst({ where: { userId: adminId } });

    const res = await request(app)
      .patch(`/api/notifications/${tudje.id}/read`)
      .set('Authorization', `Bearer ${parentToken}`);

    expect(res.status).toBe(404);
    const posle = await prisma.notification.findUnique({ where: { id: tudje.id } });
    expect(posle.readAt).toBeNull();
  });

  test('sve odjednom se moze oznaciti', async () => {
    const res = await request(app)
      .post('/api/notifications/read-all')
      .set('Authorization', `Bearer ${parentToken}`);

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(2);
    expect((await mojaObavestenja(parentToken)).unreadCount).toBe(0);
  });

  test('filter vraca samo neprocitana', async () => {
    await request(app).patch(`/api/notifications/${mojeId}/read`).set('Authorization', `Bearer ${parentToken}`);

    const { notifications } = await mojaObavestenja(parentToken, '?unread=1');
    expect(notifications).toHaveLength(1);
    expect(notifications.every((n) => n.readAt === null)).toBe(true);
  });

  test('neprijavljen korisnik ne vidi nista', async () => {
    const res = await request(app).get('/api/notifications');
    expect(res.status).toBe(401);
  });
});

// Obavestenje ne sme da obori radnju povodom koje nastaje.
describe('Pad obavestenja ne obara radnju', () => {
  test('prijava deteta prolazi i kada upis obavestenja pukne', async () => {
    const dete = await request(app)
      .post('/api/children')
      .set('Authorization', `Bearer ${parentToken}`)
      .send({ firstName: 'Otporno', lastName: 'Dete', dateOfBirth: '2021-01-01' });

    const pukni = jest.spyOn(prisma.notification, 'createMany').mockRejectedValue(new Error('baza puca'));
    const tiho = jest.spyOn(console, 'error').mockImplementation(() => {});

    const res = await request(app)
      .post('/api/visits/check-in')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ qrCode: dete.body.child.qrCode });

    expect(res.status).toBe(201);

    pukni.mockRestore();
    tiho.mockRestore();
    await request(app)
      .post('/api/visits/check-out')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ qrCode: dete.body.child.qrCode });
  });
});
