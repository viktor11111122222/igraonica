const request = require('supertest');
const app = require('../src/app');
const {
  prisma,
  cleanDB,
  createTestUser,
  disconnectDB,
  TEST_ADMIN,
  TEST_PARENT,
} = require('./setup');

let adminToken;
let parentToken;

// Datumi u tekucem mesecu, da ih podrazumevani opseg (od prvog u mesecu)
// sigurno obuhvati bez obzira kada se testovi pokrecu.
function danUMesecu(dan) {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), dan));
  return d.toISOString().split('T')[0];
}

const PRVI = danUMesecu(1);
const PETNAESTI = danUMesecu(15);
const DVADESETI = danUMesecu(20);

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

afterEach(async () => {
  await prisma.closedDay.deleteMany();
  await prisma.reservation.deleteMany();
});

afterAll(async () => {
  await cleanDB();
  await disconnectDB();
});

function dodaj(data, token = adminToken) {
  return request(app)
    .post('/api/closed-days')
    .set('Authorization', `Bearer ${token}`)
    .send(data);
}

describe('POST /api/closed-days', () => {
  test('admin oznacava dan kao neradni', async () => {
    const res = await dodaj({ date: PETNAESTI, reason: 'Rodjendan', note: 'Privatna proslava' });

    expect(res.status).toBe(201);
    expect(res.body.closedDay.date).toBe(PETNAESTI);
    expect(res.body.closedDay.reason).toBe('Rodjendan');
    expect(res.body.closedDay.note).toBe('Privatna proslava');
  });

  test('napomena nije obavezna', async () => {
    const res = await dodaj({ date: PETNAESTI, reason: 'Praznik' });

    expect(res.status).toBe(201);
    expect(res.body.closedDay.note).toBeNull();
  });

  test('razlog je obavezan', async () => {
    const res = await dodaj({ date: PETNAESTI });
    expect(res.status).toBe(400);
  });

  test('prazan razlog se odbija', async () => {
    const res = await dodaj({ date: PETNAESTI, reason: '   ' });
    expect(res.status).toBe(400);
  });

  test('neispravan datum se odbija', async () => {
    const res = await dodaj({ date: 'juce', reason: 'Rodjendan' });
    expect(res.status).toBe(400);
  });

  // Dan je ili neradni ili nije - dva reda za isti datum nemaju smisla.
  test('isti dan ne moze dva puta', async () => {
    await dodaj({ date: PETNAESTI, reason: 'Rodjendan' });
    const res = await dodaj({ date: PETNAESTI, reason: 'Praznik' });

    expect(res.status).toBe(409);
  });

  test('razlog se cisti od viska razmaka', async () => {
    const res = await dodaj({ date: PETNAESTI, reason: '  Rodjendan  ' });
    expect(res.body.closedDay.reason).toBe('Rodjendan');
  });

  test('roditelj ne moze da oznaci neradni dan', async () => {
    const res = await dodaj({ date: PETNAESTI, reason: 'Rodjendan' }, parentToken);
    expect(res.status).toBe(403);
  });

  test('neprijavljen korisnik ne moze da oznaci neradni dan', async () => {
    const res = await request(app)
      .post('/api/closed-days')
      .send({ date: PETNAESTI, reason: 'Rodjendan' });

    expect(res.status).toBe(401);
  });
});

