const request = require('supertest');
const app = require('../src/app');
const { prisma, cleanDB, createTestUser, disconnectDB, TEST_ADMIN, TEST_PARENT, prijaviSe } = require('./setup');

let adminToken;
let parentToken;
let parent2Token;
let parentId;
let parent2Id;
let childId;

beforeAll(async () => {
  await cleanDB();

  await createTestUser(TEST_ADMIN);
  const parent = await createTestUser(TEST_PARENT);
  const parent2 = await createTestUser({
    email: 'roditelj2@test.com',
    password: 'test123',
    firstName: 'Drugi',
    lastName: 'Roditelj',
  });

  parentId = parent.id;
  parent2Id = parent2.id;

  adminToken = await prijaviSe(app, TEST_ADMIN);

  parentToken = await prijaviSe(app, TEST_PARENT);

  parent2Token = await prijaviSe(app, { email: 'roditelj2@test.com', password: 'test123' });
});

afterAll(async () => {
  await cleanDB();
  await disconnectDB();
});

describe('POST /api/children', () => {
  test('roditelj dodaje dete', async () => {
    const res = await request(app)
      .post('/api/children')
      .set('Authorization', `Bearer ${parentToken}`)
      .send({
        firstName: 'Marko',
        lastName: 'Markovic',
        dateOfBirth: '2020-05-15',
        gender: 'MALE',
        allergies: 'kikiriki',
      });

    expect(res.status).toBe(201);
    expect(res.body.child.firstName).toBe('Marko');
    expect(res.body.child.lastName).toBe('Markovic');
    expect(res.body.child.qrCode).toMatch(/^IGR-[A-F0-9]{8}$/);
    expect(res.body.child.parentId).toBe(parentId);
    expect(res.body.child.gender).toBe('MALE');
    expect(res.body.child.allergies).toBe('kikiriki');
    childId = res.body.child.id;
  });

  test('roditelj dodaje drugo dete', async () => {
    const res = await request(app)
      .post('/api/children')
      .set('Authorization', `Bearer ${parentToken}`)
      .send({
        firstName: 'Ana',
        lastName: 'Markovic',
        dateOfBirth: '2022-01-10',
        gender: 'FEMALE',
      });

    expect(res.status).toBe(201);
    expect(res.body.child.firstName).toBe('Ana');
    expect(res.body.child.qrCode).toMatch(/^IGR-/);
  });

  test('admin dodaje dete drugom roditelju', async () => {
    const res = await request(app)
      .post('/api/children')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        firstName: 'Nikola',
        lastName: 'Nikolic',
        dateOfBirth: '2019-08-20',
        parentId: parent2Id,
      });

    expect(res.status).toBe(201);
    expect(res.body.child.parentId).toBe(parent2Id);
  });

  test('pol nije obavezan - prazan pol (null) ne obara dodavanje', async () => {
    const res = await request(app)
      .post('/api/children')
      .set('Authorization', `Bearer ${parent2Token}`)
      .send({
        firstName: 'Bez',
        lastName: 'Pola',
        dateOfBirth: '2021-04-04',
        gender: null,
      });

    expect(res.status).toBe(201);
    expect(res.body.child.gender).toBeNull();

    // Ostali testovi broje decu, pa ovo ne sme da ostane.
    await prisma.child.delete({ where: { id: res.body.child.id } });
  });

  test('preskocena pitanja ostaju "nije odgovoreno", a ne "ne"', async () => {
    const res = await request(app)
      .post('/api/children')
      .set('Authorization', `Bearer ${parent2Token}`)
      .send({
        firstName: 'Bez',
        lastName: 'Odgovora',
        dateOfBirth: '2021-04-04',
        photoConsent: true,
        eatsLunch: null,
      });

    expect(res.status).toBe(201);
    expect(res.body.child.photoConsent).toBe(true);
    expect(res.body.child.eatsLunch).toBeNull();
    expect(res.body.child.eatsSnack).toBeNull();
    expect(res.body.child.pickupPersons).toBeNull();

    await prisma.child.delete({ where: { id: res.body.child.id } });
  });

  test('nepostojeci pol se i dalje odbija', async () => {
    const res = await request(app)
      .post('/api/children')
      .set('Authorization', `Bearer ${parent2Token}`)
      .send({
        firstName: 'Los',
        lastName: 'Pol',
        dateOfBirth: '2021-04-04',
        gender: 'X',
      });

    expect(res.status).toBe(400);
  });

  test('svako dete dobija unikatan QR kod', async () => {
    const children = await prisma.child.findMany();
    const qrCodes = children.map((c) => c.qrCode);
    const unique = new Set(qrCodes);
    expect(unique.size).toBe(qrCodes.length);
  });

  test('validira obavezna polja', async () => {
    const res = await request(app)
      .post('/api/children')
      .set('Authorization', `Bearer ${parentToken}`)
      .send({ firstName: 'Samo Ime' });

    expect(res.status).toBe(400);
    expect(res.body.errors).toBeDefined();
  });

  test('validira datum rodjenja', async () => {
    const res = await request(app)
      .post('/api/children')
      .set('Authorization', `Bearer ${parentToken}`)
      .send({
        firstName: 'Test',
        lastName: 'Test',
        dateOfBirth: 'nije-datum',
      });

    expect(res.status).toBe(400);
  });

  test('admin ne moze da doda dete nepostojecem roditelju', async () => {
    const res = await request(app)
      .post('/api/children')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        firstName: 'Test',
        lastName: 'Test',
        dateOfBirth: '2020-01-01',
        parentId: '00000000-0000-0000-0000-000000000000',
      });

    expect(res.status).toBe(404);
    expect(res.body.message).toContain('Roditelj');
  });

  test('neprijavljen korisnik ne moze da dodaje decu', async () => {
    const res = await request(app)
      .post('/api/children')
      .send({
        firstName: 'Test',
        lastName: 'Test',
        dateOfBirth: '2020-01-01',
      });

    expect(res.status).toBe(401);
  });
});

