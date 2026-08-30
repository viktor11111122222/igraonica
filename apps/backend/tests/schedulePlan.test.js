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

// Fiksni datum, a dan u nedelji se iz njega racuna - test ne sme da zavisi od
// toga kad se pokrece, ali nedeljna aktivnost mora da padne bas na taj dan.
const DAN = '2026-09-07';
const DRUGI_DAN = '2026-09-08';
const DAN_U_NEDELJI = (new Date(`${DAN}T00:00:00.000Z`).getUTCDay() + 6) % 7;

const kaoAdmin = (metod, put) =>
  request(app)[metod](put).set('Authorization', `Bearer ${adminToken}`);

const nedeljnaAktivnost = (telo) =>
  kaoAdmin('post', '/api/schedule').send({
    dayOfWeek: DAN_U_NEDELJI,
    isRecurring: true,
    startTime: '10:00',
    endTime: '11:00',
    ...telo,
  });

const rodjendan = (telo) =>
  kaoAdmin('post', '/api/reservations').send({
    type: 'BIRTHDAY',
    title: 'Rodjendan - Lena',
    date: DAN,
    startTime: '17:00',
    endTime: '20:00',
    ...telo,
  });

const plan = (datum = DAN) => request(app).get(`/api/schedule/plan?date=${datum}`);

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
  await prisma.reservation.deleteMany();
  await prisma.activity.deleteMany();
});

afterAll(async () => {
  await cleanDB();
  await disconnectDB();
});

describe('GET /api/schedule/plan - ulaz', () => {
  test('bez datuma je greska, a ne tih prazan plan', async () => {
    const res = await request(app).get('/api/schedule/plan');
    expect(res.status).toBe(400);
  });

  test('los format datuma je greska', async () => {
    const res = await plan('07.09.2026.');
    expect(res.status).toBe(400);
  });

  test('plan je javan - vidi ga i neprijavljen roditelj', async () => {
    const res = await plan();
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
  });

  // Prijavljen roditelj dobija isti plan - token ga ne menja ni u sta drugo.
  test('prijavljen roditelj dobija isti plan', async () => {
    const bez = await plan();
    const sa = await request(app)
      .get(`/api/schedule/plan?date=${DAN}`)
      .set('Authorization', `Bearer ${parentToken}`);

    expect(sa.status).toBe(200);
    expect(sa.body).toEqual(bez.body);
  });
});

describe('GET /api/schedule/plan - sta ulazi u dan', () => {
  test('nedeljna aktivnost tog dana u nedelji', async () => {
    await nedeljnaAktivnost({ title: 'Mali kuvari' });

    const res = await plan();

    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].title).toBe('Mali kuvari');
    expect(res.body.items[0].kind).toBe('ACTIVITY');
  });

  test('nedeljna aktivnost drugog dana ne ulazi', async () => {
    await nedeljnaAktivnost({ title: 'Drugi dan', dayOfWeek: (DAN_U_NEDELJI + 1) % 7 });

    const res = await plan();
    expect(res.body.items).toHaveLength(0);
  });

  // Jednokratni dogadjaji ranije nisu stizali do aplikacije uopste.
  test('jednokratni dogadjaj bas tog datuma', async () => {
    await kaoAdmin('post', '/api/schedule').send({
      title: 'Predstava',
      isRecurring: false,
      specificDate: DAN,
      startTime: '12:00',
      endTime: '13:00',
    });

    const res = await plan();

    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].title).toBe('Predstava');
  });

  test('rodjendan iz rezervacija', async () => {
    await rodjendan();

    const res = await plan();

    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].kind).toBe('BIRTHDAY');
    expect(res.body.items[0].title).toBe('Rodjendan - Lena');
    expect(res.body.items[0].startTime).toBe('17:00');
    expect(res.body.items[0].endTime).toBe('20:00');
  });

  test('rodjendan drugog datuma ne ulazi', async () => {
    await rodjendan({ date: DRUGI_DAN });

    const res = await plan();
    expect(res.body.items).toHaveLength(0);
  });

  test('otkazan rodjendan se ne prikazuje', async () => {
    const napravljen = await rodjendan();
    await kaoAdmin('patch', `/api/reservations/${napravljen.body.reservation.id}`).send({
      status: 'CANCELLED',
    });

    const res = await plan();
    expect(res.body.items).toHaveLength(0);
  });

  test('ugasena aktivnost se ne prikazuje', async () => {
    const napravljena = await nedeljnaAktivnost({ title: 'Ugasena' });
    await kaoAdmin('patch', `/api/schedule/${napravljena.body.activity.id}`).send({
      isActive: false,
    });

    const res = await plan();
    expect(res.body.items).toHaveLength(0);
  });

  // Spisak vidi svaki roditelj, pa ime deteta ne sme da izadje iz rezervacije.
  test('ime deteta ne izlazi u javni plan', async () => {
    await rodjendan({ childName: 'Lena Petrovic', childAge: 5 });

    const res = await plan();

    expect(res.body.items[0].childName).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain('Lena Petrovic');
  });
});

