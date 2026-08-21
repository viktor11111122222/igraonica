const request = require('supertest');
const app = require('../src/app');
const { cleanDB, createTestUser, disconnectDB, TEST_ADMIN, TEST_PARENT } = require('./setup');

let adminToken;
let parentToken;
let menuItemId;

const today = new Date().toISOString().split('T')[0];

// Nadji ponedeljak ove nedelje
function getMonday() {
  const d = new Date();
  const day = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - (day === 0 ? 6 : day - 1));
  return d.toISOString().split('T')[0];
}

const monday = getMonday();

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

describe('POST /api/menu', () => {
  test('admin kreira stavku menija', async () => {
    const res = await request(app)
      .post('/api/menu')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        date: today,
        mealType: 'LUNCH',
        name: 'Pasta Bolonjeze',
        description: 'Sa parmezanom',
        allergens: 'gluten, mleko',
      });

    expect(res.status).toBe(201);
    expect(res.body.item.name).toBe('Pasta Bolonjeze');
    expect(res.body.item.mealType).toBe('LUNCH');
    expect(res.body.item.description).toBe('Sa parmezanom');
    expect(res.body.item.allergens).toBe('gluten, mleko');
    menuItemId = res.body.item.id;
  });

  test('admin kreira dorucak za isti dan', async () => {
    const res = await request(app)
      .post('/api/menu')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        date: today,
        mealType: 'BREAKFAST',
        name: 'Palacinci sa nutelom',
      });

    expect(res.status).toBe(201);
    expect(res.body.item.mealType).toBe('BREAKFAST');
  });

  test('ne dozvoljava duplikat za isti datum i tip obroka', async () => {
    const res = await request(app)
      .post('/api/menu')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        date: today,
        mealType: 'LUNCH',
        name: 'Drugi rucak',
      });

    expect(res.status).toBe(409);
    expect(res.body.message).toContain('vec postoji');
  });

  test('validira obavezna polja', async () => {
    const res = await request(app)
      .post('/api/menu')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ date: today });

    expect(res.status).toBe(400);
    expect(res.body.errors).toBeDefined();
  });

  test('validira tip obroka', async () => {
    const res = await request(app)
      .post('/api/menu')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ date: today, mealType: 'DINNER', name: 'Vecera' });

    expect(res.status).toBe(400);
  });

  test('parent ne moze da kreira meni', async () => {
    const res = await request(app)
      .post('/api/menu')
      .set('Authorization', `Bearer ${parentToken}`)
      .send({ date: today, mealType: 'SNACK_MORNING', name: 'Voca' });

    expect(res.status).toBe(403);
  });
});

describe('GET /api/menu', () => {
  test('javno prikazuje meni za danas', async () => {
    const res = await request(app).get('/api/menu');

    expect(res.status).toBe(200);
    expect(res.body.date).toBe(today);
    expect(res.body.items.length).toBe(2);
  });

  test('prikazuje meni za odredjeni datum', async () => {
    const res = await request(app).get(`/api/menu?date=${today}`);

    expect(res.status).toBe(200);
    expect(res.body.items.length).toBe(2);
  });

  test('prazan meni za datum bez stavki', async () => {
    const res = await request(app).get('/api/menu?date=2020-01-01');

    expect(res.status).toBe(200);
    expect(res.body.items.length).toBe(0);
  });
});

describe('GET /api/menu/week', () => {
  beforeAll(async () => {
    // Dodaj stavke za vise dana ove nedelje
    const days = [];
    for (let i = 0; i < 5; i++) {
      const d = new Date(monday + 'T00:00:00.000Z');
      d.setUTCDate(d.getUTCDate() + i);
      days.push(d.toISOString().split('T')[0]);
    }

    for (const day of days) {
      // Preskoci ako vec postoji za danas
      if (day === today) continue;
      await request(app)
        .post('/api/menu')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ date: day, mealType: 'LUNCH', name: `Rucak ${day}` });
    }
  });

  test('prikazuje nedeljni meni grupisano po danima', async () => {
    const res = await request(app).get(`/api/menu/week?date=${monday}`);

    expect(res.status).toBe(200);
    expect(res.body.weekStart).toBeDefined();
    expect(res.body.weekEnd).toBeDefined();
    expect(res.body.week).toBeDefined();

    const days = Object.keys(res.body.week);
    expect(days.length).toBe(7);
  });

  test('nedeljni meni bez datuma koristi trenutnu nedelju', async () => {
    const res = await request(app).get('/api/menu/week');

    expect(res.status).toBe(200);
    expect(res.body.week).toBeDefined();
  });
});

