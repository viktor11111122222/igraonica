const request = require('supertest');
const app = require('../src/app');
const { prisma, cleanDB, createTestUser, disconnectDB, TEST_ADMIN } = require('./setup');

// Dete se prijavljuje i kad roditelj nema paket. Boravak se tada pri odjavi
// upisuje roditelju u minus sate, koji se skidaju kad plati - dugmetom u
// panelu ili tako sto nov paket pokrije minus.

let adminToken;
let packageId;

async function napraviRoditelja(prefiks) {
  const email = `${prefiks}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@primer.rs`;
  const user = await createTestUser({
    email,
    password: 'tajna123',
    firstName: 'Minus',
    lastName: 'Roditelj',
  });
  const prijava = await request(app).post('/api/auth/login').send({ email, password: 'tajna123' });
  return { id: user.id, token: prijava.body.token };
}

async function napraviDete(roditelj, ime = 'Dete') {
  const res = await request(app)
    .post('/api/children')
    .set('Authorization', `Bearer ${roditelj.token}`)
    .send({ firstName: ime, lastName: 'Minusic', dateOfBirth: '2021-01-01' });
  return res.body.child;
}

const prijavi = (qrCode) =>
  request(app)
    .post('/api/visits/check-in')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ qrCode });

const odjavi = (qrCode) =>
  request(app)
    .post('/api/visits/check-out')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ qrCode });

// Poseta se "produzava" pomeranjem trenutka prijave unazad.
async function boravakOd(childId, minuta) {
  const poseta = await prisma.visit.findFirst({ where: { childId, status: 'CHECKED_IN' } });
  const pre = new Date();
  pre.setMinutes(pre.getMinutes() - minuta);
  await prisma.visit.update({ where: { id: poseta.id }, data: { checkedInAt: pre } });
}

async function dugRoditelja(id) {
  const user = await prisma.user.findUnique({ where: { id } });
  return Number(user.debtHours);
}

async function dodeliPaket(userId, sati) {
  const pkg = await request(app)
    .post('/api/packages')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: `Paket ${sati}h`, totalHours: sati, validityDays: 30 });

  return request(app)
    .post('/api/packages/assign')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ userId, packageId: pkg.body.package.id });
}

beforeAll(async () => {
  await cleanDB();
  await createTestUser(TEST_ADMIN);

  const prijava = await request(app)
    .post('/api/auth/login')
    .send({ email: TEST_ADMIN.email, password: TEST_ADMIN.password });
  adminToken = prijava.body.token;

  await prisma.setting.create({ data: { key: 'hour_grace_minutes', value: '15' } });

  const pkg = await request(app)
    .post('/api/packages')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: 'Minus 10h', totalHours: 10, validityDays: 30 });
  packageId = pkg.body.package.id;
});

afterAll(async () => {
  await cleanDB();
  await disconnectDB();
});

describe('Prijava bez paketa', () => {
  test('dete ulazi, poseta nema paket', async () => {
    const roditelj = await napraviRoditelja('ulazak');
    const dete = await napraviDete(roditelj);

    const res = await prijavi(dete.qrCode);

    expect(res.status).toBe(201);
    expect(res.body.withoutPackage).toBe(true);
    expect(res.body.visit.userPackageId).toBeNull();
    expect(res.body.remainingHours).toBe(0);
    expect(res.body.debtHours).toBe(0);
  });

  test('sa paketom se ne javlja minus', async () => {
    const roditelj = await napraviRoditelja('sapaketom');
    await request(app)
      .post('/api/packages/assign')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userId: roditelj.id, packageId });
    const dete = await napraviDete(roditelj);

    const res = await prijavi(dete.qrCode);

    expect(res.status).toBe(201);
    expect(res.body.withoutPackage).toBe(false);
    expect(res.body.remainingHours).toBe(10);
  });
});

