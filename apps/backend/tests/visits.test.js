const request = require('supertest');
const app = require('../src/app');
const { prisma, cleanDB, createTestUser, disconnectDB, TEST_ADMIN, TEST_PARENT } = require('./setup');

let adminToken;
let parentToken;
let parentId;
let child1QR;
let child2QR;
let child1Id;
let child2Id;
let packageId;
let userPackageId;

beforeAll(async () => {
  await cleanDB();

  // Kreiraj korisnike
  await createTestUser(TEST_ADMIN);
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

  // Kreiraj decu
  const child1Res = await request(app)
    .post('/api/children')
    .set('Authorization', `Bearer ${parentToken}`)
    .send({ firstName: 'Marko', lastName: 'M', dateOfBirth: '2020-01-01' });
  child1QR = child1Res.body.child.qrCode;
  child1Id = child1Res.body.child.id;

  const child2Res = await request(app)
    .post('/api/children')
    .set('Authorization', `Bearer ${parentToken}`)
    .send({ firstName: 'Ana', lastName: 'M', dateOfBirth: '2022-03-15' });
  child2QR = child2Res.body.child.qrCode;
  child2Id = child2Res.body.child.id;

  // Kreiraj paket i dodeli roditelju
  const pkgRes = await request(app)
    .post('/api/packages')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: 'Test 10h', totalHours: 10, validityDays: 30 });
  packageId = pkgRes.body.package.id;

  const assignRes = await request(app)
    .post('/api/packages/assign')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ userId: parentId, packageId });
  userPackageId = assignRes.body.userPackage.id;

  // Naplata: puni sati, sa pragom od 15 min preko punog sata
  await prisma.setting.createMany({
    data: [
      { key: 'hour_grace_minutes', value: '15' },
      { key: 'closing_time', value: '21:00' },
    ],
  });
});

afterAll(async () => {
  await cleanDB();
  await disconnectDB();
});

// ==================== CHECK-IN ====================

