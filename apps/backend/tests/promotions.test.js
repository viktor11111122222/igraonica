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

// Datumi oko danasnjeg, da testovi ne zavise od toga kada se pokrecu.
function pomereno(dana) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + dana);
  return d.toISOString().split('T')[0];
}

const JUCE = pomereno(-1);
const DANAS = pomereno(0);
const SUTRA = pomereno(1);
const ZA_NEDELJU = pomereno(7);
const PRE_NEDELJU = pomereno(-7);

const AKCIJA = {
  title: 'Letnja akcija',
  description: 'Popust na sve pakete.',
  discountType: 'PERCENT',
  discountValue: 20,
  dateFrom: JUCE,
  dateTo: SUTRA,
};

const kaoAdmin = (metod, put) =>
  request(app)[metod](put).set('Authorization', `Bearer ${adminToken}`);

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
  await prisma.promotion.deleteMany();
});

afterAll(async () => {
  await cleanDB();
  await disconnectDB();
});

describe('POST /api/promotions', () => {
  test('admin pravi akciju', async () => {
    const res = await kaoAdmin('post', '/api/promotions').send(AKCIJA);

    expect(res.status).toBe(201);
    expect(res.body.promotion.title).toBe('Letnja akcija');
    expect(res.body.promotion.discountValue).toBe(20);
    expect(res.body.promotion.dateFrom).toBe(JUCE);
    expect(res.body.promotion.dateTo).toBe(SUTRA);
    expect(res.body.promotion.isActive).toBe(true);
  });

  test('roditelj ne moze da pravi akcije', async () => {
    const res = await request(app)
      .post('/api/promotions')
      .set('Authorization', `Bearer ${parentToken}`)
      .send(AKCIJA);

    expect(res.status).toBe(403);
  });

  test('bez prijave nema unosa', async () => {
    const res = await request(app).post('/api/promotions').send(AKCIJA);
    expect(res.status).toBe(401);
  });

  // Akcija koja se zavrsava pre nego sto pocne u aplikaciji ne bi bila
  // prikazana nikad, pa se ne cuva.
  test('kraj ne moze biti pre pocetka', async () => {
    const res = await kaoAdmin('post', '/api/promotions').send({
      ...AKCIJA,
      dateFrom: SUTRA,
      dateTo: JUCE,
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/pre datuma pocetka/i);
  });

  test('isti dan za pocetak i kraj je jednodnevna akcija', async () => {
    const res = await kaoAdmin('post', '/api/promotions').send({
      ...AKCIJA,
      dateFrom: DANAS,
      dateTo: DANAS,
    });

    expect(res.status).toBe(201);
  });

  test('procenat preko 100 ne prolazi', async () => {
    const res = await kaoAdmin('post', '/api/promotions').send({
      ...AKCIJA,
      discountValue: 150,
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/veci od 100/i);
  });

  test('negativan popust ne prolazi', async () => {
    const res = await kaoAdmin('post', '/api/promotions').send({
      ...AKCIJA,
      discountValue: -5,
    });

    expect(res.status).toBe(400);
  });

  test('iznos u dinarima sme da bude veci od 100', async () => {
    const res = await kaoAdmin('post', '/api/promotions').send({
      ...AKCIJA,
      discountType: 'AMOUNT',
      discountValue: 500,
    });

    expect(res.status).toBe(201);
    expect(res.body.promotion.discountValue).toBe(500);
  });

  // Akcije tipa "drugo dete besplatno" se ne izrazavaju brojem.
  test('opisna akcija ide bez vrednosti', async () => {
    const res = await kaoAdmin('post', '/api/promotions').send({
      title: 'Drugo dete besplatno',
      discountType: 'TEXT',
      dateFrom: DANAS,
      dateTo: SUTRA,
    });

    expect(res.status).toBe(201);
    expect(res.body.promotion.discountValue).toBeNull();
  });

  test('brojcana akcija bez vrednosti ne prolazi', async () => {
    const res = await kaoAdmin('post', '/api/promotions').send({
      title: 'Bez broja',
      discountType: 'PERCENT',
      dateFrom: DANAS,
      dateTo: SUTRA,
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/vrednost popusta/i);
  });

  test('naziv je obavezan', async () => {
    const res = await kaoAdmin('post', '/api/promotions').send({ ...AKCIJA, title: '   ' });
    expect(res.status).toBe(400);
  });

  test('datum mora biti YYYY-MM-DD', async () => {
    const res = await kaoAdmin('post', '/api/promotions').send({ ...AKCIJA, dateFrom: '01.09.2026' });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/promotions', () => {
  test('javno vraca akcije koje vaze danas', async () => {
    await kaoAdmin('post', '/api/promotions').send(AKCIJA);

    const res = await request(app).get('/api/promotions');

    expect(res.status).toBe(200);
    expect(res.body.promotions).toHaveLength(1);
    expect(res.body.promotions[0].title).toBe('Letnja akcija');
  });

  test('istekla akcija se ne prikazuje', async () => {
    await kaoAdmin('post', '/api/promotions').send({
      ...AKCIJA,
      dateFrom: PRE_NEDELJU,
      dateTo: JUCE,
    });

    const res = await request(app).get('/api/promotions');
    expect(res.body.promotions).toHaveLength(0);
  });

  test('buduca akcija se jos ne prikazuje', async () => {
    await kaoAdmin('post', '/api/promotions').send({
      ...AKCIJA,
      dateFrom: SUTRA,
      dateTo: ZA_NEDELJU,
    });

    const res = await request(app).get('/api/promotions');
    expect(res.body.promotions).toHaveLength(0);
  });

  test('ali se vidi za dan u kom vazi', async () => {
    await kaoAdmin('post', '/api/promotions').send({
      ...AKCIJA,
      dateFrom: SUTRA,
      dateTo: ZA_NEDELJU,
    });

    const res = await request(app).get(`/api/promotions?date=${SUTRA}`);
    expect(res.body.promotions).toHaveLength(1);
  });

  test('iskljucena akcija se ne prikazuje ni dok traje', async () => {
    await kaoAdmin('post', '/api/promotions').send({ ...AKCIJA, isActive: false });

    const res = await request(app).get('/api/promotions');
    expect(res.body.promotions).toHaveLength(0);
  });

  test('los datum u upitu je greska, a ne tiha prazna lista', async () => {
    const res = await request(app).get('/api/promotions?date=sutra');
    expect(res.status).toBe(400);
  });
});

describe('GET /api/promotions/all', () => {
  test('admin vidi i istekle i iskljucene', async () => {
    await kaoAdmin('post', '/api/promotions').send({
      ...AKCIJA,
      dateFrom: PRE_NEDELJU,
      dateTo: JUCE,
    });
    await kaoAdmin('post', '/api/promotions').send({ ...AKCIJA, isActive: false });

    const res = await kaoAdmin('get', '/api/promotions/all');

    expect(res.status).toBe(200);
    expect(res.body.promotions).toHaveLength(2);
  });

  test('roditelj ne vidi spisak za admina', async () => {
    const res = await request(app)
      .get('/api/promotions/all')
      .set('Authorization', `Bearer ${parentToken}`);

    expect(res.status).toBe(403);
  });
});

describe('PATCH /api/promotions/:id', () => {
  async function napravi(telo = AKCIJA) {
    const res = await kaoAdmin('post', '/api/promotions').send(telo);
    return res.body.promotion.id;
  }

  test('menja naziv i popust', async () => {
    const id = await napravi();

    const res = await kaoAdmin('patch', `/api/promotions/${id}`).send({
      title: 'Jesenja akcija',
      discountValue: 30,
    });

    expect(res.status).toBe(200);
    expect(res.body.promotion.title).toBe('Jesenja akcija');
    expect(res.body.promotion.discountValue).toBe(30);
  });

  // Izmena sme da posalje samo jedan datum; drugi se uzima iz zapisa, pa se
  // pomeranjem pocetka ne moze dobiti akcija koja se zavrsava pre pocetka.
  test('pomeranje samo pocetka preko kraja ne prolazi', async () => {
    const id = await napravi({ ...AKCIJA, dateFrom: JUCE, dateTo: DANAS });

    const res = await kaoAdmin('patch', `/api/promotions/${id}`).send({ dateFrom: ZA_NEDELJU });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/pre datuma pocetka/i);
  });

  test('prelazak na opisnu akciju brise broj', async () => {
    const id = await napravi();

    const res = await kaoAdmin('patch', `/api/promotions/${id}`).send({ discountType: 'TEXT' });

    expect(res.status).toBe(200);
    expect(res.body.promotion.discountValue).toBeNull();
  });

  test('gasenje akcije je sklanja iz javnog spiska', async () => {
    const id = await napravi();

    await kaoAdmin('patch', `/api/promotions/${id}`).send({ isActive: false });

    const res = await request(app).get('/api/promotions');
    expect(res.body.promotions).toHaveLength(0);
  });

  test('nepostojeca akcija je 404', async () => {
    const res = await kaoAdmin('patch', '/api/promotions/00000000-0000-0000-0000-000000000000').send({
      title: 'Nesto',
    });

    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/promotions/:id', () => {
  test('admin brise akciju', async () => {
    const napravljena = await kaoAdmin('post', '/api/promotions').send(AKCIJA);
    const id = napravljena.body.promotion.id;

    const res = await kaoAdmin('delete', `/api/promotions/${id}`);

    expect(res.status).toBe(200);
    expect(await prisma.promotion.count()).toBe(0);
  });

  test('roditelj ne brise', async () => {
    const napravljena = await kaoAdmin('post', '/api/promotions').send(AKCIJA);

    const res = await request(app)
      .delete(`/api/promotions/${napravljena.body.promotion.id}`)
      .set('Authorization', `Bearer ${parentToken}`);

    expect(res.status).toBe(403);
  });

  test('nepostojeca akcija je 404', async () => {
    const res = await kaoAdmin('delete', '/api/promotions/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(404);
  });
});
