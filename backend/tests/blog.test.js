const request = require('supertest');
const app = require('../src/app');
const { prisma, cleanDB, createTestUser, disconnectDB, TEST_ADMIN, TEST_PARENT } = require('./setup');

let adminToken;
let parentToken;
let postId;
let postSlug;
let draftId;

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

describe('POST /api/blog', () => {
  test('admin kreira objavljeni post', async () => {
    const res = await request(app)
      .post('/api/blog')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Dobrodosli u Kids Club!',
        content: '<p>Otvorili smo novu igraonicu.</p>',
        excerpt: 'Otvorili smo novu igraonicu.',
        isPublished: true,
        isFeatured: true,
      });

    expect(res.status).toBe(201);
    expect(res.body.post.title).toBe('Dobrodosli u Kids Club!');
    expect(res.body.post.slug).toBe('dobrodosli-u-kids-club');
    expect(res.body.post.isPublished).toBe(true);
    expect(res.body.post.isFeatured).toBe(true);
    expect(res.body.post.publishedAt).toBeDefined();
    expect(res.body.post.author).toBeDefined();
    expect(res.body.post.author.password).toBeUndefined();
    postId = res.body.post.id;
    postSlug = res.body.post.slug;
  });

  test('admin kreira draft (neobjavljeni post)', async () => {
    const res = await request(app)
      .post('/api/blog')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Uskoro novi program',
        content: '<p>Radimo na novom programu.</p>',
      });

    expect(res.status).toBe(201);
    expect(res.body.post.isPublished).toBe(false);
    expect(res.body.post.publishedAt).toBeNull();
    draftId = res.body.post.id;
  });

  test('generise unikatan slug za iste naslove', async () => {
    const res = await request(app)
      .post('/api/blog')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Dobrodosli u Kids Club!',
        content: 'Drugi post sa istim naslovom.',
        isPublished: true,
      });

    expect(res.status).toBe(201);
    expect(res.body.post.slug).toBe('dobrodosli-u-kids-club-1');
  });

  test('slug ispravno konvertuje srpska slova', async () => {
    const res = await request(app)
      .post('/api/blog')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Čestitamo svima živ bio!',
        content: 'Test srpskih slova.',
        isPublished: true,
      });

    expect(res.status).toBe(201);
    expect(res.body.post.slug).toBe('cestitamo-svima-ziv-bio');
  });

  test('validira obavezna polja', async () => {
    const res = await request(app)
      .post('/api/blog')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Samo naslov' });

    expect(res.status).toBe(400);
    expect(res.body.errors).toBeDefined();
  });

  test('parent ne moze da kreira post', async () => {
    const res = await request(app)
      .post('/api/blog')
      .set('Authorization', `Bearer ${parentToken}`)
      .send({ title: 'Hack', content: 'Hack' });

    expect(res.status).toBe(403);
  });
});

describe('GET /api/blog', () => {
  test('javno lista objavljene postove', async () => {
    const res = await request(app).get('/api/blog');

    expect(res.status).toBe(200);
    expect(res.body.posts.length).toBeGreaterThanOrEqual(1);
    expect(res.body.pagination).toBeDefined();

    // svi su objavljeni
    res.body.posts.forEach((p) => {
      expect(p.isPublished).toBe(true);
      expect(p.author).toBeDefined();
      expect(p.author.password).toBeUndefined();
    });
  });

  test('ne prikazuje neobjavljene postove', async () => {
    const res = await request(app).get('/api/blog');

    const ids = res.body.posts.map((p) => p.id);
    expect(ids).not.toContain(draftId);
  });

  test('paginacija radi', async () => {
    const res = await request(app).get('/api/blog?page=1&limit=1');

    expect(res.status).toBe(200);
    expect(res.body.posts.length).toBe(1);
    expect(res.body.pagination.pages).toBeGreaterThanOrEqual(2);
  });

  test('sortira po datumu objavljivanja (najnoviji prvi)', async () => {
    const res = await request(app).get('/api/blog');

    for (let i = 1; i < res.body.posts.length; i++) {
      const prev = new Date(res.body.posts[i - 1].publishedAt);
      const curr = new Date(res.body.posts[i].publishedAt);
      expect(prev.getTime()).toBeGreaterThanOrEqual(curr.getTime());
    }
  });
});