describe('GET /api/schedule/plan - redosled', () => {
  // Sustina: rodjendan je dogadjaj dana i stoji na vrhu bez obzira na sat.
  test('rodjendan je prvi iako pocinje kasnije od aktivnosti', async () => {
    await nedeljnaAktivnost({ title: 'Jutarnja', startTime: '09:00', endTime: '10:00' });
    await rodjendan({ startTime: '17:00', endTime: '20:00' });

    const res = await plan();

    expect(res.body.items.map((i) => i.title)).toEqual(['Rodjendan - Lena', 'Jutarnja']);
  });

  // Rodjendan gasi samo svoj termin - ostatak dana se odrzava normalno.
  test('aktivnosti i pre i posle rodjendana ostaju', async () => {
    await nedeljnaAktivnost({ title: 'Pre', startTime: '09:00', endTime: '10:00' });
    await nedeljnaAktivnost({ title: 'Posle', startTime: '20:30', endTime: '21:00' });
    await rodjendan({ startTime: '17:00', endTime: '20:00' });

    const res = await plan();

    expect(res.body.items.map((i) => i.title)).toEqual(['Rodjendan - Lena', 'Pre', 'Posle']);
  });

  test('aktivnosti medju sobom idu po vremenu, bez obzira jesu li nedeljne ili jednokratne', async () => {
    await nedeljnaAktivnost({ title: 'Podne', startTime: '12:00', endTime: '13:00' });
    await kaoAdmin('post', '/api/schedule').send({
      title: 'Jutro',
      isRecurring: false,
      specificDate: DAN,
      startTime: '08:00',
      endTime: '09:00',
    });

    const res = await plan();

    expect(res.body.items.map((i) => i.title)).toEqual(['Jutro', 'Podne']);
  });

  test('vise rodjendana istog dana idu po vremenu, pa tek onda aktivnosti', async () => {
    await nedeljnaAktivnost({ title: 'Aktivnost', startTime: '09:00', endTime: '10:00' });
    await rodjendan({ title: 'Popodnevni', startTime: '17:00', endTime: '20:00' });
    await rodjendan({ title: 'Prepodnevni', startTime: '11:00', endTime: '14:00' });

    const res = await plan();

    expect(res.body.items.map((i) => i.title)).toEqual([
      'Prepodnevni',
      'Popodnevni',
      'Aktivnost',
    ]);
  });

  test('celodnevni rodjendan nosi svoju oznaku', async () => {
    await rodjendan({ isFullDay: true });

    const res = await plan();
    expect(res.body.items[0].isFullDay).toBe(true);
  });
});

