const request = require('supertest');
const app = require('../src/app');
const { prisma, cleanDB, createTestUser, disconnectDB, TEST_ADMIN, TEST_PARENT } = require('./setup');

let adminToken;
let parentToken;
let parentId;
let eventId;

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

describe('POST /api/events', () => {
  test('admin kreira rodjendan', async () => {
    const res = await request(app)
      .post('/api/events')
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
    expect(res.body.event.type).toBe('BIRTHDAY');
    expect(res.body.event.title).toBe('Rodjendan Marka');
    expect(res.body.event.guestCount).toBe(15);
    expect(res.body.event.childName).toBe('Marko');
    expect(res.body.event.childAge).toBe(6);
    expect(res.body.event.status).toBe('PENDING');
    expect(res.body.event.user).toBeDefined();
    expect(res.body.event.user.password).toBeUndefined();
    eventId = res.body.event.id;
  });

  test('admin kreira privatni dogadjaj bez korisnika', async () => {
    const nextDay = new Date(futureDate);
    nextDay.setDate(nextDay.getDate() + 1);
    const nextDayStr = nextDay.toISOString().split('T')[0];

    const res = await request(app)
      .post('/api/events')
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
    expect(res.body.event.isFullDay).toBe(true);
    expect(res.body.event.user).toBeNull();
  });

  test('admin kreira grupnu posetu', async () => {
    const res = await request(app)
      .post('/api/events')
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
    expect(res.body.event.type).toBe('GROUP_BOOKING');
  });

  test('validira obavezna polja', async () => {
    const res = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Samo naslov' });

    expect(res.status).toBe(400);
    expect(res.body.errors).toBeDefined();
  });

  test('validira tip dogadjaja', async () => {
    const res = await request(app)
      .post('/api/events')
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
      .post('/api/events')
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

  test('parent ne moze da kreira dogadjaj', async () => {
    const res = await request(app)
      .post('/api/events')
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

// Ovo je i razlog zasto dogadjaji ne zive u tabeli rezervacija: mobilna
// aplikacija cita rezervacije bez tokena, a dogadjaje ne sme nikako da vidi.
describe('Dogadjaji nisu javni', () => {
  test('lista bez tokena vraca 401', async () => {
    const res = await request(app).get('/api/events');
    expect(res.status).toBe(401);
  });

  test('detalj bez tokena vraca 401', async () => {
    const res = await request(app).get(`/api/events/${eventId}`);
    expect(res.status).toBe(401);
  });

  test('roditelj ne vidi listu dogadjaja', async () => {
    const res = await request(app)
      .get('/api/events')
      .set('Authorization', `Bearer ${parentToken}`);

    expect(res.status).toBe(403);
  });

  test('dogadjaji se ne pojavljuju u javnim rezervacijama', async () => {
    const res = await request(app).get('/api/reservations');

    expect(res.status).toBe(200);
    const titles = res.body.reservations.map((r) => r.title);
    expect(titles).not.toContain('Rodjendan Marka');
  });
});

describe('GET /api/events (admin)', () => {
  beforeAll(async () => {
    await prisma.event.create({
      data: {
        type: 'BIRTHDAY',
        title: 'Prosli rodjendan',
        date: new Date(pastDateStr + 'T00:00:00.000Z'),
        startTime: '14:00',
        endTime: '18:00',
      },
    });

    await prisma.event.create({
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

  test('admin vidi sve dogadjaje, i prosle i otkazane', async () => {
    const res = await request(app)
      .get('/api/events')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.events.length).toBeGreaterThanOrEqual(5);
    expect(res.body.pagination).toBeDefined();

    const titles = res.body.events.map((e) => e.title);
    expect(titles).toContain('Prosli rodjendan');
    expect(titles).toContain('Otkazano');
  });

  test('admin filtrira po tipu', async () => {
    const res = await request(app)
      .get('/api/events?type=BIRTHDAY')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    res.body.events.forEach((e) => {
      expect(e.type).toBe('BIRTHDAY');
    });
  });

  test('admin filtrira po statusu', async () => {
    const res = await request(app)
      .get('/api/events?status=CANCELLED')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    res.body.events.forEach((e) => {
      expect(e.status).toBe('CANCELLED');
    });
  });

  test('admin filtrira po datumu', async () => {
    const res = await request(app)
      .get(`/api/events?dateFrom=${futureDateStr}&dateTo=${futureDateStr}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.events.length).toBeGreaterThanOrEqual(1);
  });
});

describe('GET /api/events/:id', () => {
  test('admin vidi detalje dogadjaja', async () => {
    const res = await request(app)
      .get(`/api/events/${eventId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.event.id).toBe(eventId);
    expect(res.body.event.contactPhone).toBeDefined();
    expect(res.body.event.notes).toBeDefined();
    expect(res.body.event.user).toBeDefined();
  });

  test('vraca 404 za nepostojeci dogadjaj', async () => {
    const res = await request(app)
      .get('/api/events/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/events/:id', () => {
  test('admin potvrdjuje dogadjaj', async () => {
    const res = await request(app)
      .patch(`/api/events/${eventId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'CONFIRMED' });

    expect(res.status).toBe(200);
    expect(res.body.event.status).toBe('CONFIRMED');
  });

  test('admin azurira detalje dogadjaja', async () => {
    const res = await request(app)
      .patch(`/api/events/${eventId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ guestCount: 20, notes: 'Vise gostiju nego planirano' });

    expect(res.status).toBe(200);
    expect(res.body.event.guestCount).toBe(20);
    expect(res.body.event.notes).toBe('Vise gostiju nego planirano');
  });

  test('admin otkazuje dogadjaj', async () => {
    const res = await request(app)
      .patch(`/api/events/${eventId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'CANCELLED' });

    expect(res.status).toBe(200);
    expect(res.body.event.status).toBe('CANCELLED');
  });

  test('vraca 404 za nepostojeci dogadjaj', async () => {
    const res = await request(app)
      .patch('/api/events/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'CONFIRMED' });

    expect(res.status).toBe(404);
  });

  test('parent ne moze da azurira dogadjaj', async () => {
    const res = await request(app)
      .patch(`/api/events/${eventId}`)
      .set('Authorization', `Bearer ${parentToken}`)
      .send({ status: 'CONFIRMED' });

    expect(res.status).toBe(403);
  });
});

describe('DELETE /api/events/:id', () => {
  test('parent ne moze da brise dogadjaj', async () => {
    const res = await request(app)
      .delete(`/api/events/${eventId}`)
      .set('Authorization', `Bearer ${parentToken}`);

    expect(res.status).toBe(403);
  });

  test('admin brise dogadjaj', async () => {
    const res = await request(app)
      .delete(`/api/events/${eventId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('obrisan');
  });

  test('vraca 404 za nepostojeci dogadjaj', async () => {
    const res = await request(app)
      .delete('/api/events/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });
});

// Dogadjaj od 20:00 do 17:00 ne sme da prodje, isto kao kod rezervacija.
describe('Vreme zavrsetka mora biti posle pocetka', () => {
  const osnovno = { type: 'BIRTHDAY', title: 'Provera vremena', date: '2026-12-05' };

  test('novi dogadjaj sa krajem pre pocetka se odbija', async () => {
    const res = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...osnovno, startTime: '20:00', endTime: '17:00' });

    expect(res.status).toBe(400);
  });

  test('celodnevni dogadjaj ne mari za vremena', async () => {
    const res = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...osnovno, startTime: '20:00', endTime: '17:00', isFullDay: true });

    expect(res.status).toBe(201);
    await request(app)
      .delete(`/api/events/${res.body.event.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
  });

  test('izmena ne moze da pomeri pocetak posle kraja', async () => {
    const napravljen = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...osnovno, startTime: '10:00', endTime: '12:00' });

    const res = await request(app)
      .patch(`/api/events/${napravljen.body.event.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ startTime: '13:00' });

    expect(res.status).toBe(400);
  });
});

// Osoblje moze da upise svoj tip dogadjaja umesto da bira iz spiska.
describe('Sopstveni tip dogadjaja (OTHER)', () => {
  const osnovno = { title: 'Radionica', date: '2026-11-10', startTime: '10:00', endTime: '12:00' };
  let sopstveniId;

  test('admin upisuje svoj tip', async () => {
    const res = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...osnovno, type: 'OTHER', customType: '  Radionica slikanja  ' });

    expect(res.status).toBe(201);
    expect(res.body.event.type).toBe('OTHER');
    expect(res.body.event.customType).toBe('Radionica slikanja');
    sopstveniId = res.body.event.id;
  });

  test('tip "Drugo" bez upisanog naziva se odbija', async () => {
    const res = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...osnovno, type: 'OTHER' });

    expect(res.status).toBe(400);
  });

  test('naziv od samih razmaka se odbija', async () => {
    const res = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...osnovno, type: 'OTHER', customType: '   ' });

    expect(res.status).toBe(400);
  });

  test('tip iz spiska ne cuva upisani naziv', async () => {
    const res = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...osnovno, type: 'BIRTHDAY', customType: 'Radionica' });

    expect(res.status).toBe(201);
    expect(res.body.event.customType).toBeNull();
  });

  test('admin filtrira po tipu "Drugo"', async () => {
    const res = await request(app)
      .get('/api/events?type=OTHER')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.events.length).toBeGreaterThanOrEqual(1);
    res.body.events.forEach((e) => {
      expect(e.type).toBe('OTHER');
      expect(e.customType).toBeTruthy();
    });
  });

  test('izmena menja samo upisani naziv', async () => {
    const res = await request(app)
      .patch(`/api/events/${sopstveniId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ customType: 'Radionica gline' });

    expect(res.status).toBe(200);
    expect(res.body.event.customType).toBe('Radionica gline');
  });

  test('prelazak na tip iz spiska brise upisani naziv', async () => {
    const res = await request(app)
      .patch(`/api/events/${sopstveniId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ type: 'BIRTHDAY' });

    expect(res.status).toBe(200);
    expect(res.body.event.type).toBe('BIRTHDAY');
    expect(res.body.event.customType).toBeNull();
  });

  test('prelazak na "Drugo" bez naziva se odbija', async () => {
    const res = await request(app)
      .patch(`/api/events/${sopstveniId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ type: 'OTHER' });

    expect(res.status).toBe(400);
  });

  test('prelazak na "Drugo" sa nazivom prolazi', async () => {
    const res = await request(app)
      .patch(`/api/events/${sopstveniId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ type: 'OTHER', customType: 'Bebi zurka' });

    expect(res.status).toBe(200);
    expect(res.body.event.customType).toBe('Bebi zurka');
  });
});