describe('GET /api/blog/featured', () => {
  test('vraca featured postove', async () => {
    const res = await request(app).get('/api/blog/featured');

    expect(res.status).toBe(200);
    expect(res.body.posts.length).toBeGreaterThanOrEqual(1);
    res.body.posts.forEach((p) => {
      expect(p.isFeatured).toBe(true);
      expect(p.isPublished).toBe(true);
    });
  });
});

describe('GET /api/blog/all (admin)', () => {
  test('admin vidi sve postove ukljucujuci draftove', async () => {
    const res = await request(app)
      .get('/api/blog/all')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const ids = res.body.posts.map((p) => p.id);
    expect(ids).toContain(draftId);
  });

  test('parent ne moze da vidi admin listu', async () => {
    const res = await request(app)
      .get('/api/blog/all')
      .set('Authorization', `Bearer ${parentToken}`);

    expect(res.status).toBe(403);
  });
});

describe('GET /api/blog/:slug', () => {
  test('javno cita post po slug-u', async () => {
    const res = await request(app).get(`/api/blog/${postSlug}`);

    expect(res.status).toBe(200);
    expect(res.body.post.slug).toBe(postSlug);
    expect(res.body.post.title).toBe('Dobrodosli u Kids Club!');
    expect(res.body.post.author).toBeDefined();
  });

  test('neobjavljeni post vraca 404 za javnost', async () => {
    const draft = await prisma.blogPost.findUnique({ where: { id: draftId } });

    const res = await request(app).get(`/api/blog/${draft.slug}`);

    expect(res.status).toBe(404);
  });

  test('vraca 404 za nepostojeci slug', async () => {
    const res = await request(app).get('/api/blog/nepostojeci-slug');

    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/blog/:id', () => {
  test('admin azurira post', async () => {
    const res = await request(app)
      .patch(`/api/blog/${postId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ content: '<p>Azuriran sadrzaj.</p>', excerpt: 'Azurirano.' });

    expect(res.status).toBe(200);
    expect(res.body.post.content).toBe('<p>Azuriran sadrzaj.</p>');
    expect(res.body.post.excerpt).toBe('Azurirano.');
    // slug ostaje isti jer se title nije menjao
    expect(res.body.post.slug).toBe(postSlug);
  });

  test('admin menja naslov i slug se azurira', async () => {
    const res = await request(app)
      .patch(`/api/blog/${postId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Novi naslov posta' });

    expect(res.status).toBe(200);
    expect(res.body.post.title).toBe('Novi naslov posta');
    expect(res.body.post.slug).toBe('novi-naslov-posta');
    postSlug = res.body.post.slug;
  });

  test('admin objavljuje draft', async () => {
    const res = await request(app)
      .patch(`/api/blog/${draftId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isPublished: true });

    expect(res.status).toBe(200);
    expect(res.body.post.isPublished).toBe(true);
    expect(res.body.post.publishedAt).toBeDefined();
  });

  test('vraca 404 za nepostojeci id', async () => {
    const res = await request(app)
      .patch('/api/blog/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Test' });

    expect(res.status).toBe(404);
  });

  test('parent ne moze da azurira post', async () => {
    const res = await request(app)
      .patch(`/api/blog/${postId}`)
      .set('Authorization', `Bearer ${parentToken}`)
      .send({ title: 'Hack' });

    expect(res.status).toBe(403);
  });
});

describe('DELETE /api/blog/:id', () => {
  let deletePostId;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/blog')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Za brisanje', content: 'Brise se.' });
    deletePostId = res.body.post.id;
  });

  test('admin brise post', async () => {
    const res = await request(app)
      .delete(`/api/blog/${deletePostId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('obrisan');
  });

  test('vraca 404 za nepostojeci id', async () => {
    const res = await request(app)
      .delete('/api/blog/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });

  test('parent ne moze da brise post', async () => {
    const res = await request(app)
      .delete(`/api/blog/${postId}`)
      .set('Authorization', `Bearer ${parentToken}`);

    expect(res.status).toBe(403);
  });
});