// Dok rodjendan traje, redovan program se ne odrzava - pa nema ni sta da stoji
// u rasporedu.
describe('GET /api/schedule/plan - rodjendan gasi aktivnosti', () => {
  test('celodnevni rodjendan izbacuje sve aktivnosti tog dana', async () => {
    await nedeljnaAktivnost({ title: 'Jutarnja', startTime: '09:00', endTime: '10:00' });
    await nedeljnaAktivnost({ title: 'Popodnevna', startTime: '17:00', endTime: '18:00' });
    await rodjendan({ isFullDay: true });

    const res = await plan();

    expect(res.body.items.map((i) => i.title)).toEqual(['Rodjendan']);
  });

  test('celodnevni rodjendan izbacuje i jednokratni dogadjaj', async () => {
    await kaoAdmin('post', '/api/schedule').send({
      title: 'Predstava',
      isRecurring: false,
      specificDate: DAN,
      startTime: '11:00',
      endTime: '12:00',
    });
    await rodjendan({ isFullDay: true });

    const res = await plan();

    expect(res.body.items.map((i) => i.title)).toEqual(['Rodjendan']);
  });

  test('celodnevni rodjendan pise samo "Rodjendan", bez imena deteta', async () => {
    await rodjendan({ title: 'Rodjendan - Lena', isFullDay: true });

    const res = await plan();

    expect(res.body.items[0].title).toBe('Rodjendan');
  });

  test('rodjendan u terminu zadrzava svoj naslov', async () => {
    await rodjendan({ title: 'Rodjendan - Lena', startTime: '17:00', endTime: '20:00' });

    const res = await plan();

    expect(res.body.items[0].title).toBe('Rodjendan - Lena');
  });

  test('aktivnost u vreme rodjendana nestaje', async () => {
    await nedeljnaAktivnost({ title: 'Mali kuvari', startTime: '18:00', endTime: '19:00' });
    await rodjendan({ startTime: '17:00', endTime: '20:00' });

    const res = await plan();

    expect(res.body.items.map((i) => i.title)).toEqual(['Rodjendan - Lena']);
  });

  test('aktivnost koja samo zahvata pocetak rodjendana nestaje', async () => {
    await nedeljnaAktivnost({ title: 'Radionica', startTime: '16:00', endTime: '17:30' });
    await rodjendan({ startTime: '17:00', endTime: '20:00' });

    const res = await plan();

    expect(res.body.items.map((i) => i.title)).toEqual(['Rodjendan - Lena']);
  });

  test('aktivnost duza od rodjendana, koja ga obuhvata, nestaje', async () => {
    await nedeljnaAktivnost({ title: 'Celo popodne', startTime: '16:00', endTime: '21:00' });
    await rodjendan({ startTime: '17:00', endTime: '20:00' });

    const res = await plan();

    expect(res.body.items.map((i) => i.title)).toEqual(['Rodjendan - Lena']);
  });

  // Termin koji se zavrsava tacno kad rodjendan pocinje se ne preklapa s njim.
  test('aktivnost tacno pre rodjendana ostaje', async () => {
    await nedeljnaAktivnost({ title: 'Pre', startTime: '16:00', endTime: '17:00' });
    await rodjendan({ startTime: '17:00', endTime: '20:00' });

    const res = await plan();

    expect(res.body.items.map((i) => i.title)).toEqual(['Rodjendan - Lena', 'Pre']);
  });

  test('aktivnost tacno posle rodjendana ostaje', async () => {
    await nedeljnaAktivnost({ title: 'Posle', startTime: '20:00', endTime: '21:00' });
    await rodjendan({ startTime: '17:00', endTime: '20:00' });

    const res = await plan();

    expect(res.body.items.map((i) => i.title)).toEqual(['Rodjendan - Lena', 'Posle']);
  });

  // Dva rodjendana, svaki gasi svoj termin - a ono izmedju njih se odrzava.
  test('svaki rodjendan gasi svoj termin', async () => {
    await nedeljnaAktivnost({ title: 'Prepodne', startTime: '10:30', endTime: '11:30' });
    await nedeljnaAktivnost({ title: 'Izmedju', startTime: '14:30', endTime: '15:30' });
    await nedeljnaAktivnost({ title: 'Uvece', startTime: '18:00', endTime: '19:00' });
    await rodjendan({ title: 'Prvi', startTime: '10:00', endTime: '13:00' });
    await rodjendan({ title: 'Drugi', startTime: '17:00', endTime: '20:00' });

    const res = await plan();

    expect(res.body.items.map((i) => i.title)).toEqual(['Prvi', 'Drugi', 'Izmedju']);
  });

  // Otkazan rodjendan ne oslobadja samo sebe - ne sme ni da gasi program.
  test('otkazan celodnevni rodjendan ne dira aktivnosti', async () => {
    await nedeljnaAktivnost({ title: 'Jutarnja', startTime: '09:00', endTime: '10:00' });
    const napravljen = await rodjendan({ isFullDay: true });
    await kaoAdmin('patch', `/api/reservations/${napravljen.body.reservation.id}`).send({
      status: 'CANCELLED',
    });

    const res = await plan();

    expect(res.body.items.map((i) => i.title)).toEqual(['Jutarnja']);
  });
});