describe('POST /api/menu/bulk', () => {
  test('admin kreira vise stavki odjednom', async () => {
    const nextMonday = new Date(monday + 'T00:00:00.000Z');
    nextMonday.setUTCDate(nextMonday.getUTCDate() + 7);
    const nm = nextMonday.toISOString().split('T')[0];

    const nextTuesday = new Date(nextMonday);
    nextTuesday.setUTCDate(nextMonday.getUTCDate() + 1);
    const nt = nextTuesday.toISOString().split('T')[0];

    const res = await request(app)
      .post('/api/menu/bulk')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        items: [
          { date: nm, mealType: 'BREAKFAST', name: 'Musli' },
          { date: nm, mealType: 'LUNCH', name: 'Piletina sa povrcem' },
          { date: nm, mealType: 'SNACK_AFTERNOON', name: 'Voce' },
          { date: nt, mealType: 'LUNCH', name: 'Riba sa krompirom' },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.items.length).toBe(4);
    expect(res.body.count).toBe(4);
  });

  test('bulk upsert azurira postojece stavke', async () => {
    const nextMonday = new Date(monday + 'T00:00:00.000Z');
    nextMonday.setUTCDate(nextMonday.getUTCDate() + 7);
    const nm = nextMonday.toISOString().split('T')[0];

    const res = await request(app)
      .post('/api/menu/bulk')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        items: [
          { date: nm, mealType: 'BREAKFAST', name: 'Jaja na oko (azurirano)' },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.items[0].name).toBe('Jaja na oko (azurirano)');
  });

  test('validira stavke u bulk requestu', async () => {
    const res = await request(app)
      .post('/api/menu/bulk')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ items: [{ date: today }] });

    expect(res.status).toBe(400);
  });

  test('validira da items nije prazan', async () => {
    const res = await request(app)
      .post('/api/menu/bulk')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ items: [] });

    expect(res.status).toBe(400);
  });

  test('parent ne moze bulk kreiranje', async () => {
    const res = await request(app)
      .post('/api/menu/bulk')
      .set('Authorization', `Bearer ${parentToken}`)
      .send({
        items: [{ date: today, mealType: 'LUNCH', name: 'Hack' }],
      });

    expect(res.status).toBe(403);
  });
});

describe('PATCH /api/menu/:id', () => {
  test('admin azurira stavku menija', async () => {
    const res = await request(app)
      .patch(`/api/menu/${menuItemId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Pasta Carbonara', allergens: 'gluten, jaja' });

    expect(res.status).toBe(200);
    expect(res.body.item.name).toBe('Pasta Carbonara');
    expect(res.body.item.allergens).toBe('gluten, jaja');
  });

  test('vraca 404 za nepostejecu stavku', async () => {
    const res = await request(app)
      .patch('/api/menu/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Test' });

    expect(res.status).toBe(404);
  });

  test('parent ne moze da azurira meni', async () => {
    const res = await request(app)
      .patch(`/api/menu/${menuItemId}`)
      .set('Authorization', `Bearer ${parentToken}`)
      .send({ name: 'Hack' });

    expect(res.status).toBe(403);
  });
});

describe('DELETE /api/menu/:id', () => {
  test('admin brise stavku menija', async () => {
    const res = await request(app)
      .delete(`/api/menu/${menuItemId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('obrisana');
  });

  test('vraca 404 za nepostojecu stavku', async () => {
    const res = await request(app)
      .delete('/api/menu/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });

  test('parent ne moze da brise meni', async () => {
    const res = await request(app)
      .delete(`/api/menu/${menuItemId}`)
      .set('Authorization', `Bearer ${parentToken}`);

    // Vec obrisano, ali svejedno 403 pre nego sto stigne do baze
    expect(res.status).toBe(403);
  });
});