describe('Odjava bez paketa upisuje minus', () => {
  test('dva sata boravka daju dva sata minusa', async () => {
    const roditelj = await napraviRoditelja('dvasata');
    const dete = await napraviDete(roditelj);

    await prijavi(dete.qrCode);
    await boravakOd(dete.id, 120);
    const res = await odjavi(dete.qrCode);

    expect(res.status).toBe(200);
    expect(res.body.duration.hoursDeducted).toBe(2);
    expect(res.body.debtAdded).toBe(2);
    expect(res.body.debtHours).toBe(2);
    // Radnik ne treba da vidi "Preostalo: 0,0 h" - paketa nema.
    expect(res.body.withoutPackage).toBe(true);
    expect(await dugRoditelja(roditelj.id)).toBe(2);
  });

  test('minus se vidi i na samoj poseti', async () => {
    const roditelj = await napraviRoditelja('poseta');
    const dete = await napraviDete(roditelj);

    await prijavi(dete.qrCode);
    await boravakOd(dete.id, 60);
    await odjavi(dete.qrCode);

    const poseta = await prisma.visit.findFirst({ where: { childId: dete.id } });
    expect(Number(poseta.debtHours)).toBe(1);
    expect(Number(poseta.hoursDeducted)).toBe(1);
    expect(poseta.userPackageId).toBeNull();
  });

  test('svaki sledeci boravak se dodaje na minus', async () => {
    const roditelj = await napraviRoditelja('sabiranje');
    const dete = await napraviDete(roditelj);

    await prijavi(dete.qrCode);
    await boravakOd(dete.id, 120);
    await odjavi(dete.qrCode);

    await prijavi(dete.qrCode);
    await boravakOd(dete.id, 30);
    const res = await odjavi(dete.qrCode);

    expect(res.body.debtAdded).toBe(1);
    expect(res.body.debtHours).toBe(3);
    expect(await dugRoditelja(roditelj.id)).toBe(3);
  });

  test('dvoje dece istog roditelja pune isti minus', async () => {
    const roditelj = await napraviRoditelja('dvoje');
    const prvo = await napraviDete(roditelj, 'Prvo');
    const drugo = await napraviDete(roditelj, 'Drugo');

    await prijavi(prvo.qrCode);
    await boravakOd(prvo.id, 60);
    await odjavi(prvo.qrCode);

    await prijavi(drugo.qrCode);
    await boravakOd(drugo.id, 60);
    await odjavi(drugo.qrCode);

    expect(await dugRoditelja(roditelj.id)).toBe(2);
  });

  test('roditelj vidi minus uz svoje pakete', async () => {
    const roditelj = await napraviRoditelja('aplikacija');
    const dete = await napraviDete(roditelj);

    await prijavi(dete.qrCode);
    await boravakOd(dete.id, 120);
    await odjavi(dete.qrCode);

    const res = await request(app)
      .get('/api/packages/my')
      .set('Authorization', `Bearer ${roditelj.token}`);

    expect(res.status).toBe(200);
    expect(res.body.debtHours).toBe(2);
  });
});

// Paket koji je ostao kraci od boravka ranije je "nestajao" na nuli i ostatak
// se nije naplacivao nikome.
describe('Paket koji ne pokriva ceo boravak', () => {
  test('pokriveno ide iz paketa, ostatak u minus', async () => {
    const roditelj = await napraviRoditelja('delimicno');
    const dete = await napraviDete(roditelj);
    const dodela = await dodeliPaket(roditelj.id, 1);

    await prijavi(dete.qrCode);
    await boravakOd(dete.id, 180);
    const res = await odjavi(dete.qrCode);

    expect(res.body.duration.hoursDeducted).toBe(3);
    expect(res.body.remainingHours).toBe(0);
    expect(res.body.debtAdded).toBe(2);
    expect(await dugRoditelja(roditelj.id)).toBe(2);

    const up = await prisma.userPackage.findUnique({ where: { id: dodela.body.userPackage.id } });
    expect(Number(up.remainingHours)).toBe(0);
  });

  test('paket koji pokriva sve ne pravi minus', async () => {
    const roditelj = await napraviRoditelja('pokriva');
    const dete = await napraviDete(roditelj);
    await dodeliPaket(roditelj.id, 5);

    await prijavi(dete.qrCode);
    await boravakOd(dete.id, 120);
    const res = await odjavi(dete.qrCode);

    expect(res.body.debtAdded).toBe(0);
    expect(res.body.debtHours).toBe(0);
    expect(res.body.remainingHours).toBe(3);
    expect(res.body.withoutPackage).toBe(false);
    expect(await dugRoditelja(roditelj.id)).toBe(0);
  });
});

