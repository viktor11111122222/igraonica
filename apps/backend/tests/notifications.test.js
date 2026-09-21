const request = require('supertest');
const app = require('../src/app');
const {
  prisma,
  cleanDB,
  createTestUser,
  disconnectDB,
  TEST_ADMIN,
  TEST_PARENT,
  prijaviSe,
} = require('./setup');

let adminToken;
let drugaSmenaToken;
let parentToken;
let adminId;
let parentId;
let qrKod;
let deteId;
let userPackageId;
let packageId;

const mojaObavestenja = async (token, upit = '') =>
  (await request(app).get(`/api/notifications${upit}`).set('Authorization', `Bearer ${token}`)).body;

beforeAll(async () => {
  await cleanDB();
  const admin = await createTestUser(TEST_ADMIN);
  const parent = await createTestUser(TEST_PARENT);
  adminId = admin.id;
  parentId = parent.id;
  adminToken = await prijaviSe(app, TEST_ADMIN);
  parentToken = await prijaviSe(app, TEST_PARENT);

  // Drugi admin postoji da bi se videlo sta osoblje dobija: onaj ko je izvrsio
  // radnju ne dobija obavestenje o njoj, jer je ishod vec pred njim na ekranu.
  const DRUGA_SMENA = { ...TEST_ADMIN, email: 'druga.smena@igraonica.com' };
  await createTestUser(DRUGA_SMENA);
  drugaSmenaToken = await prijaviSe(app, DRUGA_SMENA);

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

// Nocno auto-zatvaranje je jedini put na kom roditelj ne vidi radnika. Bez
// obavestenja bi ujutru zatekao minus bez ijednog traga odakle je dosao.
describe('Auto-zatvaranje javlja roditelju', () => {
  let qrAuto;
  let tokenRoditelja;

  beforeAll(async () => {
    const email = `autoclose.${Date.now()}@primer.rs`;
    await createTestUser({ email, password: 'tajna123', firstName: 'Auto', lastName: 'Roditelj' });
    tokenRoditelja = await prijaviSe(app, { email, password: 'tajna123' });

    const dete = await request(app)
      .post('/api/children')
      .set('Authorization', `Bearer ${tokenRoditelja}`)
      .send({ firstName: 'Nocni', lastName: 'Gost', dateOfBirth: '2021-02-02', gender: 'MALE' });
    qrAuto = dete.body.child.qrCode;
  });

  test('roditelj dobija odjavu sa naplatom i minusom', async () => {
    await request(app)
      .post('/api/visits/check-in')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ qrCode: qrAuto });

    await request(app)
      .post('/api/visits/auto-close')
      .set('Authorization', `Bearer ${adminToken}`);

    const kodRoditelja = await mojaObavestenja(tokenRoditelja);
    const o = kodRoditelja.notifications.find((n) => n.type === 'CHILD_CHECKED_OUT');
    expect(o).toBeTruthy();
    expect(o.body).toContain('Naplaceno 1 h');
    expect(o.body).toContain('u minusu');
  });

  // Nocu se zatvara i po dvadeset poseta; osoblju bi to bilo dvadeset istih
  // poruka ujutru.
  test('osoblje ne dobija poruku po svakoj zatvorenoj poseti', async () => {
    const kodDrugeSmene = await mojaObavestenja(drugaSmenaToken);
    const odjave = kodDrugeSmene.notifications.filter(
      (n) => n.type === 'CHILD_CHECKED_OUT' && n.body.includes('Nocni Gost')
    );
    expect(odjave).toHaveLength(0);
  });
});

// Minus nestaje sa naloga kad ga osoblje naplati - roditelj mora da vidi zasto.
describe('Naplata minusa javlja roditelju', () => {
  test('posle naplate stize poruka sa iznosom', async () => {
    const email = `naplata.${Date.now()}@primer.rs`;
    const roditelj = await createTestUser({
      email,
      password: 'tajna123',
      firstName: 'Naplata',
      lastName: 'Roditelj',
    });
    const prijava = await request(app).post('/api/auth/login').send({ email, password: 'tajna123' });

    await prisma.user.update({ where: { id: roditelj.id }, data: { debtHours: 3 } });

    await request(app)
      .post(`/api/users/${roditelj.id}/settle-debt`)
      .set('Authorization', `Bearer ${adminToken}`);

    const kodRoditelja = await mojaObavestenja(prijava.body.token);
    const o = kodRoditelja.notifications.find((n) => n.type === 'DEBT_SETTLED');
    expect(o).toBeTruthy();
    expect(o.body).toContain('3,0 h');
    expect(o.data.hours).toBe(3);
  });
});