describe('GET /api/closed-days', () => {
  // Aplikacija cita ovo bez prijave, jer obavestenje mora da se vidi i na
  // ekranu za prijavu.
  test('javno je dostupno', async () => {
    await dodaj({ date: PETNAESTI, reason: 'Rodjendan' });

    const res = await request(app).get('/api/closed-days');

    expect(res.status).toBe(200);
    expect(res.body.closedDays).toHaveLength(1);
    expect(res.body.closedDays[0].reason).toBe('Rodjendan');
  });

  test('datum se vraca kao YYYY-MM-DD, bez vremena', async () => {
    await dodaj({ date: PETNAESTI, reason: 'Rodjendan' });

    const res = await request(app).get('/api/closed-days');

    expect(res.body.closedDays[0].date).toBe(PETNAESTI);
    expect(res.body.closedDays[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('sortirano po datumu rastuce', async () => {
    await dodaj({ date: DVADESETI, reason: 'Praznik' });
    await dodaj({ date: PRVI, reason: 'Rodjendan' });

    const res = await request(app).get('/api/closed-days');

    expect(res.body.closedDays.map((d) => d.date)).toEqual([PRVI, DVADESETI]);
  });

  test('filtrira po opsegu', async () => {
    await dodaj({ date: PRVI, reason: 'Prvi' });
    await dodaj({ date: PETNAESTI, reason: 'Petnaesti' });
    await dodaj({ date: DVADESETI, reason: 'Dvadeseti' });

    const res = await request(app).get(
      `/api/closed-days?from=${PETNAESTI}&to=${DVADESETI}`
    );

    expect(res.body.closedDays.map((d) => d.reason)).toEqual(['Petnaesti', 'Dvadeseti']);
  });

  // Traka datuma u aplikaciji pokazuje ceo mesec, pa i vec prosli neradni dani
  // moraju da stignu - inace bi oznake nestajale kako mesec odmice.
  test('podrazumevano vraca i vec prosle dane tekuceg meseca', async () => {
    await dodaj({ date: PRVI, reason: 'Prvi u mesecu' });

    const res = await request(app).get('/api/closed-days');

    expect(res.body.closedDays.map((d) => d.date)).toContain(PRVI);
  });

  test('prazna lista kada nema neradnih dana', async () => {
    const res = await request(app).get('/api/closed-days');

    expect(res.status).toBe(200);
    expect(res.body.closedDays).toEqual([]);
  });
});

// Celodnevni rodjendan zauzima igraonicu ceo dan. Da roditelj ne bi za istu
// stvar video dva razlicita obavestenja, takav dan je neradni sam po sebi i
// nosi oznaku po kojoj ga aplikacija prikazuje uvek isto.
describe('GET /api/closed-days - celodnevni rodjendan', () => {
  const rodjendan = (telo) =>
    request(app)
      .post('/api/reservations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        type: 'BIRTHDAY',
        title: 'Rodjendan - Lena',
        date: PETNAESTI,
        startTime: '10:00',
        endTime: '18:00',
        isFullDay: true,
        ...telo,
      });

  test('celodnevni rodjendan zatvara dan i bez rucnog oznacavanja', async () => {
    await rodjendan();

    const res = await request(app).get('/api/closed-days');

    expect(res.body.closedDays).toHaveLength(1);
    expect(res.body.closedDays[0].date).toBe(PETNAESTI);
    expect(res.body.closedDays[0].reason).toBe('Rodjendan');
    expect(res.body.closedDays[0].kind).toBe('BIRTHDAY');
  });

  test('rodjendan u terminu ne zatvara dan', async () => {
    await rodjendan({ isFullDay: false });

    const res = await request(app).get('/api/closed-days');

    expect(res.body.closedDays).toHaveLength(0);
  });

  test('otkazan rodjendan ne zatvara dan', async () => {
    const napravljen = await rodjendan();
    await request(app)
      .patch(`/api/reservations/${napravljen.body.reservation.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'CANCELLED' });

    const res = await request(app).get('/api/closed-days');

    expect(res.body.closedDays).toHaveLength(0);
  });

  test('rucno oznacen dan nosi oznaku "CLOSED"', async () => {
    await dodaj({ date: PETNAESTI, reason: 'Praznik' });

    const res = await request(app).get('/api/closed-days');

    expect(res.body.closedDays[0].kind).toBe('CLOSED');
  });

  // Dan oznacen rucno i zauzet rodjendanom je i dalje jedan dan, sa jednim
  // obavestenjem - a napomena koju je osoblje upisalo ne sme da propadne.
  test('dan oznacen i rucno i rodjendanom se ne duplira', async () => {
    await dodaj({ date: PETNAESTI, reason: 'Zatvoreno', note: 'Privatna proslava' });
    await rodjendan();

    const res = await request(app).get('/api/closed-days');

    expect(res.body.closedDays).toHaveLength(1);
    expect(res.body.closedDays[0].kind).toBe('BIRTHDAY');
    expect(res.body.closedDays[0].note).toBe('Privatna proslava');
  });

  test('rodjendan van trazenog opsega ne ulazi', async () => {
    await rodjendan({ date: DVADESETI });

    const res = await request(app).get(`/api/closed-days?from=${PRVI}&to=${PETNAESTI}`);

    expect(res.body.closedDays).toHaveLength(0);
  });
});

describe('GET /api/closed-days/all', () => {
  test('admin vidi sve, ukljucujuci stare datume', async () => {
    await dodaj({ date: '2020-01-01', reason: 'Davno' });

    const res = await request(app)
      .get('/api/closed-days/all')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.closedDays.map((d) => d.date)).toContain('2020-01-01');
  });

  test('roditelj ne moze da vidi ceo spisak', async () => {
    const res = await request(app)
      .get('/api/closed-days/all')
      .set('Authorization', `Bearer ${parentToken}`);

    expect(res.status).toBe(403);
  });
});

describe('PATCH /api/closed-days/:id', () => {
  test('admin menja razlog', async () => {
    const { body } = await dodaj({ date: PETNAESTI, reason: 'Rodjendan' });

    const res = await request(app)
      .patch(`/api/closed-days/${body.closedDay.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Praznik' });

    expect(res.status).toBe(200);
    expect(res.body.closedDay.reason).toBe('Praznik');
  });

  test('prazan razlog se odbija', async () => {
    const { body } = await dodaj({ date: PETNAESTI, reason: 'Rodjendan' });

    const res = await request(app)
      .patch(`/api/closed-days/${body.closedDay.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: '' });

    expect(res.status).toBe(400);
  });

  test('vraca 404 za nepostojeci id', async () => {
    const res = await request(app)
      .patch('/api/closed-days/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Praznik' });

    expect(res.status).toBe(404);
  });

  test('roditelj ne moze da menja', async () => {
    const { body } = await dodaj({ date: PETNAESTI, reason: 'Rodjendan' });

    const res = await request(app)
      .patch(`/api/closed-days/${body.closedDay.id}`)
      .set('Authorization', `Bearer ${parentToken}`)
      .send({ reason: 'Praznik' });

    expect(res.status).toBe(403);
  });
});

describe('DELETE /api/closed-days/:id', () => {
  test('admin vraca dan u radne', async () => {
    const { body } = await dodaj({ date: PETNAESTI, reason: 'Rodjendan' });

    const res = await request(app)
      .delete(`/api/closed-days/${body.closedDay.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);

    const posle = await request(app).get('/api/closed-days');
    expect(posle.body.closedDays).toHaveLength(0);
  });

  test('vraca 404 za nepostojeci id', async () => {
    const res = await request(app)
      .delete('/api/closed-days/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });

  test('roditelj ne moze da brise', async () => {
    const { body } = await dodaj({ date: PETNAESTI, reason: 'Rodjendan' });

    const res = await request(app)
      .delete(`/api/closed-days/${body.closedDay.id}`)
      .set('Authorization', `Bearer ${parentToken}`);

    expect(res.status).toBe(403);
  });
});
