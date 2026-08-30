const request = require('supertest');
const app = require('../src/app');
const { prisma, cleanDB, createTestUser, disconnectDB, TEST_ADMIN, TEST_PARENT } = require('./setup');

let adminToken;
let parentToken;
let admin;
let child;
let userPkg;

// Tacan sat danasnjeg dana, po lokalnom vremenu - isto merilo koje dashboard
// koristi za "danas".
function uDanasUSat(sat, minut = 0) {
  const d = new Date();
  d.setHours(sat, minut, 0, 0);
  return d;
}

// Kljuc danasnjeg dana po LOKALNOM datumu - isti oblik koji dashboard vraca.
// toISOString() bi dao UTC, pa bi se test razisao sa rutom u sitne sate.
function danasnjiKljuc() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

beforeAll(async () => {
  await cleanDB();

  admin = await createTestUser(TEST_ADMIN);
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
  child = await prisma.child.create({
    data: {
      firstName: 'Dete',
      lastName: 'Test',
      dateOfBirth: new Date('2020-01-01'),
      qrCode: 'IGR-DASH0001',
      parentId: parent.id,
    },
  });

  const pkg = await prisma.package.create({
    data: { name: 'Test', totalHours: 20, validityDays: 30 },
  });

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);
  userPkg = await prisma.userPackage.create({
    data: { userId: parent.id, packageId: pkg.id, totalHours: 20, remainingHours: 20, expiresAt },
  });

  // Posete se vezuju za fiksne sate danasnjeg dana (09h, 10h, 11h), a ne za
  // "sada minus 3 sata". Sa relativnim vremenom bi testovi pokretani rano
  // ujutru gurali deo poseta u juce, pa bi padali samo u tom delu dana.
  for (let i = 0; i < 3; i++) {
    const checkedInAt = uDanasUSat(9 + i);
    const checkedOutAt = new Date(checkedInAt);
    checkedOutAt.setMinutes(checkedOutAt.getMinutes() + 60);

    await prisma.visit.create({
      data: {
        childId: child.id,
        userPackageId: userPkg.id,
        checkedInAt,
        checkedOutAt,
        durationMinutes: 60,
        hoursCharged: 1,
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
    const today = danasnjiKljuc();
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
    const today = danasnjiKljuc();
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

// Dashboard je nekada racunao dan preko setUTCHours, pa je kod nas (UTC+1/+2)
// "danas" pocinjalo u 01:00 ili 02:00. Poseta u 00:30 upadala bi u juce.
// Test je namerno vezan za tacan sat, da bi bio isti bez obzira kada se
// pokrece - inace bi i sam bio vremenski osetljiv.
describe('Dashboard racuna dan po lokalnom vremenu', () => {
  const uPolaJedan = () => {
    const d = new Date();
    d.setHours(0, 30, 0, 0);
    return d;
  };

  // Baza dozvoljava najvise jednu otvorenu posetu po detetu, pa ovi testovi ne
  // mogu da koriste dete koje je vec prijavljeno iz ranijih testova.
  let detePonoc;

  beforeAll(async () => {
    detePonoc = await prisma.child.create({
      data: {
        parentId: child.parentId,
        firstName: 'Ponoc',
        lastName: 'Provera',
        dateOfBirth: new Date('2021-01-01'),
        qrCode: 'IGR-PONOC001',
      },
    });
  });

  afterAll(async () => {
    await prisma.visit.deleteMany({ where: { childId: detePonoc.id } });
    await prisma.child.delete({ where: { id: detePonoc.id } });
  });

  async function statistika() {
    const res = await request(app)
      .get('/api/dashboard/stats')
      .set('Authorization', `Bearer ${adminToken}`);
    return res.body;
  }

  test('poseta u 00:30 se broji u danasnji dan', async () => {
    const pre = await statistika();

    const poseta = await prisma.visit.create({
      data: {
        childId: detePonoc.id,
        userPackageId: userPkg.id,
        checkedInAt: uPolaJedan(),
        checkedInById: admin.id,
        status: 'CHECKED_IN',
      },
    });

    try {
      const posle = await statistika();
      expect(posle.todayVisits).toBe(pre.todayVisits + 1);
    } finally {
      await prisma.visit.delete({ where: { id: poseta.id } });
    }
  });

  test('odjava u 00:30 ulazi u danasnje sate', async () => {
    const pre = await statistika();

    const kraj = uPolaJedan();
    const pocetak = new Date(kraj);
    pocetak.setMinutes(pocetak.getMinutes() - 60);

    const poseta = await prisma.visit.create({
      data: {
        childId: child.id,
        userPackageId: userPkg.id,
        checkedInAt: pocetak,
        checkedOutAt: kraj,
        durationMinutes: 60,
        hoursCharged: 1,
        checkedInById: admin.id,
        checkedOutById: admin.id,
        status: 'CHECKED_OUT',
      },
    });

    try {
      const posle = await statistika();
      expect(posle.hoursUsedToday).toBe(pre.hoursUsedToday + 1);
    } finally {
      await prisma.visit.delete({ where: { id: poseta.id } });
    }
  });

  test('grafikon svrstava posetu u 00:30 u danasnji stubic', async () => {
    const poseta = await prisma.visit.create({
      data: {
        childId: detePonoc.id,
        userPackageId: userPkg.id,
        checkedInAt: uPolaJedan(),
        checkedInById: admin.id,
        status: 'CHECKED_IN',
      },
    });

    try {
      const res = await request(app)
        .get('/api/dashboard/chart/visits?period=week')
        .set('Authorization', `Bearer ${adminToken}`);

      // Poslednji stubic je danasnji dan, po lokalnom datumu.
      expect(res.body.data[res.body.data.length - 1].date).toBe(danasnjiKljuc());
      expect(res.body.data[res.body.data.length - 1].count).toBeGreaterThanOrEqual(1);
    } finally {
      await prisma.visit.delete({ where: { id: poseta.id } });
    }
  });
});
