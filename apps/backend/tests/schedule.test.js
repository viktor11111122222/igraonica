const request = require('supertest');
const app = require('../src/app');
const { cleanDB, createTestUser, disconnectDB, TEST_ADMIN, TEST_PARENT } = require('./setup');

let adminToken;
let parentToken;
let activityId;
let eventId;

beforeAll(async () => {
  await cleanDB();

  await createTestUser(TEST_ADMIN);
  await createTestUser(TEST_PARENT);

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

describe('POST /api/schedule', () => {
  test('admin kreira recurring aktivnost', async () => {
    const res = await request(app)
      .post('/api/schedule')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Art & Craft',
        description: 'Kreativna radionica',
        dayOfWeek: 0,
        startTime: '10:30',
        endTime: '11:30',
        ageGroup: '3-5 godina',
        color: '#FF5733',
      });

    expect(res.status).toBe(201);
    expect(res.body.activity.title).toBe('Art & Craft');
    expect(res.body.activity.dayOfWeek).toBe(0);
    expect(res.body.activity.startTime).toBe('10:30');
    expect(res.body.activity.endTime).toBe('11:30');
    expect(res.body.activity.isRecurring).toBe(true);
    expect(res.body.activity.ageGroup).toBe('3-5 godina');
    expect(res.body.activity.color).toBe('#FF5733');
    activityId = res.body.activity.id;
  });

  test('admin kreira vise aktivnosti za razlicite dane', async () => {
    const activities = [
      { title: 'Muzika i Ples', dayOfWeek: 1, startTime: '14:00', endTime: '15:00' },
      { title: 'Outdoor Play', dayOfWeek: 2, startTime: '12:00', endTime: '13:00' },
      { title: 'Sport', dayOfWeek: 0, startTime: '16:00', endTime: '17:00', ageGroup: '6-10 godina' },
    ];

    for (const a of activities) {
      const res = await request(app)
        .post('/api/schedule')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(a);
      expect(res.status).toBe(201);
    }
  });

  test('admin kreira one-off dogadjaj', async () => {
    const res = await request(app)
      .post('/api/schedule')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Novogodisnja predstava',
        startTime: '18:00',
        endTime: '20:00',
        isRecurring: false,
        specificDate: '2026-12-31',
      });

    expect(res.status).toBe(201);
    expect(res.body.activity.isRecurring).toBe(false);
    expect(res.body.activity.specificDate).toBeDefined();
    eventId = res.body.activity.id;
  });

  test('recurring aktivnost zahteva dayOfWeek', async () => {
    const res = await request(app)
      .post('/api/schedule')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Bez dana', startTime: '10:00', endTime: '11:00' });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Dan u nedelji');
  });

  test('one-off dogadjaj zahteva specificDate', async () => {
    const res = await request(app)
      .post('/api/schedule')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Bez datuma', startTime: '10:00', endTime: '11:00', isRecurring: false });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Datum');
  });

  test('validira format vremena', async () => {
    const res = await request(app)
      .post('/api/schedule')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Test', dayOfWeek: 0, startTime: '25:99', endTime: '11:00' });

    expect(res.status).toBe(400);
  });

  test('validira obavezna polja', async () => {
    const res = await request(app)
      .post('/api/schedule')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Samo naslov' });

    expect(res.status).toBe(400);
  });

  test('parent ne moze da kreira aktivnost', async () => {
    const res = await request(app)
      .post('/api/schedule')
      .set('Authorization', `Bearer ${parentToken}`)
      .send({ title: 'Hack', dayOfWeek: 0, startTime: '10:00', endTime: '11:00' });

    expect(res.status).toBe(403);
  });
});

describe('GET /api/schedule', () => {
  test('javno prikazuje nedeljni raspored', async () => {
    const res = await request(app).get('/api/schedule');

    expect(res.status).toBe(200);
    expect(res.body.activities.length).toBeGreaterThanOrEqual(4);
    expect(res.body.week).toBeDefined();

    // Svi su recurring
    res.body.activities.forEach((a) => {
      expect(a.isRecurring).toBe(true);
    });

    // Ponedeljak (0) ima 2 aktivnosti
    expect(res.body.week[0].length).toBe(2);
    // Utorak (1) ima 1
    expect(res.body.week[1].length).toBe(1);
  });

  test('aktivnosti su sortirane po danu pa po vremenu', async () => {
    const res = await request(app).get('/api/schedule');

    for (let i = 1; i < res.body.activities.length; i++) {
      const prev = res.body.activities[i - 1];
      const curr = res.body.activities[i];
      if (prev.dayOfWeek === curr.dayOfWeek) {
        expect(prev.startTime <= curr.startTime).toBe(true);
      } else {
        expect(prev.dayOfWeek).toBeLessThan(curr.dayOfWeek);
      }
    }
  });
});

describe('GET /api/schedule/day/:dayOfWeek', () => {
  test('prikazuje raspored za ponedeljak', async () => {
    const res = await request(app).get('/api/schedule/day/0');

    expect(res.status).toBe(200);
    expect(res.body.dayOfWeek).toBe(0);
    expect(res.body.activities.length).toBe(2);
    res.body.activities.forEach((a) => {
      expect(a.dayOfWeek).toBe(0);
    });
  });

  test('prazan raspored za dan bez aktivnosti', async () => {
    const res = await request(app).get('/api/schedule/day/5');

    expect(res.status).toBe(200);
    expect(res.body.activities.length).toBe(0);
  });

  test('validira dan', async () => {
    const res = await request(app).get('/api/schedule/day/7');

    expect(res.status).toBe(400);
  });
});

