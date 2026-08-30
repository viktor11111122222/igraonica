const express = require('express');
const { body, validationResult } = require('express-validator');
const prisma = require('../config/db');
const { stranicenje } = require('../utils/stranicenje');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

function generateSlug(title) {
  return title
    .toLowerCase()
    .replace(/[čć]/g, 'c')
    .replace(/[š]/g, 's')
    .replace(/[ž]/g, 'z')
    .replace(/[đ]/g, 'dj')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

// GET /api/blog - javno, lista objavljenih postova
router.get('/', async (req, res) => {
  try {
    const { page, limit, skip } = stranicenje(req.query, 10);

    const where = { isPublished: true };

    const [posts, total] = await Promise.all([
      prisma.blogPost.findMany({
        where,
        include: { author: { omit: { password: true } } },
        orderBy: { publishedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.blogPost.count({ where }),
    ]);

    res.json({
      posts,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Greska na serveru.' });
  }
});

// GET /api/blog/featured - javno, featured postovi za home page banner
router.get('/featured', async (req, res) => {
  try {
    const posts = await prisma.blogPost.findMany({
      where: { isPublished: true, isFeatured: true },
      include: { author: { omit: { password: true } } },
      orderBy: { publishedAt: 'desc' },
      take: 5,
    });

    res.json({ posts });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Greska na serveru.' });
  }
});

// GET /api/blog/all - admin vidi sve postove (i neobjavljene)
router.get(
  '/all',
  protect,
  authorize('ADMIN', 'SUPERADMIN'),
  async (req, res) => {
    try {
      const { page, limit, skip } = stranicenje(req.query, 20);

      const [posts, total] = await Promise.all([
        prisma.blogPost.findMany({
          include: { author: { omit: { password: true } } },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        prisma.blogPost.count(),
      ]);

      res.json({
        posts,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Greska na serveru.' });
    }
  }
);

// GET /api/blog/:slug - javno, jedan post po slug-u
router.get('/:slug', async (req, res) => {
  try {
    const post = await prisma.blogPost.findUnique({
      where: { slug: req.params.slug },
      include: { author: { omit: { password: true } } },
    });

    if (!post) {
      return res.status(404).json({ message: 'Post nije pronadjen.' });
    }

    // Neobjavljeni postovi su vidljivi samo adminima
    if (!post.isPublished) {
      return res.status(404).json({ message: 'Post nije pronadjen.' });
    }

    res.json({ post });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Greska na serveru.' });
  }
});

// POST /api/blog - admin kreira post
router.post(
  '/',
  protect,
  authorize('ADMIN', 'SUPERADMIN'),
  [
    body('title').notEmpty().withMessage('Naslov je obavezan.'),
    body('content').notEmpty().withMessage('Sadrzaj je obavezan.'),
    body('isPublished').optional().isBoolean(),
    body('isFeatured').optional().isBoolean(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { title, content, excerpt, coverImageUrl, isPublished, isFeatured } = req.body;

      let slug = generateSlug(title);

      // Osiguraj unikatan slug
      let existing = await prisma.blogPost.findUnique({ where: { slug } });
      let counter = 1;
      while (existing) {
        slug = `${generateSlug(title)}-${counter}`;
        existing = await prisma.blogPost.findUnique({ where: { slug } });
        counter++;
      }

      const post = await prisma.blogPost.create({
        data: {
          title,
          slug,
          content,
          excerpt: excerpt || null,
          coverImageUrl: coverImageUrl || null,
          authorId: req.user.id,
          isPublished: isPublished || false,
          isFeatured: isFeatured || false,
          publishedAt: isPublished ? new Date() : null,
        },
        include: { author: { omit: { password: true } } },
      });

      res.status(201).json({ post });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Greska na serveru.' });
    }
  }
);

// PATCH /api/blog/:id - admin azurira post
router.patch(
  '/:id',
  protect,
  authorize('ADMIN', 'SUPERADMIN'),
  [
    body('title').optional().notEmpty().withMessage('Naslov ne moze biti prazan.'),
    body('content').optional().notEmpty().withMessage('Sadrzaj ne moze biti prazan.'),
    body('isPublished').optional().isBoolean(),
    body('isFeatured').optional().isBoolean(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const post = await prisma.blogPost.findUnique({ where: { id: req.params.id } });
      if (!post) {
        return res.status(404).json({ message: 'Post nije pronadjen.' });
      }

      const allowedFields = ['title', 'content', 'excerpt', 'coverImageUrl', 'isPublished', 'isFeatured'];
      const data = {};
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          data[field] = req.body[field];
        }
      }

      // Ako se menja title, generiši novi slug
      if (data.title && data.title !== post.title) {
        let slug = generateSlug(data.title);
        let existing = await prisma.blogPost.findUnique({ where: { slug } });
        let counter = 1;
        while (existing && existing.id !== post.id) {
          slug = `${generateSlug(data.title)}-${counter}`;
          existing = await prisma.blogPost.findUnique({ where: { slug } });
          counter++;
        }
        data.slug = slug;
      }

      // Ako se post prvi put objavljuje, postavi publishedAt
      if (data.isPublished === true && !post.isPublished) {
        data.publishedAt = new Date();
      }

      const updated = await prisma.blogPost.update({
        where: { id: req.params.id },
        data,
        include: { author: { omit: { password: true } } },
      });

      res.json({ post: updated });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Greska na serveru.' });
    }
  }
);

// DELETE /api/blog/:id - admin brise post
router.delete(
  '/:id',
  protect,
  authorize('ADMIN', 'SUPERADMIN'),
  async (req, res) => {
    try {
      await prisma.blogPost.delete({ where: { id: req.params.id } });

      res.json({ message: 'Post je obrisan.' });
    } catch (err) {
      if (err.code === 'P2025') {
        return res.status(404).json({ message: 'Post nije pronadjen.' });
      }
      console.error(err);
      res.status(500).json({ message: 'Greska na serveru.' });
    }
  }
);

module.exports = router;
