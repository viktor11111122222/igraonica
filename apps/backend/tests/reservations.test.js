const request = require('supertest');
const app = require('../src/app');
const { prisma, cleanDB, createTestUser, disconnectDB, TEST_ADMIN, TEST_PARENT } = require('./setup');

let adminToken;
let parentToken;
let parentId;
let reservationId;

const futureDate = new Date();
futureDate.setDate(futureDate.getDate() + 14);
const futureDateStr = futureDate.toISOString().split('T')[0];

const pastDate = new Date();
pastDate.setDate(pastDate.getDate() - 7);
const pastDateStr = pastDate.toISOString().split('T')[0];

beforeAll(async () => {
  await cleanDB();

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
});

afterAll(async () => {
  await cleanDB();
  await disconnectDB();
});

describe('POST /api/reservations', () => {
  test('admin kreira rodjendan rezervaciju', async () => {
    const res = await request(app)
      .post('/api/reservations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        type: 'BIRTHDAY',
        title: 'Rodjendan Marka',
        date: futureDateStr,
        startTime: '14:00',
        endTime: '18:00',
        guestCount: 15,
        childName: 'Marko',
        childAge: 6,
        contactPhone: '0641234567',
        notes: 'Torta od cokolade',
        userId: parentId,
      });

    expect(res.status).toBe(201);
    expect(res.body.reservation.type).toBe('BIRTHDAY');
    expect(res.body.reservation.title).toBe('Rodjendan Marka');
    expect(res.body.reservation.guestCount).toBe(15);
    expect(res.body.reservation.childName).toBe('Marko');
    expect(res.body.reservation.childAge).toBe(6);
    expect(res.body.reservation.status).toBe('PENDING');
    expect(res.body.reservation.user).toBeDefined();
    expect(res.body.reservation.user.password).toBeUndefined();
    reservationId = res.body.reservation.id;
  });

  test('admin kreira privatni dogadjaj bez korisnika', async () => {
    const nextDay = new Date(futureDate);
    nextDay.setDate(nextDay.getDate() + 1);
    const nextDayStr = nextDay.toISOString().split('T')[0];

    const res = await request(app)
      .post('/api/reservations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        type: 'PRIVATE_EVENT',
        title: 'Korporativni dogadjaj',
        date: nextDayStr,
        startTime: '10:00',
        endTime: '22:00',
        isFullDay: true,
        contactPhone: '0651111111',
      });

    expect(res.status).toBe(201);
    expect(res.body.reservation.isFullDay).toBe(true);
    expect(res.body.reservation.user).toBeNull();
  });

  test('admin kreira grupno bukiranje', async () => {
    const res = await request(app)
      .post('/api/reservations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        type: 'GROUP_BOOKING',
        title: 'Vrtic Sunce',
        date: futureDateStr,
        startTime: '09:00',
        endTime: '12:00',
        guestCount: 25,
      });

    expect(res.status).toBe(201);
    expect(res.body.reservation.type).toBe('GROUP_BOOKING');
  });

  test('validira obavezna polja', async () => {
    const res = await request(app)
      .post('/api/reservations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Samo naslov' });

    expect(res.status).toBe(400);
    expect(res.body.errors).toBeDefined();
  });

  test('validira tip rezervacije', async () => {
    const res = await request(app)
      .post('/api/reservations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        type: 'WEDDING',
        title: 'Test',
        date: futureDateStr,
        startTime: '10:00',
        endTime: '12:00',
      });

    expect(res.status).toBe(400);
  });

  test('vraca 404 za nepostojeceg korisnika', async () => {
    const res = await request(app)
      .post('/api/reservations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        type: 'BIRTHDAY',
        title: 'Test',
        date: futureDateStr,
        startTime: '10:00',
        endTime: '12:00',
        userId: '00000000-0000-0000-0000-000000000000',
      });

    expect(res.status).toBe(404);
  });

  test('parent ne moze da kreira rezervaciju', async () => {
    const res = await request(app)
      .post('/api/reservations')
      .set('Authorization', `Bearer ${parentToken}`)
      .send({
        type: 'BIRTHDAY',
        title: 'Test',
        date: futureDateStr,
        startTime: '10:00',
        endTime: '12:00',
      });

    expect(res.status).toBe(403);
  });
});