describe('Naplata minusa u panelu', () => {
  test('admin ponistava minus kad roditelj plati', async () => {
    const roditelj = await napraviRoditelja('naplata');
    const dete = await napraviDete(roditelj);
    await prijavi(dete.qrCode);
    await boravakOd(dete.id, 120);
    await odjavi(dete.qrCode);

    const res = await request(app)
      .post(`/api/users/${roditelj.id}/settle-debt`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.settledHours).toBe(2);
    expect(res.body.debtHours).toBe(0);
    expect(await dugRoditelja(roditelj.id)).toBe(0);
  });

  test('bez minusa nema sta da se naplati', async () => {
    const roditelj = await napraviRoditelja('bezminusa');

    const res = await request(app)
      .post(`/api/users/${roditelj.id}/settle-debt`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('nema minus');
  });

  test('roditelj ne moze sam sebi da ponisti minus', async () => {
    const roditelj = await napraviRoditelja('sam');
    const dete = await napraviDete(roditelj);
    await prijavi(dete.qrCode);
    await boravakOd(dete.id, 60);
    await odjavi(dete.qrCode);

    const res = await request(app)
      .post(`/api/users/${roditelj.id}/settle-debt`)
      .set('Authorization', `Bearer ${roditelj.token}`);

    expect(res.status).toBe(403);
    expect(await dugRoditelja(roditelj.id)).toBe(1);
  });

  test('vraca 404 za nepostojeceg korisnika', async () => {
    const res = await request(app)
      .post('/api/users/00000000-0000-0000-0000-000000000000/settle-debt')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });
});

describe('Nov paket pokriva minus', () => {
  test('minus se skida sa dodeljenog paketa', async () => {
    const roditelj = await napraviRoditelja('pokrice');
    const dete = await napraviDete(roditelj);
    await prijavi(dete.qrCode);
    await boravakOd(dete.id, 180);
    await odjavi(dete.qrCode);
    expect(await dugRoditelja(roditelj.id)).toBe(3);

    const res = await request(app)
      .post('/api/packages/assign')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userId: roditelj.id, packageId });

    expect(res.status).toBe(201);
    expect(res.body.settledDebtHours).toBe(3);
    // Ukupno ostaje pun paket, preostalo je umanjeno za minus.
    expect(Number(res.body.userPackage.totalHours)).toBe(10);
    expect(Number(res.body.userPackage.remainingHours)).toBe(7);
    expect(await dugRoditelja(roditelj.id)).toBe(0);
  });

  test('paket manji od minusa ostavlja ostatak duga', async () => {
    const roditelj = await napraviRoditelja('manji');
    const dete = await napraviDete(roditelj);
    await prijavi(dete.qrCode);
    await boravakOd(dete.id, 300);
    await odjavi(dete.qrCode);
    expect(await dugRoditelja(roditelj.id)).toBe(5);

    const res = await dodeliPaket(roditelj.id, 2);

    expect(res.body.settledDebtHours).toBe(2);
    expect(Number(res.body.userPackage.remainingHours)).toBe(0);
    expect(await dugRoditelja(roditelj.id)).toBe(3);
  });

  test('bez minusa paket dolazi ceo', async () => {
    const roditelj = await napraviRoditelja('cist');

    const res = await dodeliPaket(roditelj.id, 4);

    expect(res.body.settledDebtHours).toBe(0);
    expect(Number(res.body.userPackage.remainingHours)).toBe(4);
  });
});

describe('Auto-zatvaranje i minus', () => {
  test('poseta bez paketa se zatvara u minus', async () => {
    const roditelj = await napraviRoditelja('autoclose');
    const dete = await napraviDete(roditelj);
    await prijavi(dete.qrCode);
    await boravakOd(dete.id, 120);

    const res = await request(app)
      .post('/api/visits/auto-close')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(await dugRoditelja(roditelj.id)).toBe(2);

    const poseta = await prisma.visit.findFirst({ where: { childId: dete.id } });
    expect(poseta.status).toBe('AUTO_CLOSED');
    expect(Number(poseta.debtHours)).toBe(2);
  });

  // Dvoje dece istog roditelja trose isti paket. Ranije se svako racunalo od
  // istog pocetnog stanja, pa se sati skidali samo za jedno.
  test('dvoje dece na istom paketu ne trose iste sate dvaput', async () => {
    const roditelj = await napraviRoditelja('istipaket');
    const prvo = await napraviDete(roditelj, 'Prvo');
    const drugo = await napraviDete(roditelj, 'Drugo');
    const dodela = await dodeliPaket(roditelj.id, 3);

    await prijavi(prvo.qrCode);
    await prijavi(drugo.qrCode);
    await boravakOd(prvo.id, 120);
    await boravakOd(drugo.id, 120);

    await request(app)
      .post('/api/visits/auto-close')
      .set('Authorization', `Bearer ${adminToken}`);

    const up = await prisma.userPackage.findUnique({ where: { id: dodela.body.userPackage.id } });
    // 3 sata paketa, 4 sata boravka: paket na nuli, jedan sat u minusu.
    expect(Number(up.remainingHours)).toBe(0);
    expect(await dugRoditelja(roditelj.id)).toBe(1);
  });
});

// Odjava je trenutak naplate na pultu: radnik mora da vidi stari minus i kad
// je ovaj boravak pokriven paketom.
describe('Stari minus se vidi i pri pokrivenoj odjavi', () => {
  test('odjava vraca ukupan minus roditelja', async () => {
    const roditelj = await napraviRoditelja('stariminus');
    const dete = await napraviDete(roditelj);

    // Paket se dodeljuje pre minusa, inace bi ga odmah pokrio.
    await dodeliPaket(roditelj.id, 5);
    await prisma.user.update({ where: { id: roditelj.id }, data: { debtHours: 2 } });

    await prijavi(dete.qrCode);
    await boravakOd(dete.id, 30);
    const res = await odjavi(dete.qrCode);

    expect(res.body.debtAdded).toBe(0);
    expect(res.body.debtHours).toBe(2);
  });
});