describe('GET /api/schedule/events', () => {
  test('prikazuje buduche one-off dogadjaje', async () => {
    const res = await request(app).get('/api/schedule/events');

    expect(res.status).toBe(200);
    expect(res.body.events.length).toBeGreaterThanOrEqual(1);
    res.body.events.forEach((e) => {
      expect(e.isRecurring).toBe(false);
      expect(e.specificDate).toBeDefined();
    });
  });

  test('filtrira dogadjaje po datumu', async () => {
    const res = await request(app).get('/api/schedule/events?dateFrom=2026-12-01&dateTo=2026-12-31');

    expect(res.status).toBe(200);
    expect(res.body.events.length).toBeGreaterThanOrEqual(1);
  });
});

describe('GET /api/schedule/all (admin)', () => {
  test('admin vidi sve aktivnosti ukljucujuci neaktivne', async () => {
    const res = await request(app)
      .get('/api/schedule/all')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.activities.length).toBeGreaterThanOrEqual(5);
  });

  test('parent ne moze da vidi admin listu', async () => {
    const res = await request(app)
      .get('/api/schedule/all')
      .set('Authorization', `Bearer ${parentToken}`);

    expect(res.status).toBe(403);
  });
});

describe('PATCH /api/schedule/:id', () => {
  test('admin azurira aktivnost', async () => {
    const res = await request(app)
      .patch(`/api/schedule/${activityId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Art & Craft (azurirano)', startTime: '10:00' });

    expect(res.status).toBe(200);
    expect(res.body.activity.title).toBe('Art & Craft (azurirano)');
    expect(res.body.activity.startTime).toBe('10:00');
  });

  test('admin deaktivira aktivnost', async () => {
    const res = await request(app)
      .patch(`/api/schedule/${activityId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: false });

    expect(res.status).toBe(200);
    expect(res.body.activity.isActive).toBe(false);

    // deaktivirana se ne pojavljuje u javnom rasporedu
    const publicRes = await request(app).get('/api/schedule');
    const ids = publicRes.body.activities.map((a) => a.id);
    expect(ids).not.toContain(activityId);

    // vrati nazad
    await request(app)
      .patch(`/api/schedule/${activityId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: true });
  });

  test('vraca 404 za nepostojecu aktivnost', async () => {
    const res = await request(app)
      .patch('/api/schedule/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Test' });

    expect(res.status).toBe(404);
  });

  test('parent ne moze da azurira aktivnost', async () => {
    const res = await request(app)
      .patch(`/api/schedule/${activityId}`)
      .set('Authorization', `Bearer ${parentToken}`)
      .send({ title: 'Hack' });

    expect(res.status).toBe(403);
  });
});

describe('DELETE /api/schedule/:id', () => {
  test('admin brise aktivnost', async () => {
    const res = await request(app)
      .delete(`/api/schedule/${eventId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('obrisana');
  });

  test('vraca 404 za nepostojecu aktivnost', async () => {
    const res = await request(app)
      .delete('/api/schedule/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });

  test('parent ne moze da brise aktivnost', async () => {
    const res = await request(app)
      .delete(`/api/schedule/${activityId}`)
      .set('Authorization', `Bearer ${parentToken}`);

    expect(res.status).toBe(403);
  });
});

// Aktivnost od 18:00 do 09:00 se cuvala bez pogovora, pa je roditelj u
// aplikaciji video besmislen termin.
describe('Vreme zavrsetka mora biti posle pocetka', () => {
  test('nova aktivnost sa krajem pre pocetka se odbija', async () => {
    const res = await request(app)
      .post('/api/schedule')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Naopako', dayOfWeek: 1, startTime: '18:00', endTime: '09:00' });

    expect(res.status).toBe(400);
  });

  test('kraj jednak pocetku se odbija', async () => {
    const res = await request(app)
      .post('/api/schedule')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Nulto trajanje', dayOfWeek: 1, startTime: '10:00', endTime: '10:00' });

    expect(res.status).toBe(400);
  });

  test('ispravan raspon prolazi', async () => {
    const res = await request(app)
      .post('/api/schedule')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Uredno', dayOfWeek: 1, startTime: '10:00', endTime: '11:30' });

    expect(res.status).toBe(201);
    await request(app)
      .delete(`/api/schedule/${res.body.activity.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
  });

  // Izmena moze da posalje samo jedno od dva vremena.
  test('pomeranje samo pocetka preko kraja se odbija', async () => {
    const napravljena = await request(app)
      .post('/api/schedule')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Za izmenu', dayOfWeek: 1, startTime: '10:00', endTime: '11:00' });

    const res = await request(app)
      .patch(`/api/schedule/${napravljena.body.activity.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ startTime: '23:00' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/posle vremena pocetka/);

    await request(app)
      .delete(`/api/schedule/${napravljena.body.activity.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
  });
});