describe('GET /api/reservations', () => {
  beforeAll(async () => {
    // Dodaj proslu i otkazanu rezervaciju
    await prisma.reservation.create({
      data: {
        type: 'BIRTHDAY',
        title: 'Prosli rodjendan',
        date: new Date(pastDateStr + 'T00:00:00.000Z'),
        startTime: '14:00',
        endTime: '18:00',
      },
    });

    await prisma.reservation.create({
      data: {
        type: 'PRIVATE_EVENT',
        title: 'Otkazano',
        date: new Date(futureDateStr + 'T00:00:00.000Z'),
        startTime: '10:00',
        endTime: '12:00',
        status: 'CANCELLED',
      },
    });
  });

  test('javno prikazuje samo buduche neotkazane rezervacije', async () => {
    const res = await request(app).get('/api/reservations');

    expect(res.status).toBe(200);
    expect(res.body.reservations.length).toBeGreaterThanOrEqual(2);

    res.body.reservations.forEach((r) => {
      expect(r.status).not.toBe('CANCELLED');
      // Ne prikazuje privatne podatke
      expect(r.contactPhone).toBeUndefined();
      expect(r.notes).toBeUndefined();
      expect(r.userId).toBeUndefined();
    });
  });

  test('ne prikazuje prosle rezervacije', async () => {
    const res = await request(app).get('/api/reservations');

    const titles = res.body.reservations.map((r) => r.title);
    expect(titles).not.toContain('Prosli rodjendan');
  });

  test('ne prikazuje otkazane rezervacije', async () => {
    const res = await request(app).get('/api/reservations');

    const titles = res.body.reservations.map((r) => r.title);
    expect(titles).not.toContain('Otkazano');
  });
});

describe('GET /api/reservations/all (admin)', () => {
  test('admin vidi sve rezervacije sa filtrima', async () => {
    const res = await request(app)
      .get('/api/reservations/all')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.reservations.length).toBeGreaterThanOrEqual(5);
    expect(res.body.pagination).toBeDefined();
  });

  test('admin filtrira po tipu', async () => {
    const res = await request(app)
      .get('/api/reservations/all?type=BIRTHDAY')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    res.body.reservations.forEach((r) => {
      expect(r.type).toBe('BIRTHDAY');
    });
  });

  test('admin filtrira po statusu', async () => {
    const res = await request(app)
      .get('/api/reservations/all?status=CANCELLED')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    res.body.reservations.forEach((r) => {
      expect(r.status).toBe('CANCELLED');
    });
  });

  test('admin filtrira po datumu', async () => {
    const res = await request(app)
      .get(`/api/reservations/all?dateFrom=${futureDateStr}&dateTo=${futureDateStr}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.reservations.length).toBeGreaterThanOrEqual(1);
  });

  test('parent ne moze da vidi admin listu', async () => {
    const res = await request(app)
      .get('/api/reservations/all')
      .set('Authorization', `Bearer ${parentToken}`);

    expect(res.status).toBe(403);
  });
});

describe('GET /api/reservations/:id', () => {
  test('admin vidi detalje rezervacije', async () => {
    const res = await request(app)
      .get(`/api/reservations/${reservationId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.reservation.id).toBe(reservationId);
    expect(res.body.reservation.contactPhone).toBeDefined();
    expect(res.body.reservation.notes).toBeDefined();
    expect(res.body.reservation.user).toBeDefined();
  });

  test('vraca 404 za nepostojecu rezervaciju', async () => {
    const res = await request(app)
      .get('/api/reservations/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/reservations/:id', () => {
  test('admin potvrdjuje rezervaciju', async () => {
    const res = await request(app)
      .patch(`/api/reservations/${reservationId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'CONFIRMED' });

    expect(res.status).toBe(200);
    expect(res.body.reservation.status).toBe('CONFIRMED');
  });

  test('admin azurira detalje rezervacije', async () => {
    const res = await request(app)
      .patch(`/api/reservations/${reservationId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ guestCount: 20, notes: 'Vise gostiju nego planirano' });

    expect(res.status).toBe(200);
    expect(res.body.reservation.guestCount).toBe(20);
    expect(res.body.reservation.notes).toBe('Vise gostiju nego planirano');
  });

  test('admin otkazuje rezervaciju', async () => {
    const res = await request(app)
      .patch(`/api/reservations/${reservationId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'CANCELLED' });

    expect(res.status).toBe(200);
    expect(res.body.reservation.status).toBe('CANCELLED');
  });

  test('vraca 404 za nepostojecu rezervaciju', async () => {
    const res = await request(app)
      .patch('/api/reservations/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'CONFIRMED' });

    expect(res.status).toBe(404);
  });

  test('parent ne moze da azurira rezervaciju', async () => {
    const res = await request(app)
      .patch(`/api/reservations/${reservationId}`)
      .set('Authorization', `Bearer ${parentToken}`)
      .send({ status: 'CONFIRMED' });

    expect(res.status).toBe(403);
  });
});

describe('DELETE /api/reservations/:id', () => {
  test('admin brise rezervaciju', async () => {
    const res = await request(app)
      .delete(`/api/reservations/${reservationId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('obrisana');
  });

  test('vraca 404 za nepostojecu rezervaciju', async () => {
    const res = await request(app)
      .delete('/api/reservations/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });

  test('parent ne moze da brise rezervaciju', async () => {
    const res = await request(app)
      .delete(`/api/reservations/${reservationId}`)
      .set('Authorization', `Bearer ${parentToken}`);

    expect(res.status).toBe(403);
  });
});