describe('POST /api/visits/check-in', () => {
  test('admin prijavljuje dete skeniranjem QR koda', async () => {
    const res = await request(app)
      .post('/api/visits/check-in')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ qrCode: child1QR });

    expect(res.status).toBe(201);
    expect(res.body.message).toContain('Marko');
    expect(res.body.message).toContain('prijavljen');
    expect(res.body.visit).toBeDefined();
    expect(res.body.visit.childId).toBe(child1Id);
    expect(res.body.visit.status).toBe('CHECKED_IN');
    expect(res.body.visit.checkedInAt).toBeDefined();
    expect(res.body.visit.checkedOutAt).toBeNull();
    expect(res.body.visit.userPackage).toBeDefined();
    expect(res.body.visit.child.firstName).toBe('Marko');
    expect(res.body.remainingHours).toBe(10);
  });

  test('ne dozvoljava dupli check-in istog deteta', async () => {
    const res = await request(app)
      .post('/api/visits/check-in')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ qrCode: child1QR });

    expect(res.status).toBe(409);
    expect(res.body.message).toContain('vec prijavljeno');
    expect(res.body.visit).toBeDefined();
  });

  test('admin moze prijaviti drugo dete istog roditelja', async () => {
    const res = await request(app)
      .post('/api/visits/check-in')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ qrCode: child2QR });

    expect(res.status).toBe(201);
    expect(res.body.message).toContain('Ana');
    expect(res.body.visit.childId).toBe(child2Id);
  });

  test('vraca 404 za nepostojeci QR kod', async () => {
    const res = await request(app)
      .post('/api/visits/check-in')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ qrCode: 'IGR-NEPOSTOJI' });

    expect(res.status).toBe(404);
    expect(res.body.message).toContain('QR kodom');
  });

  test('vraca 400 bez QR koda', async () => {
    const res = await request(app)
      .post('/api/visits/check-in')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('QR kod je obavezan');
  });

  test('parent ne moze da vrsi check-in', async () => {
    const res = await request(app)
      .post('/api/visits/check-in')
      .set('Authorization', `Bearer ${parentToken}`)
      .send({ qrCode: child1QR });

    expect(res.status).toBe(403);
  });

  test('odbija check-in za deaktivirano dete', async () => {
    await prisma.child.create({
      data: {
        firstName: 'Deaktiviran',
        lastName: 'D',
        dateOfBirth: new Date('2021-01-01'),
        qrCode: 'IGR-DEACT001',
        parentId,
        isActive: false,
      },
    });

    const res = await request(app)
      .post('/api/visits/check-in')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ qrCode: 'IGR-DEACT001' });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('deaktiviran');
  });

  test('prijavljuje dete i kad roditelj nema paket - sati idu u minus', async () => {
    // Kreiraj novog roditelja bez paketa
    const noPackageParent = await createTestUser({
      email: 'bezpaketa@test.com',
      password: 'test123',
      firstName: 'Bez',
      lastName: 'Paketa',
    });

    await prisma.child.create({
      data: {
        firstName: 'Dete',
        lastName: 'BezPaketa',
        dateOfBirth: new Date('2020-06-01'),
        qrCode: 'IGR-NOPKG01',
        parentId: noPackageParent.id,
      },
    });

    const res = await request(app)
      .post('/api/visits/check-in')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ qrCode: 'IGR-NOPKG01' });

    expect(res.status).toBe(201);
    expect(res.body.withoutPackage).toBe(true);
    expect(res.body.visit.userPackageId).toBeNull();
    expect(res.body.remainingHours).toBe(0);
  });

  test('prijavljuje dete i kad su svi sati potroseni', async () => {
    // Postavi preostale sate na 0 za istekli paket
    const emptyParent = await createTestUser({
      email: 'prazansati@test.com',
      password: 'test123',
      firstName: 'Prazan',
      lastName: 'Sati',
    });

    await prisma.child.create({
      data: {
        firstName: 'Dete',
        lastName: 'PrazanSati',
        dateOfBirth: new Date('2020-06-01'),
        qrCode: 'IGR-EMPTY01',
        parentId: emptyParent.id,
      },
    });

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    await prisma.userPackage.create({
      data: {
        userId: emptyParent.id,
        packageId,
        totalHours: 10,
        remainingHours: 0,
        expiresAt,
      },
    });

    const res = await request(app)
      .post('/api/visits/check-in')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ qrCode: 'IGR-EMPTY01' });

    expect(res.status).toBe(201);
    expect(res.body.withoutPackage).toBe(true);
  });

  test('prijavljuje dete i kad je paket istekao', async () => {
    const expiredParent = await createTestUser({
      email: 'istekao@test.com',
      password: 'test123',
      firstName: 'Istekao',
      lastName: 'Paket',
    });

    await prisma.child.create({
      data: {
        firstName: 'Dete',
        lastName: 'IstekaoPaket',
        dateOfBirth: new Date('2020-06-01'),
        qrCode: 'IGR-EXPRD01',
        parentId: expiredParent.id,
      },
    });

    const expiredDate = new Date();
    expiredDate.setDate(expiredDate.getDate() - 1);
    await prisma.userPackage.create({
      data: {
        userId: expiredParent.id,
        packageId,
        totalHours: 10,
        remainingHours: 5,
        expiresAt: expiredDate,
      },
    });

    const res = await request(app)
      .post('/api/visits/check-in')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ qrCode: 'IGR-EXPRD01' });

    expect(res.status).toBe(201);
    expect(res.body.withoutPackage).toBe(true);
  });
});

// ==================== CHECK-OUT ====================

