const request = require('supertest');
const app = require('../src/app');
const { prisma, cleanDB, createTestUser, disconnectDB, TEST_ADMIN, TEST_PARENT } = require('./setup');

let adminToken;
let parentToken;

beforeAll(async () => {
  await cleanDB();

  const admin = await createTestUser(TEST_ADMIN);
  const parent = await createTestUser(TEST_PARENT);

  const adminRes = await request(app)
    .post('/api/auth/login')
    .send({ email: TEST_ADMIN.email, password: TEST_ADMIN.password });
  adminToken = adminRes.body.token;

  const parentRes = await request(app)
    .post('/api/auth/login')
    .send({ email: TEST_PARENT.email, password: TEST_PARENT.password });
  parentToken = parentRes.body.token;

  // Kreiraj test podatke za dashboard
  const child = await prisma.child.create({
    data: {
      firstName: 'Dete',
      lastName: 'Test',
      dateOfBirth: new Date('2020-01-01'),
      qrCode: 'IGR-DASH0001',
      parentId: parent.id,
    },
  });

  const pkg = await prisma.package.create({
    data: { name: 'Test', totalHours: 20, price: 5000, validityDays: 30 },
  });

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);
  const userPkg = await prisma.userPackage.create({
    data: { userId: parent.id, packageId: pkg.id, remainingHours: 20, expiresAt },
  });

  // Kreiraj neke posete (zavrsene danas)
  const now = new Date();
  for (let i = 0; i < 3; i++) {
    const checkedInAt = new Date(now);
    checkedInAt.setHours(checkedInAt.getHours() - 3 + i);
    const checkedOutAt = new Date(checkedInAt);
    checkedOutAt.setMinutes(checkedOutAt.getMinutes() + 60);

    await prisma.visit.create({
      data: {
        childId: child.id,
        userPackageId: userPkg.id,
        checkedInAt,
        checkedOutAt,
        durationMinutes: 60,
        hoursDeducted: 1,
        checkedInById: admin.id,
        checkedOutById: admin.id,
        status: 'CHECKED_OUT',
      },
    });
  }

  // Kreiraj jednu aktivnu posetu
  await prisma.visit.create({
    data: {
      childId: child.id,
      userPackageId: userPkg.id,
      checkedInAt: new Date(),
      checkedInById: admin.id,
      status: 'CHECKED_IN',
    },
  });
});

afterAll(async () => {
  await cleanDB();
  await disconnectDB();
});

describe('GET /api/dashboard/stats', () => {
  test('admin dobija glavne statistike', async () => {
    const res = await request(app)
      .get('/api/dashboard/stats')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.totalUsers).toBeGreaterThanOrEqual(1);
    expect(res.body.totalChildren).toBeGreaterThanOrEqual(1);
    expect(res.body.activeKids).toBeGreaterThanOrEqual(1);
    expect(res.body.pendingCheckouts).toBeGreaterThanOrEqual(1);
    expect(res.body.todayVisits).toBeGreaterThanOrEqual(3);
    expect(res.body.hoursUsedToday).toBeGreaterThanOrEqual(3);
  });

  test('parent ne moze da vidi dashboard', async () => {
    const res = await request(app)
      .get('/api/dashboard/stats')
      .set('Authorization', `Bearer ${parentToken}`);

    expect(res.status).toBe(403);
  });

  test('neprijavljen korisnik ne moze da vidi dashboard', async () => {
    const res = await request(app).get('/api/dashboard/stats');

    expect(res.status).toBe(401);
  });
});

describe('GET /api/dashboard/recent-activity', () => {
  test('admin vidi poslednje aktivnosti', async () => {
    const res = await request(app)
      .get('/api/dashboard/recent-activity')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.visits.length).toBeGreaterThanOrEqual(1);
    res.body.visits.forEach((v) => {
      expect(v.child).toBeDefined();
      expect(v.checkedInBy).toBeDefined();
      expect(v.checkedInBy.password).toBeUndefined();
    });
  });

  test('limit parametar radi', async () => {
    const res = await request(app)
      .get('/api/dashboard/recent-activity?limit=2')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.visits.length).toBeLessThanOrEqual(2);
  });

  test('parent ne moze da vidi aktivnosti', async () => {
    const res = await request(app)
      .get('/api/dashboard/recent-activity')
      .set('Authorization', `Bearer ${parentToken}`);

    expect(res.status).toBe(403);
  });
});

describe('GET /api/dashboard/chart/visits', () => {
  test('admin dobija nedeljni grafikon poseta', async () => {
    const res = await request(app)
      .get('/api/dashboard/chart/visits?period=week')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.period).toBe('week');
    expect(res.body.data.length).toBe(7);

    res.body.data.forEach((d) => {
      expect(d.date).toBeDefined();
      expect(typeof d.count).toBe('number');
    });

    // Danas bi trebalo da ima bar 3 posete
    const today = new Date().toISOString().split('T')[0];
    const todayData = res.body.data.find((d) => d.date === today);
    expect(todayData.count).toBeGreaterThanOrEqual(3);
  });

  test('admin dobija mesecni grafikon poseta', async () => {
    const res = await request(app)
      .get('/api/dashboard/chart/visits?period=month')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.period).toBe('month');
    expect(res.body.data.length).toBe(30);
  });

  test('default period je week', async () => {
    const res = await request(app)
      .get('/api/dashboard/chart/visits')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.period).toBe('week');
    expect(res.body.data.length).toBe(7);
  });

  test('parent ne moze da vidi grafikon', async () => {
    const res = await request(app)
      .get('/api/dashboard/chart/visits')
      .set('Authorization', `Bearer ${parentToken}`);

    expect(res.status).toBe(403);
  });
});

describe('GET /api/dashboard/chart/hours', () => {
  test('admin dobija nedeljni grafikon sati', async () => {
    const res = await request(app)
      .get('/api/dashboard/chart/hours?period=week')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.period).toBe('week');
    expect(res.body.data.length).toBe(7);

    res.body.data.forEach((d) => {
      expect(d.date).toBeDefined();
      expect(typeof d.hours).toBe('number');
    });

    // Danas bi trebalo da ima bar 3 sata
    const today = new Date().toISOString().split('T')[0];
    const todayData = res.body.data.find((d) => d.date === today);
    expect(todayData.hours).toBeGreaterThanOrEqual(3);
  });

  test('admin dobija mesecni grafikon sati', async () => {
    const res = await request(app)
      .get('/api/dashboard/chart/hours?period=month')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(30);
  });

  test('parent ne moze da vidi grafikon sati', async () => {
    const res = await request(app)
      .get('/api/dashboard/chart/hours')
      .set('Authorization', `Bearer ${parentToken}`);

    expect(res.status).toBe(403);
  });
});