describe('GET /api/children', () => {
  test('roditelj vidi samo svoju decu', async () => {
    const res = await request(app)
      .get('/api/children')
      .set('Authorization', `Bearer ${parentToken}`);

    expect(res.status).toBe(200);
    expect(res.body.children.length).toBe(2);
    res.body.children.forEach((child) => {
      expect(child.parentId).toBe(parentId);
    });
  });

  test('drugi roditelj vidi samo svoju decu', async () => {
    const res = await request(app)
      .get('/api/children')
      .set('Authorization', `Bearer ${parent2Token}`);

    expect(res.status).toBe(200);
    expect(res.body.children.length).toBe(1);
    expect(res.body.children[0].firstName).toBe('Nikola');
  });
});

describe('GET /api/children/all (admin)', () => {
  test('admin vidi svu decu sa roditeljima', async () => {
    const res = await request(app)
      .get('/api/children/all')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.children.length).toBe(3);
    expect(res.body.pagination).toBeDefined();
    expect(res.body.pagination.total).toBe(3);
    res.body.children.forEach((child) => {
      expect(child.parent).toBeDefined();
      expect(child.parent.password).toBeUndefined();
    });
  });

  test('admin pretraga po imenu', async () => {
    const res = await request(app)
      .get('/api/children/all?search=Marko')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.children.length).toBeGreaterThanOrEqual(1);
  });

  test('parent ne moze da pristupi admin listi', async () => {
    const res = await request(app)
      .get('/api/children/all')
      .set('Authorization', `Bearer ${parentToken}`);

    expect(res.status).toBe(403);
  });
});