describe('POST /api/visits/check-out', () => {
  test('admin odjavljuje dete skeniranjem QR koda', async () => {
    // Prvo azuriraj check-in vreme da bude pre 1h 10min (70 min)
    const openVisit = await prisma.visit.findFirst({
      where: { childId: child1Id, status: 'CHECKED_IN' },
    });

    const checkedInAt = new Date();
    checkedInAt.setMinutes(checkedInAt.getMinutes() - 70);
    await prisma.visit.update({
      where: { id: openVisit.id },
      data: { checkedInAt },
    });

    const res = await request(app)
      .post('/api/visits/check-out')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ qrCode: child1QR });

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('Marko');
    expect(res.body.message).toContain('odjavljen');
    expect(res.body.visit.status).toBe('CHECKED_OUT');
    expect(res.body.visit.checkedOutAt).toBeDefined();
    expect(res.body.visit.durationMinutes).toBeDefined();
    expect(res.body.visit.child.firstName).toBe('Marko');

    // 70 min = pun sat + 10 min preko, a 10 nije preko praga od 15 → 1 sat
    expect(res.body.duration.raw).toBe(70);
    expect(res.body.duration.charged).toBe(60);
    expect(res.body.duration.hoursDeducted).toBe(1);
    expect(res.body.debtAdded).toBe(0);

    // Preostali sati: 10 - 1 = 9
    expect(res.body.remainingHours).toBe(9);
  });

  test('provera da su sati zaista oduzeti iz paketa', async () => {
    const up = await prisma.userPackage.findUnique({ where: { id: userPackageId } });
    expect(Number(up.remainingHours)).toBe(9);
  });

  test('kratak boravak se naplacuje kao ceo sat', async () => {
    // Check-in child1 ponovo
    await request(app)
      .post('/api/visits/check-in')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ qrCode: child1QR });

    // Postavi check-in na pre 10 minuta
    const visit = await prisma.visit.findFirst({
      where: { childId: child1Id, status: 'CHECKED_IN' },
    });
    const checkedInAt = new Date();
    checkedInAt.setMinutes(checkedInAt.getMinutes() - 10);
    await prisma.visit.update({ where: { id: visit.id }, data: { checkedInAt } });

    const res = await request(app)
      .post('/api/visits/check-out')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ qrCode: child1QR });

    expect(res.status).toBe(200);
    // Svaki boravak je najmanje jedan sat
    expect(res.body.duration.raw).toBe(10);
    expect(res.body.duration.charged).toBe(60);
    expect(res.body.duration.hoursDeducted).toBe(1);

    // 9 - 1 = 8
    expect(res.body.remainingHours).toBe(8);
  });

  test('preko praga od 15 min ide ceo sat', async () => {
    // Check-in child1, postavi na pre 46 min
    await request(app)
      .post('/api/visits/check-in')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ qrCode: child1QR });

    const visit = await prisma.visit.findFirst({
      where: { childId: child1Id, status: 'CHECKED_IN' },
    });
    const checkedInAt = new Date();
    checkedInAt.setMinutes(checkedInAt.getMinutes() - 46);
    await prisma.visit.update({ where: { id: visit.id }, data: { checkedInAt } });

    const res = await request(app)
      .post('/api/visits/check-out')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ qrCode: child1QR });

    // 46 min je preko praga → ceo sat
    expect(res.body.duration.raw).toBe(46);
    expect(res.body.duration.charged).toBe(60);
    expect(res.body.duration.hoursDeducted).toBe(1);

    // 8 - 1 = 7
    expect(res.body.remainingHours).toBe(7);
  });

  test('sati ne idu ispod 0, a nepokriveno ide u minus', async () => {
    // Postavi preostale sate na 0.25 (15 min)
    await prisma.userPackage.update({
      where: { id: userPackageId },
      data: { remainingHours: 0.25 },
    });

    // Check-in i postavi na pre 2 sata
    await request(app)
      .post('/api/visits/check-in')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ qrCode: child1QR });

    const visit = await prisma.visit.findFirst({
      where: { childId: child1Id, status: 'CHECKED_IN' },
    });
    const checkedInAt = new Date();
    checkedInAt.setMinutes(checkedInAt.getMinutes() - 120);
    await prisma.visit.update({ where: { id: visit.id }, data: { checkedInAt } });

    const res = await request(app)
      .post('/api/visits/check-out')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ qrCode: child1QR });

    expect(res.status).toBe(200);
    expect(res.body.remainingHours).toBe(0);

    // Paket je imao 0.25 h, boravak je 2 sata - razlika ide roditelju u minus.
    expect(res.body.duration.hoursDeducted).toBe(2);
    expect(res.body.debtAdded).toBe(1.75);
    expect(res.body.debtHours).toBe(1.75);

    const up = await prisma.userPackage.findUnique({ where: { id: userPackageId } });
    expect(Number(up.remainingHours)).toBe(0);

    const roditelj = await prisma.user.findUnique({ where: { id: parentId } });
    expect(Number(roditelj.debtHours)).toBe(1.75);

    // Minus se posle ovoga ne prenosi na ostale testove.
    await prisma.user.update({ where: { id: parentId }, data: { debtHours: 0 } });
  });

  test('ne moze check-out dete koje nije checked-in', async () => {
    const res = await request(app)
      .post('/api/visits/check-out')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ qrCode: child1QR });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('nije prijavljeno');
  });

  test('vraca 404 za nepostojeci QR kod', async () => {
    const res = await request(app)
      .post('/api/visits/check-out')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ qrCode: 'IGR-NEPOSTOJI' });

    expect(res.status).toBe(404);
  });

  test('vraca 400 bez QR koda', async () => {
    const res = await request(app)
      .post('/api/visits/check-out')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});

    expect(res.status).toBe(400);
  });

  test('parent ne moze da vrsi check-out', async () => {
    const res = await request(app)
      .post('/api/visits/check-out')
      .set('Authorization', `Bearer ${parentToken}`)
      .send({ qrCode: child2QR });

    expect(res.status).toBe(403);
  });
});

