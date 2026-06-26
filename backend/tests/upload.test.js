const request = require('supertest');
const path = require('path');
const fs = require('fs');
const app = require('../src/app');
const { cleanDB, createTestUser, disconnectDB, TEST_ADMIN, TEST_PARENT } = require('./setup');

let adminToken;
let parentToken;
let uploadedFilename;

const testImagePath = path.join(__dirname, 'test-image.png');
const testLargeFilePath = path.join(__dirname, 'test-large.png');
const testTextFilePath = path.join(__dirname, 'test-file.txt');
const uploadsDir = path.join(__dirname, '../uploads');

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

  // Kreiraj mali test PNG (1x1 pixel)
  const pngHeader = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG signature
    0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // 1x1
    0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde, // 8-bit RGB
    0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, 0x54, // IDAT chunk
    0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00, 0x00,
    0x00, 0x02, 0x00, 0x01, 0xe2, 0x21, 0xbc, 0x33,
    0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, // IEND chunk
    0xae, 0x42, 0x60, 0x82,
  ]);
  fs.writeFileSync(testImagePath, pngHeader);

  // Kreiraj tekst fajl (nedozvoljeni tip)
  fs.writeFileSync(testTextFilePath, 'ovo je tekst fajl');
});

afterAll(async () => {
  // Obrisi test fajlove
  if (fs.existsSync(testImagePath)) fs.unlinkSync(testImagePath);
  if (fs.existsSync(testLargeFilePath)) fs.unlinkSync(testLargeFilePath);
  if (fs.existsSync(testTextFilePath)) fs.unlinkSync(testTextFilePath);

  // Obrisi uploadovane fajlove iz testova
  if (uploadedFilename) {
    const uploaded = path.join(uploadsDir, uploadedFilename);
    if (fs.existsSync(uploaded)) fs.unlinkSync(uploaded);
  }

  await cleanDB();
  await disconnectDB();
});

describe('POST /api/upload/image', () => {
  test('admin uploaduje sliku', async () => {
    const res = await request(app)
      .post('/api/upload/image')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('image', testImagePath);

    expect(res.status).toBe(201);
    expect(res.body.url).toMatch(/^\/uploads\//);
    expect(res.body.filename).toBeDefined();
    expect(res.body.originalName).toBe('test-image.png');
    expect(res.body.size).toBeGreaterThan(0);
    expect(res.body.mimetype).toBe('image/png');
    uploadedFilename = res.body.filename;

    // Proveri da fajl postoji na disku
    const filePath = path.join(uploadsDir, res.body.filename);
    expect(fs.existsSync(filePath)).toBe(true);
  });

  test('uploadovana slika je dostupna preko URL-a', async () => {
    const res = await request(app).get(`/uploads/${uploadedFilename}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/image/);
  });

  test('odbija fajl koji nije slika', async () => {
    const res = await request(app)
      .post('/api/upload/image')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('image', testTextFilePath);

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('formati');
  });

  test('odbija request bez fajla', async () => {
    const res = await request(app)
      .post('/api/upload/image')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Slika je obavezna');
  });

  test('parent ne moze da uploaduje', async () => {
    const res = await request(app)
      .post('/api/upload/image')
      .set('Authorization', `Bearer ${parentToken}`)
      .attach('image', testImagePath);

    expect(res.status).toBe(403);
  });

  test('neprijavljen korisnik ne moze da uploaduje', async () => {
    const res = await request(app)
      .post('/api/upload/image')
      .attach('image', testImagePath);

    expect(res.status).toBe(401);
  });
});

describe('DELETE /api/upload/:filename', () => {
  let deleteFilename;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/upload/image')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('image', testImagePath);
    deleteFilename = res.body.filename;
  });

  test('admin brise uploadovanu sliku', async () => {
    const res = await request(app)
      .delete(`/api/upload/${deleteFilename}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('obrisan');

    // Proveri da fajl vise ne postoji
    const filePath = path.join(uploadsDir, deleteFilename);
    expect(fs.existsSync(filePath)).toBe(false);
  });

  test('vraca 404 za nepostojeci fajl', async () => {
    const res = await request(app)
      .delete('/api/upload/nepostoji.png')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });

  test('blokira path traversal napad', async () => {
    const res = await request(app)
      .delete('/api/upload/..%2F..%2Fpackage.json')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Nevazeci');
  });

  test('parent ne moze da brise fajlove', async () => {
    const res = await request(app)
      .delete(`/api/upload/${uploadedFilename}`)
      .set('Authorization', `Bearer ${parentToken}`);

    expect(res.status).toBe(403);
  });
});