describe('GET /api/children/:id', () => {
  test('roditelj vidi detalje svog deteta', async () => {
    const res = await request(app)
      .get(`/api/children/${childId}`)
      .set('Authorization', `Bearer ${parentToken}`);

    expect(res.status).toBe(200);
    expect(res.body.child.id).toBe(childId);
    expect(res.body.child.parent).toBeDefined();
  });

  test('roditelj ne moze da vidi tudje dete', async () => {
    const res = await request(app)
      .get(`/api/children/${childId}`)
      .set('Authorization', `Bearer ${parent2Token}`);

    expect(res.status).toBe(403);
  });

  test('admin moze da vidi bilo koje dete', async () => {
    const res = await request(app)
      .get(`/api/children/${childId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.child.id).toBe(childId);
  });

  test('vraca 404 za nepostojece dete', async () => {
    const res = await request(app)
      .get('/api/children/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${parentToken}`);

    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/children/:id', () => {
  test('roditelj azurira svoje dete', async () => {
    const res = await request(app)
      .patch(`/api/children/${childId}`)
      .set('Authorization', `Bearer ${parentToken}`)
      .send({ firstName: 'Marko Updated', allergies: 'gluten' });

    expect(res.status).toBe(200);
    expect(res.body.child.firstName).toBe('Marko Updated');
    expect(res.body.child.allergies).toBe('gluten');
  });

  test('roditelj ne moze da azurira tudje dete', async () => {
    const res = await request(app)
      .patch(`/api/children/${childId}`)
      .set('Authorization', `Bearer ${parent2Token}`)
      .send({ firstName: 'Hack' });

    expect(res.status).toBe(403);
  });

  test('admin moze da azurira bilo koje dete', async () => {
    const res = await request(app)
      .patch(`/api/children/${childId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ notes: 'Admin beleska' });

    expect(res.status).toBe(200);
    expect(res.body.child.notes).toBe('Admin beleska');
  });

  test('roditelj naknadno dopunjuje saglasnosti i ko preuzima dete', async () => {
    const res = await request(app)
      .patch(`/api/children/${childId}`)
      .set('Authorization', `Bearer ${parentToken}`)
      .send({
        photoConsent: false,
        eatsLunch: true,
        eatsSnack: true,
        walksConsent: true,
        pickupPersons: 'Baka Mira 0641112222',
        extraContactPhone: '065 222 3333',
      });

    expect(res.status).toBe(200);
    expect(res.body.child.photoConsent).toBe(false);
    expect(res.body.child.eatsLunch).toBe(true);
    expect(res.body.child.eatsSnack).toBe(true);
    expect(res.body.child.pickupPersons).toBe('Baka Mira 0641112222');
    expect(res.body.child.walksConsent).toBe(true);
    expect(res.body.child.extraContactPhone).toBe('065 222 3333');
  });

  test('dodatni kontakt: pogresan broj se odbija', async () => {
    const res = await request(app)
      .patch(`/api/children/${childId}`)
      .set('Authorization', `Bearer ${parentToken}`)
      .send({ extraContactPhone: '064 12' });

    expect(res.status).toBe(400);
  });

  // Roditelj koji nema nikoga to i upise - polje ne ostaje prazno.
  test('dodatni kontakt moze biti "Nema"', async () => {
    const res = await request(app)
      .patch(`/api/children/${childId}`)
      .set('Authorization', `Bearer ${parentToken}`)
      .send({ extraContactPhone: 'Nema', pickupPersons: 'Samo roditelji' });

    expect(res.status).toBe(200);
    expect(res.body.child.extraContactPhone).toBe('Nema');
    expect(res.body.child.pickupPersons).toBe('Samo roditelji');
  });

  test('saglasnost mora biti da ili ne', async () => {
    const res = await request(app)
      .patch(`/api/children/${childId}`)
      .set('Authorization', `Bearer ${parentToken}`)
      .send({ photoConsent: 'mozda' });

    expect(res.status).toBe(400);
  });

  test('vraca 404 za nepostojece dete', async () => {
    const res = await request(app)
      .patch('/api/children/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${parentToken}`)
      .send({ firstName: 'Test' });

    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/children/:id', () => {
  test('roditelj ne moze da obrise tudje dete', async () => {
    const res = await request(app)
      .delete(`/api/children/${childId}`)
      .set('Authorization', `Bearer ${parent2Token}`);

    expect(res.status).toBe(403);
  });

  test('roditelj brise svoje dete (soft delete)', async () => {
    const res = await request(app)
      .delete(`/api/children/${childId}`)
      .set('Authorization', `Bearer ${parentToken}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('uklonjeno');

    // obrisano dete se ne pojavljuje u listi
    const listRes = await request(app)
      .get('/api/children')
      .set('Authorization', `Bearer ${parentToken}`);

    const ids = listRes.body.children.map((c) => c.id);
    expect(ids).not.toContain(childId);
  });

  test('vraca 404 za nepostojece dete', async () => {
    const res = await request(app)
      .delete('/api/children/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${parentToken}`);

    expect(res.status).toBe(404);
  });
});

// Roditelj istim QR kodom i prijavljuje i odjavljuje dete, pa mora da vidi u
// kom je stanju - inace ne zna sta ce sledece skeniranje uraditi.
describe('Stanje deteta u listi roditelja', () => {
  test('dete koje nije prijavljeno nema otvorenu posetu', async () => {
    const res = await request(app)
      .get('/api/children')
      .set('Authorization', `Bearer ${parentToken}`);

    expect(res.status).toBe(200);
    for (const dete of res.body.children) {
      expect(dete).toHaveProperty('activeVisit');
    }
  });

  test('prijavljeno dete nosi vreme dolaska', async () => {
    const napravljeno = await request(app)
      .post('/api/children')
      .set('Authorization', `Bearer ${parentToken}`)
      .send({ firstName: 'Stanje', lastName: 'Provera', dateOfBirth: '2021-01-01' });
    const dete = napravljeno.body.child;

    const pkg = await prisma.package.create({
      data: { name: 'Stanje 5h', totalHours: 5, validityDays: 30 },
    });
    await request(app)
      .post('/api/packages/assign')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userId: parentId, packageId: pkg.id });

    await request(app)
      .post('/api/visits/check-in')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ qrCode: dete.qrCode });

    const res = await request(app)
      .get('/api/children')
      .set('Authorization', `Bearer ${parentToken}`);
    const naslo = res.body.children.find((c) => c.id === dete.id);

    expect(naslo.activeVisit).not.toBeNull();
    expect(naslo.activeVisit.checkedInAt).toBeTruthy();

    await request(app)
      .post('/api/visits/check-out')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ qrCode: dete.qrCode });

    const posle = await request(app)
      .get('/api/children')
      .set('Authorization', `Bearer ${parentToken}`);
    expect(posle.body.children.find((c) => c.id === dete.id).activeVisit).toBeNull();
  });
});

