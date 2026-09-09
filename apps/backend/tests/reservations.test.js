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

    // Jedina koja sme da se vidi javno: buduca i potvrdjena.
    await prisma.reservation.create({
      data: {
        type: 'BIRTHDAY',
        title: 'Dogovoren rodjendan',
        date: new Date(futureDateStr + 'T00:00:00.000Z'),
        startTime: '13:00',
        endTime: '15:00',
        status: 'CONFIRMED',
      },
    });
  });

  test('javno prikazuje samo potvrdjene buduce rezervacije', async () => {
    const res = await request(app).get('/api/reservations');

    expect(res.status).toBe(200);
    expect(res.body.reservations.length).toBeGreaterThanOrEqual(1);

    res.body.reservations.forEach((r) => {
      expect(r.status).toBe('CONFIRMED');
      // Ne prikazuje privatne podatke
      expect(r.contactPhone).toBeUndefined();
      expect(r.notes).toBeUndefined();
      expect(r.userId).toBeUndefined();
    });
  });

  // Zahtev na cekanju jos nije dogovoren posao: moze da otpadne ili da promeni
  // termin, pa roditelj ne sme da ga vidi dok ga osoblje ne potvrdi.
  test('rezervacija na cekanju se ne vidi, a posle potvrde se vidi', async () => {
    const napravljena = await request(app)
      .post('/api/reservations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        type: 'BIRTHDAY',
        title: 'Jos nedogovoren rodjendan',
        date: futureDateStr,
        startTime: '15:00',
        endTime: '17:00',
      });
    const id = napravljena.body.reservation.id;
    expect(napravljena.body.reservation.status).toBe('PENDING');

    const naCekanju = await request(app).get('/api/reservations');
    expect(naCekanju.body.reservations.some((r) => r.id === id)).toBe(false);

    await request(app)
      .patch(`/api/reservations/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'CONFIRMED' });

    const potvrdjena = await request(app).get('/api/reservations');
    expect(potvrdjena.body.reservations.some((r) => r.id === id)).toBe(true);
  });

  // Osoblju ostaje ceo spisak - njima je cekanje radni podatak, ne skriveno.
  test('osoblje i dalje vidi rezervacije na cekanju', async () => {
    const res = await request(app)
      .get('/api/reservations/all')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.reservations.some((r) => r.status === 'PENDING')).toBe(true);
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

// Rezervacija od 20:00 do 17:00 se cuvala bez pogovora.
describe('Vreme zavrsetka mora biti posle pocetka', () => {
  const osnovno = { type: 'BIRTHDAY', title: 'Provera vremena', date: '2026-12-05' };

  test('nova rezervacija sa krajem pre pocetka se odbija', async () => {
    const res = await request(app)
      .post('/api/reservations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...osnovno, startTime: '20:00', endTime: '17:00' });

    expect(res.status).toBe(400);
  });

  // Kod celodnevne rezervacije vremena se ne koriste, pa se ne proveravaju.
  test('celodnevna rezervacija ne mari za vremena', async () => {
    const res = await request(app)
      .post('/api/reservations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...osnovno, startTime: '20:00', endTime: '17:00', isFullDay: true });

    expect(res.status).toBe(201);
    await request(app)
      .delete(`/api/reservations/${res.body.reservation.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
  });

  test('pomeranje samo kraja ispod pocetka se odbija', async () => {
    const napravljena = await request(app)
      .post('/api/reservations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...osnovno, startTime: '17:00', endTime: '20:00' });

    const res = await request(app)
      .patch(`/api/reservations/${napravljena.body.reservation.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ endTime: '16:00' });

    expect(res.status).toBe(400);

    await request(app)
      .delete(`/api/reservations/${napravljena.body.reservation.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
  });
});

// Osoblje bira tip iz spiska ili upisuje svoj, bez izmene koda i migracije.
describe('Tipovi rezervacije: mesecni dogadjaji i sopstveni tip', () => {
  const osnovno = { title: 'Provera tipova', date: '2026-11-12', startTime: '10:00', endTime: '12:00' };
  let sopstvenaId;

  test('admin kreira mesecni dogadjaj', async () => {
    const res = await request(app)
      .post('/api/reservations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...osnovno, type: 'MONTHLY_EVENT' });

    expect(res.status).toBe(201);
    expect(res.body.reservation.type).toBe('MONTHLY_EVENT');
    expect(res.body.reservation.customType).toBeNull();
  });

  test('admin upisuje svoj tip', async () => {
    const res = await request(app)
      .post('/api/reservations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...osnovno, type: 'OTHER', customType: '  Skolska ekskurzija  ' });

    expect(res.status).toBe(201);
    expect(res.body.reservation.type).toBe('OTHER');
    expect(res.body.reservation.customType).toBe('Skolska ekskurzija');
    sopstvenaId = res.body.reservation.id;
  });

  test('tip "Drugo" bez upisanog naziva se odbija', async () => {
    const res = await request(app)
      .post('/api/reservations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...osnovno, type: 'OTHER' });

    expect(res.status).toBe(400);
  });

  test('naziv od samih razmaka se odbija', async () => {
    const res = await request(app)
      .post('/api/reservations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...osnovno, type: 'OTHER', customType: '   ' });

    expect(res.status).toBe(400);
  });

  test('tip iz spiska ne cuva upisani naziv', async () => {
    const res = await request(app)
      .post('/api/reservations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...osnovno, type: 'MONTHLY_EVENT', customType: 'Skolska ekskurzija' });

    expect(res.status).toBe(201);
    expect(res.body.reservation.customType).toBeNull();
  });

  test('admin filtrira po mesecnim dogadjajima', async () => {
    const res = await request(app)
      .get('/api/reservations/all?type=MONTHLY_EVENT')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.reservations.length).toBeGreaterThanOrEqual(1);
    res.body.reservations.forEach((r) => expect(r.type).toBe('MONTHLY_EVENT'));
  });

  test('prelazak na tip iz spiska brise upisani naziv', async () => {
    const res = await request(app)
      .patch(`/api/reservations/${sopstvenaId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ type: 'MONTHLY_EVENT' });

    expect(res.status).toBe(200);
    expect(res.body.reservation.customType).toBeNull();
  });

  test('prelazak na "Drugo" bez naziva se odbija', async () => {
    const res = await request(app)
      .patch(`/api/reservations/${sopstvenaId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ type: 'OTHER' });

    expect(res.status).toBe(400);
  });

  // Roditelji u aplikaciji vide javnu listu; tamo tip OTHER mora da ima ime.
  test('javna lista nosi upisani naziv tipa', async () => {
    await request(app)
      .patch(`/api/reservations/${sopstvenaId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ type: 'OTHER', customType: 'Skolska ekskurzija', status: 'CONFIRMED' });

    const res = await request(app).get('/api/reservations');

    expect(res.status).toBe(200);
    const nasa = res.body.reservations.find((r) => r.id === sopstvenaId);
    expect(nasa.type).toBe('OTHER');
    expect(nasa.customType).toBe('Skolska ekskurzija');
  });
});
