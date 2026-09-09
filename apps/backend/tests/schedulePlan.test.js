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

// Roditelji vide samo potvrdjene rezervacije, pa fixture odmah potvrdjuje.
// Testovi koji bas gadjaju cekanje to rade sami, eksplicitno.
const rodjendan = async (telo) => {
  const odgovor = await kaoAdmin('post', '/api/reservations').send({
    type: 'BIRTHDAY',
    title: 'Rodjendan',
    date: DAN,
    startTime: '17:00',
    endTime: '20:00',
    ...telo,
  });
  await potvrdi(odgovor);
  return odgovor;
};

async function potvrdi(odgovor) {
  if (odgovor.status !== 201) return;
  await kaoAdmin('patch', `/api/reservations/${odgovor.body.reservation.id}`).send({
    status: 'CONFIRMED',
  });
}

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
    expect(res.body.items[0].title).toBe('Rodjendan');
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

    expect(res.body.items.map((i) => i.title)).toEqual(['Rodjendan', 'Jutarnja']);
  });

  // Rodjendan gasi samo svoj termin - ostatak dana se odrzava normalno.
  test('aktivnosti i pre i posle rodjendana ostaju', async () => {
    await nedeljnaAktivnost({ title: 'Pre', startTime: '09:00', endTime: '10:00' });
    await nedeljnaAktivnost({ title: 'Posle', startTime: '20:30', endTime: '21:00' });
    await rodjendan({ startTime: '17:00', endTime: '20:00' });

    const res = await plan();

    expect(res.body.items.map((i) => i.title)).toEqual(['Rodjendan', 'Pre', 'Posle']);
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

  // U spisku svuda stoji naziv tipa, pa se rodjendani razlikuju po vremenu.
  test('vise rodjendana istog dana idu po vremenu, pa tek onda aktivnosti', async () => {
    await nedeljnaAktivnost({ title: 'Aktivnost', startTime: '09:00', endTime: '10:00' });
    await rodjendan({ startTime: '17:00', endTime: '20:00' });
    await rodjendan({ startTime: '11:00', endTime: '14:00' });

    const res = await plan();

    expect(res.body.items.map((i) => [i.kind, i.startTime])).toEqual([
      ['BIRTHDAY', '11:00'],
      ['BIRTHDAY', '17:00'],
      ['ACTIVITY', '09:00'],
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

  // Naslov je interna beleska osoblja i cesto nosi ime deteta - u spisku koji
  // vidi svaki roditelj stoji naziv tipa.
  test('umesto naslova stoji naziv tipa, bez imena deteta', async () => {
    await rodjendan({ title: 'Lenin 5. rodjendan', isFullDay: true });

    const res = await plan();

    expect(res.body.items[0].title).toBe('Rodjendan');
    expect(JSON.stringify(res.body)).not.toContain('Lenin');
  });

  test('aktivnost u vreme rodjendana nestaje', async () => {
    await nedeljnaAktivnost({ title: 'Mali kuvari', startTime: '18:00', endTime: '19:00' });
    await rodjendan({ startTime: '17:00', endTime: '20:00' });

    const res = await plan();

    expect(res.body.items.map((i) => i.title)).toEqual(['Rodjendan']);
  });

  test('aktivnost koja samo zahvata pocetak rodjendana nestaje', async () => {
    await nedeljnaAktivnost({ title: 'Radionica', startTime: '16:00', endTime: '17:30' });
    await rodjendan({ startTime: '17:00', endTime: '20:00' });

    const res = await plan();

    expect(res.body.items.map((i) => i.title)).toEqual(['Rodjendan']);
  });

  test('aktivnost duza od rodjendana, koja ga obuhvata, nestaje', async () => {
    await nedeljnaAktivnost({ title: 'Celo popodne', startTime: '16:00', endTime: '21:00' });
    await rodjendan({ startTime: '17:00', endTime: '20:00' });

    const res = await plan();

    expect(res.body.items.map((i) => i.title)).toEqual(['Rodjendan']);
  });

  // Termin koji se zavrsava tacno kad rodjendan pocinje se ne preklapa s njim.
  test('aktivnost tacno pre rodjendana ostaje', async () => {
    await nedeljnaAktivnost({ title: 'Pre', startTime: '16:00', endTime: '17:00' });
    await rodjendan({ startTime: '17:00', endTime: '20:00' });

    const res = await plan();

    expect(res.body.items.map((i) => i.title)).toEqual(['Rodjendan', 'Pre']);
  });

  test('aktivnost tacno posle rodjendana ostaje', async () => {
    await nedeljnaAktivnost({ title: 'Posle', startTime: '20:00', endTime: '21:00' });
    await rodjendan({ startTime: '17:00', endTime: '20:00' });

    const res = await plan();

    expect(res.body.items.map((i) => i.title)).toEqual(['Rodjendan', 'Posle']);
  });

  // Dva rodjendana, svaki gasi svoj termin - a ono izmedju njih se odrzava.
  test('svaki rodjendan gasi svoj termin', async () => {
    await nedeljnaAktivnost({ title: 'Prepodne', startTime: '10:30', endTime: '11:30' });
    await nedeljnaAktivnost({ title: 'Izmedju', startTime: '14:30', endTime: '15:30' });
    await nedeljnaAktivnost({ title: 'Uvece', startTime: '18:00', endTime: '19:00' });
    await rodjendan({ startTime: '10:00', endTime: '13:00' });
    await rodjendan({ startTime: '17:00', endTime: '20:00' });

    const res = await plan();

    // Ostaju oba rodjendana i samo ona aktivnost koja je izmedju njih.
    const aktivnosti = res.body.items.filter((i) => i.kind === 'ACTIVITY');
    expect(aktivnosti.map((i) => i.title)).toEqual(['Izmedju']);
    expect(res.body.items.filter((i) => i.kind === 'BIRTHDAY')).toHaveLength(2);
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

// Igraonicu zauzima svaka rezervacija, ne samo rodjendan: privatna proslava,
// grupna poseta ili nesto sto je osoblje samo nazvalo drze isto pravo na
// termin, pa gase redovan program isto kao i rodjendan.
describe('GET /api/schedule/plan - rezervacije koje nisu rodjendan', () => {
  const rezervacija = async (telo) => {
    const odgovor = await kaoAdmin('post', '/api/reservations').send({
      type: 'PRIVATE_EVENT',
      title: 'Interna beleska',
      date: DAN,
      startTime: '17:00',
      endTime: '20:00',
      ...telo,
    });
    await potvrdi(odgovor);
    return odgovor;
  };

  test('privatna proslava ulazi u plan pod nazivom tipa', async () => {
    await rezervacija();

    const res = await plan();

    expect(res.body.items[0].kind).toBe('RESERVATION');
    expect(res.body.items[0].title).toBe('Privatna proslava');
  });

  test('grupna poseta gasi aktivnost u svom terminu', async () => {
    await nedeljnaAktivnost({ title: 'Mali kuvari', startTime: '10:30', endTime: '11:30' });
    await rezervacija({ type: 'GROUP_BOOKING', startTime: '10:00', endTime: '12:00' });

    const res = await plan();

    expect(res.body.items.map((i) => i.title)).toEqual(['Grupna poseta']);
  });

  test('aktivnost van termina rezervacije ostaje', async () => {
    await nedeljnaAktivnost({ title: 'Jutarnja', startTime: '09:00', endTime: '10:00' });
    await rezervacija();

    const res = await plan();

    expect(res.body.items.map((i) => i.title)).toEqual(['Privatna proslava', 'Jutarnja']);
  });

  // Kod tipa "Drugo" osoblje upisuje svoj naziv - stoji on, a ne "Drugo".
  test('upisani naziv tipa se prikazuje', async () => {
    await rezervacija({ type: 'OTHER', customType: 'Skolska ekskurzija' });

    const res = await plan();

    expect(res.body.items[0].title).toBe('Skolska ekskurzija');
  });

  test('mesecni dogadjaj nosi svoj naziv', async () => {
    await rezervacija({ type: 'MONTHLY_EVENT' });

    const res = await plan();

    expect(res.body.items[0].title).toBe('Mesecni dogadjaji');
  });

  test('otkazana rezervacija ne gasi nista', async () => {
    await nedeljnaAktivnost({ title: 'Mali kuvari', startTime: '18:00', endTime: '19:00' });
    const napravljena = await rezervacija();
    await kaoAdmin('patch', `/api/reservations/${napravljena.body.reservation.id}`).send({
      status: 'CANCELLED',
    });

    const res = await plan();

    expect(res.body.items.map((i) => i.title)).toEqual(['Mali kuvari']);
  });
});