describe('GET /api/children/all - filter po saglasnostima', () => {
  let saglasna;
  let bezSlikanja;
  let nepotpuna;

  beforeAll(async () => {
    const osnovno = {
      parentId,
      dateOfBirth: new Date('2021-05-05'),
      eatsLunch: true,
      eatsSnack: true,
      extraContactPhone: 'Nema',
      pickupPersons: 'Samo roditelji',
    };
    saglasna = await prisma.child.create({
      data: { ...osnovno, firstName: 'Filter', lastName: 'Sve', qrCode: 'FLT-SVE', photoConsent: true, walksConsent: true },
    });
    bezSlikanja = await prisma.child.create({
      data: { ...osnovno, firstName: 'Filter', lastName: 'BezSlika', qrCode: 'FLT-FOTO', photoConsent: false, walksConsent: true },
    });
    nepotpuna = await prisma.child.create({
      data: { ...osnovno, firstName: 'Filter', lastName: 'Fali', qrCode: 'FLT-FALI', photoConsent: true, walksConsent: null },
    });
  });

  const ids = (res) => res.body.children.map((c) => c.id);
  const trazi = (filter) =>
    request(app)
      .get(`/api/children/all?search=Filter&saglasnost=${filter}`)
      .set('Authorization', `Bearer ${adminToken}`);

  test('dete kome je roditelj rekao "ne" za slikanje', async () => {
    const res = await trazi('bez_slikanja');

    expect(res.status).toBe(200);
    expect(ids(res)).toEqual([bezSlikanja.id]);
  });

  test('deca bez odgovora na neku obaveznu saglasnost', async () => {
    const res = await trazi('nepotpuno');

    expect(ids(res)).toEqual([nepotpuna.id]);
  });

  test('prazan dodatni kontakt ili ovlascene osobe se racuna kao nepotpuno', async () => {
    const bezKontakta = await prisma.child.create({
      data: {
        parentId,
        dateOfBirth: new Date('2021-05-05'),
        firstName: 'Filter',
        lastName: 'BezKontakta',
        qrCode: 'FLT-KONT',
        photoConsent: true,
        eatsLunch: true,
        eatsSnack: true,
        walksConsent: true,
        extraContactPhone: null,
        pickupPersons: 'Samo roditelji',
      },
    });

    const res = await trazi('nepotpuno');

    expect(ids(res)).toEqual(expect.arrayContaining([nepotpuna.id, bezKontakta.id]));
    expect(ids(res)).not.toContain(saglasna.id);
    await prisma.child.delete({ where: { id: bezKontakta.id } });
  });

  test('nepoznat filter vraca sve', async () => {
    const res = await trazi('nesto');

    expect(ids(res)).toEqual(expect.arrayContaining([saglasna.id, bezSlikanja.id, nepotpuna.id]));
  });

  test('uz dete stizu i odgovori na saglasnosti', async () => {
    const res = await trazi('bez_slikanja');

    expect(res.body.children[0]).toMatchObject({ photoConsent: false, eatsLunch: true, walksConsent: true });
  });
});