// Obavestenja se upisuju u grupi (`createMany`, jedno po clanu osoblja), pa
// vise redova ima isti `createdAt` do milisekunde. Sortiranje samo po vremenu
// tada nije odredjeno - baza sme da vrati redove u bilo kom poretku, a uz
// `skip`/`take` to znaci da isti red ume da se pojavi na dve strane ili da se
// preskoci. Zato u sortiranju stoji i `id` kao razresilac izjednacenja.
describe('Stranicenje je stabilno i kada je vreme isto', () => {
  const UKUPNO = 25;
  let mojToken;
  let mojId;

  beforeAll(async () => {
    const email = `stranicenje.${Date.now()}@primer.rs`;
    const korisnik = await createTestUser({
      email,
      password: 'tajna123',
      firstName: 'Strana',
      lastName: 'Test',
    });
    mojId = korisnik.id;
    mojToken = await prijaviSe(app, { email, password: 'tajna123' });
  });

  // Fajl ima beforeEach koji brise sva obavestenja, a on ide pre ovog - zato
  // se podaci prave ovde, a ne u beforeAll.
  beforeEach(async () => {
    // Sva obavestenja sa istim `createdAt` - bas slucaj koji je pucao.
    const isti = new Date();
    await prisma.notification.createMany({
      data: Array.from({ length: UKUPNO }, (_, i) => ({
        userId: mojId,
        type: 'PARENT_REGISTERED',
        title: `Naslov ${i}`,
        body: `Telo ${i}`,
        createdAt: isti,
      })),
    });
  });

  const strana = async (broj, limit = 10) =>
    (
      await request(app)
        .get(`/api/notifications?page=${broj}&limit=${limit}`)
        .set('Authorization', `Bearer ${mojToken}`)
    ).body;

  test('isti upit dva puta vraca isti redosled', async () => {
    const prvi = await strana(1);
    const drugi = await strana(1);

    expect(prvi.notifications.map((n) => n.id)).toEqual(drugi.notifications.map((n) => n.id));
  });

  test('strane se ne preklapaju i nista ne izostaje', async () => {
    const [a, b, c] = [await strana(1), await strana(2), await strana(3)];
    const svi = [...a.notifications, ...b.notifications, ...c.notifications].map((n) => n.id);

    // Nijedan red dvaput...
    expect(new Set(svi).size).toBe(svi.length);
    // ...i svi su tu.
    expect(svi).toHaveLength(UKUPNO);
    expect(a.pagination.total).toBe(UKUPNO);
  });

  // Ovaj test je taj koji stvarno cuva popravku.
  //
  // Poredjenje rezultata sa samim sobom nije dovoljno: i bez razresioca
  // izjednacenja baza vrati redove nekim svojim redom, pa su dva citanja
  // slucajno ista. Zato se ovde tvrdi APSOLUTAN poredak - kod istog vremena
  // odlucuje `id` opadajuce. Bez toga poredak prati fizicki raspored redova u
  // tabeli i ovaj test pada.
  test('kod istog vremena poredak odredjuje id, opadajuce', async () => {
    const svi = [];
    for (let p = 1; p <= 3; p++) svi.push(...(await strana(p)).notifications.map((n) => n.id));

    expect(svi).toEqual([...svi].sort().reverse());
  });

  // UPDATE u Postgresu ne menja red na mestu nego upisuje novu verziju na kraj
  // tabele, pa se azurirani redovi u citanju pomeraju. Sa razresiocem to nista
  // ne menja; bez njega bi prva strana izgledala drugacije - a to je ono sto
  // roditelj vidi kao obavestenje koje "nestane" ili se pojavi dvaput.
  test('poredak prezivljava izmenu redova u tabeli', async () => {
    const pre = (await strana(1)).notifications.map((n) => n.id);

    for (const id of pre.slice(0, 5)) {
      await prisma.notification.update({ where: { id }, data: { title: 'Pomeren' } });
    }

    const posle = (await strana(1)).notifications.map((n) => n.id);

    expect(posle).toEqual(pre);
  });

  test('ponovljeno listanje daje isti skup', async () => {
    const pokupi = async () => {
      const out = [];
      for (let p = 1; p <= 3; p++) out.push(...(await strana(p)).notifications.map((n) => n.id));
      return out;
    };

    expect(await pokupi()).toEqual(await pokupi());
  });
});