// ==================== ACTIVE VISITS ====================

describe('GET /api/visits/active', () => {
  test('admin vidi svu decu u igraonici', async () => {
    const res = await request(app)
      .get('/api/visits/active')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.visits).toBeDefined();
    expect(res.body.count).toBeDefined();
    // child2 je jos checked-in od ranijeg testa
    expect(res.body.count).toBeGreaterThanOrEqual(1);

    res.body.visits.forEach((v) => {
      expect(v.status).toBe('CHECKED_IN');
      expect(v.child).toBeDefined();
      expect(v.child.parent).toBeDefined();
      expect(v.child.parent.password).toBeUndefined();
      expect(v.currentDurationMinutes).toBeDefined();
      expect(typeof v.currentDurationMinutes).toBe('number');
    });
  });

  test('parent ne moze da vidi aktivne posete', async () => {
    const res = await request(app)
      .get('/api/visits/active')
      .set('Authorization', `Bearer ${parentToken}`);

    expect(res.status).toBe(403);
  });
});

// ==================== HISTORY ====================

describe('GET /api/visits/history', () => {
  test('admin vidi istoriju poseta', async () => {
    const res = await request(app)
      .get('/api/visits/history')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.visits.length).toBeGreaterThanOrEqual(1);
    expect(res.body.pagination).toBeDefined();

    res.body.visits.forEach((v) => {
      expect(v.child).toBeDefined();
      expect(v.checkedInBy).toBeDefined();
      expect(v.checkedInBy.password).toBeUndefined();
    });
  });

  test('admin filtrira po statusu', async () => {
    const res = await request(app)
      .get('/api/visits/history?status=CHECKED_OUT')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    res.body.visits.forEach((v) => {
      expect(v.status).toBe('CHECKED_OUT');
    });
  });

  test('admin filtrira po detetu', async () => {
    const res = await request(app)
      .get(`/api/visits/history?childId=${child1Id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    res.body.visits.forEach((v) => {
      expect(v.childId).toBe(child1Id);
    });
  });

  test('admin filtrira po datumu', async () => {
    const today = new Date().toISOString().split('T')[0];
    const res = await request(app)
      .get(`/api/visits/history?dateFrom=${today}&dateTo=${today}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.visits.length).toBeGreaterThanOrEqual(1);
  });

  test('paginacija radi', async () => {
    const res = await request(app)
      .get('/api/visits/history?page=1&limit=1')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.visits.length).toBeLessThanOrEqual(1);
    expect(res.body.pagination.pages).toBeGreaterThanOrEqual(1);
  });

  test('parent ne moze da vidi admin istoriju', async () => {
    const res = await request(app)
      .get('/api/visits/history')
      .set('Authorization', `Bearer ${parentToken}`);

    expect(res.status).toBe(403);
  });
});

// ==================== MY VISITS (roditelj) ====================

describe('GET /api/visits/my', () => {
  test('roditelj vidi posete svoje dece', async () => {
    const res = await request(app)
      .get('/api/visits/my')
      .set('Authorization', `Bearer ${parentToken}`);

    expect(res.status).toBe(200);
    expect(res.body.visits.length).toBeGreaterThanOrEqual(1);
    expect(res.body.pagination).toBeDefined();

    res.body.visits.forEach((v) => {
      expect(v.child).toBeDefined();
      expect([child1Id, child2Id]).toContain(v.childId);
    });
  });

  test('roditelj bez dece dobija praznu listu', async () => {
    await createTestUser({
      email: 'bezdece@test.com',
      password: 'test123',
      firstName: 'Bez',
      lastName: 'Dece',
    });

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'bezdece@test.com', password: 'test123' });

    const res = await request(app)
      .get('/api/visits/my')
      .set('Authorization', `Bearer ${loginRes.body.token}`);

    expect(res.status).toBe(200);
    expect(res.body.visits.length).toBe(0);
  });
});

