// Granica se cita pri ucitavanju modula, pa se mora postaviti pre `app`.
// U ostalim testovima je namerno visoka (.env.test), da prijave koje oni prave
// ne udaraju u nju.
process.env.LOGIN_RATE_LIMIT = '3';

const request = require('supertest');
const app = require('../src/app');
const { cleanDB, createTestUser, disconnectDB } = require('./setup');

const EMAIL = 'brana@primer.rs';
const DRUGI = 'drugi.nalog@primer.rs';

const prijava = (email, password) =>
  request(app).post('/api/auth/login').send({ email, password });

beforeAll(async () => {
  await cleanDB();
  await createTestUser({ email: EMAIL, password: 'tacna123', firstName: 'Brana', lastName: 'Test' });
  await createTestUser({ email: DRUGI, password: 'tacna123', firstName: 'Drugi', lastName: 'Nalog' });
});

afterAll(async () => {
  await cleanDB();
  await disconnectDB();
});

// Prijava je jedina ruta koja prima lozinku; bez brane se moze pogadjati
// koliko god puta.
describe('Brana nad pogadjanjem lozinke', () => {
  test('posle tri promasaja cetvrti pokusaj se odbija', async () => {
    for (let i = 0; i < 3; i++) {
      const res = await prijava(EMAIL, 'pogresna');
      expect(res.status).toBe(401);
    }

    const cetvrti = await prijava(EMAIL, 'pogresna');
    expect(cetvrti.status).toBe(429);
    expect(cetvrti.body.message).toContain('Previse pokusaja');
  });

  // Zakljucavanje ide po nalogu: promasaji na jednom ne smeju da zakljucaju
  // recepciju koja radi sa drugog naloga.
  test('drugi nalog i dalje moze da se prijavi', async () => {
    const res = await prijava(DRUGI, 'tacna123');
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  // Zakljucan je i tacan pokusaj, inace bi napadac znao kad je pogodio.
  test('zakljucan nalog ne prolazi ni sa tacnom lozinkom', async () => {
    const res = await prijava(EMAIL, 'tacna123');
    expect(res.status).toBe(429);
  });

  test('uspesne prijave ne trose pokusaje', async () => {
    for (let i = 0; i < 6; i++) {
      const res = await prijava(DRUGI, 'tacna123');
      expect(res.status).toBe(200);
    }
  });
});