// ==================== AUTO-CLOSE ====================

describe('POST /api/visits/auto-close', () => {
  beforeAll(async () => {
    // Proveri da child2 je jos checked-in, ako nije, ponovo ga check-in
    const open = await prisma.visit.findFirst({
      where: { childId: child2Id, status: 'CHECKED_IN' },
    });
    if (!open) {
      // Resetuj sate i check-in ponovo
      await prisma.userPackage.update({
        where: { id: userPackageId },
        data: { remainingHours: 5 },
      });
      await prisma.visit.create({
        data: {
          childId: child2Id,
          userPackageId,
          checkedInAt: new Date(Date.now() - 90 * 60000), // pre 90 min
          checkedInById: (await prisma.user.findFirst({ where: { role: 'ADMIN' } })).id,
          status: 'CHECKED_IN',
        },
      });
    }
  });

  test('auto-close zatvara sve otvorene posete', async () => {
    const beforeCount = await prisma.visit.count({ where: { status: 'CHECKED_IN' } });

    const res = await request(app)
      .post('/api/visits/auto-close')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.closed).toBe(beforeCount);
    expect(res.body.message).toContain('automatski zatvoreno');

    // Provera da su sve posete zatvorene
    const afterCount = await prisma.visit.count({ where: { status: 'CHECKED_IN' } });
    expect(afterCount).toBe(0);

    // Provera da imaju status AUTO_CLOSED
    const autoClosed = await prisma.visit.findMany({ where: { status: 'AUTO_CLOSED' } });
    expect(autoClosed.length).toBeGreaterThanOrEqual(1);
    autoClosed.forEach((v) => {
      expect(v.checkedOutAt).toBeDefined();
      expect(v.durationMinutes).toBeDefined();
      expect(v.hoursDeducted).toBeDefined();
    });
  });

  test('auto-close sa 0 otvorenih poseta', async () => {
    const res = await request(app)
      .post('/api/visits/auto-close')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.closed).toBe(0);
    expect(res.body.message).toContain('Nema otvorenih');
  });

  test('parent ne moze da pokrene auto-close', async () => {
    const res = await request(app)
      .post('/api/visits/auto-close')
      .set('Authorization', `Bearer ${parentToken}`);

    expect(res.status).toBe(403);
  });
});

// ==================== BIRA PRAVI PAKET ====================

describe('Check-in bira ispravan paket', () => {
  let smartParentId;
  let smartChildQR;

  beforeAll(async () => {
    const smartParent = await createTestUser({
      email: 'smart@test.com',
      password: 'test123',
      firstName: 'Smart',
      lastName: 'Parent',
    });
    smartParentId = smartParent.id;

    const smartChild = await prisma.child.create({
      data: {
        firstName: 'SmartDete',
        lastName: 'S',
        dateOfBirth: new Date('2020-01-01'),
        qrCode: 'IGR-SMART001',
        parentId: smartParentId,
      },
    });
    smartChildQR = smartChild.qrCode;
  });

  test('bira paket koji istice prvi (najhitniji)', async () => {
    const soon = new Date();
    soon.setDate(soon.getDate() + 5);
    const later = new Date();
    later.setDate(later.getDate() + 25);

    const [soonPkg] = await Promise.all([
      prisma.userPackage.create({
        data: {
          userId: smartParentId,
          packageId,
          totalHours: 10,
          remainingHours: 3,
          expiresAt: soon,
        },
      }),
      prisma.userPackage.create({
        data: {
          userId: smartParentId,
          packageId,
          totalHours: 10,
          remainingHours: 8,
          expiresAt: later,
        },
      }),
    ]);

    const res = await request(app)
      .post('/api/visits/check-in')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ qrCode: smartChildQR });

    expect(res.status).toBe(201);
    // Treba da koristi paket koji istice ranije
    expect(res.body.visit.userPackageId).toBe(soonPkg.id);
    expect(res.body.remainingHours).toBe(3);

    // Cleanup - check-out
    await request(app)
      .post('/api/visits/check-out')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ qrCode: smartChildQR });
  });

  test('preskace istekle i prazne pakete', async () => {
    // Dodaj istekli i prazan paket
    const expired = new Date();
    expired.setDate(expired.getDate() - 10);
    await prisma.userPackage.create({
      data: {
        userId: smartParentId,
        packageId,
        totalHours: 50,
        remainingHours: 50,
        expiresAt: expired,
      },
    });

    const future = new Date();
    future.setDate(future.getDate() + 20);
    await prisma.userPackage.create({
      data: {
        userId: smartParentId,
        packageId,
        totalHours: 10,
        remainingHours: 0,
        expiresAt: future,
      },
    });

    const res = await request(app)
      .post('/api/visits/check-in')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ qrCode: smartChildQR });

    expect(res.status).toBe(201);
    // Treba da koristi jedan od validnih paketa, ne istekli/prazan
    expect(res.body.remainingHours).toBeGreaterThan(0);
  });
});

// ==================== ISTOVREMENA SKENIRANJA ====================

// Provera "da li je dete vec prijavljeno" i skidanje sati bili su citanje pa
// upis, bez brave izmedju. Dva skeniranja u istom trenutku - dva radnika, ili
// dupli dodir - prolazila su oba.
describe('Istovremena skeniranja', () => {
  let qr;

  beforeEach(async () => {
    await prisma.visit.deleteMany({});
    await prisma.userPackage.update({
      where: { id: userPackageId },
      data: { remainingHours: 10 },
    });

    const res = await request(app)
      .post('/api/children')
      .set('Authorization', `Bearer ${parentToken}`)
      .send({ firstName: 'Trka', lastName: 'T', dateOfBirth: '2021-01-01' });
    qr = res.body.child.qrCode;
  });

  const prijava = () =>
    request(app)
      .post('/api/visits/check-in')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ qrCode: qr });

  const odjava = () =>
    request(app)
      .post('/api/visits/check-out')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ qrCode: qr });

  test('pet istovremenih prijava otvara tacno jednu posetu', async () => {
    const odgovori = await Promise.all(Array.from({ length: 5 }, prijava));

    expect(odgovori.filter((r) => r.status === 201)).toHaveLength(1);
    expect(odgovori.filter((r) => r.status === 409)).toHaveLength(4);

    const otvorene = await prisma.visit.count({ where: { status: 'CHECKED_IN' } });
    expect(otvorene).toBe(1);
  });

  test('odbijena prijava vraca postojecu posetu, ne golu gresku', async () => {
    await prijava();
    const odgovori = await Promise.all([prijava(), prijava()]);

    for (const r of odgovori.filter((x) => x.status === 409)) {
      expect(r.body.message).toBe('Dete je vec prijavljeno u igraonici.');
      expect(r.body.visit?.status).toBe('CHECKED_IN');
    }
  });

  test('pet istovremenih odjava zatvara posetu jednom', async () => {
    await prijava();

    const odgovori = await Promise.all(Array.from({ length: 5 }, odjava));

    expect(odgovori.filter((r) => r.status === 200)).toHaveLength(1);
    expect(odgovori.filter((r) => r.status === 400)).toHaveLength(4);
  });

  test('pet istovremenih odjava skida sate samo jednom', async () => {
    await prijava();

    await Promise.all(Array.from({ length: 5 }, odjava));

    const up = await prisma.userPackage.findUnique({ where: { id: userPackageId } });
    expect(Number(up.remainingHours)).toBe(9);
  });

  // Radnik odjavljuje dete, a admin u istom trenutku dodaje sate. Ranije bi
  // jedna od te dve promene bila pregazena, jer su obe citale staru vrednost.
  test('odjava i korekcija sati u istom trenutku - obe promene ostaju', async () => {
    await prijava();

    await Promise.all([
      odjava(),
      request(app)
        .post(`/api/packages/${userPackageId}/adjust-hours`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ hours: 2, reason: 'trka' }),
    ]);

    const up = await prisma.userPackage.findUnique({ where: { id: userPackageId } });
    expect(Number(up.remainingHours)).toBe(11); // 10 - 1 + 2
  });

  test('posle odjave sledeca prijava opet prolazi', async () => {
    await prijava();
    await odjava();

    const opet = await prijava();

    expect(opet.status).toBe(201);
    const otvorene = await prisma.visit.count({ where: { status: 'CHECKED_IN' } });
    expect(otvorene).toBe(1);
  });
});
