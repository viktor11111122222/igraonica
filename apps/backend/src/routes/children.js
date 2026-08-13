const express = require('express');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const prisma = require('../config/db');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

function generateQRCode() {
  const random = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `IGR-${random}`;
}

// GET /api/children - roditelj vidi svoju decu
router.get('/', async (req, res) => {
  try {
    const children = await prisma.child.findMany({
      where: { parentId: req.user.id, isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ children });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Greska na serveru.' });
  }
});

// GET /api/children/all - admin vidi svu decu
router.get('/all', authorize('ADMIN', 'SUPERADMIN'), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const search = req.query.search || '';

    const where = { isActive: true };
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { qrCode: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [children, total] = await Promise.all([
      prisma.child.findMany({
        where,
        include: {
          parent: {
            omit: { password: true },
            include: { userPackages: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.child.count({ where }),
    ]);

    // Osoblju je najvaznije da odmah vidi da li roditelj ima sati - bez toga
    // dete ne moze da se prijavi. Zato ide uz svako dete, a ne tek na
    // stranici roditelja.
    const now = new Date();
    const withHours = children.map((child) => {
      const remaining = child.parent.userPackages
        .filter((up) => up.isActive && new Date(up.expiresAt) > now)
        .reduce((sum, up) => sum + Number(up.remainingHours), 0);

      const { userPackages, ...parent } = child.parent;
      return {
        ...child,
        parent,
        parentRemainingHours: Math.round(remaining * 100) / 100,
      };
    });

    res.json({
      children: withHours,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Greska na serveru.' });
  }
});

// GET /api/children/:id - roditelj vidi detalje svog deteta, admin vidi bilo kog
router.get('/:id', async (req, res) => {
  try {
    const child = await prisma.child.findUnique({
      where: { id: req.params.id },
      include: {
        parent: { omit: { password: true } },
      },
    });

    if (!child) {
      return res.status(404).json({ message: 'Dete nije pronadjeno.' });
    }

    const isAdmin = req.user.role === 'ADMIN' || req.user.role === 'SUPERADMIN';
    if (!isAdmin && child.parentId !== req.user.id) {
      return res.status(403).json({ message: 'Nemate dozvolu za ovu akciju.' });
    }

    res.json({ child });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Greska na serveru.' });
  }
});

// POST /api/children - roditelj dodaje dete
router.post(
  '/',
  [
    body('firstName').notEmpty().withMessage('Ime je obavezno.'),
    body('lastName').notEmpty().withMessage('Prezime je obavezno.'),
    body('dateOfBirth').isISO8601().withMessage('Datum rodjenja nije validan.'),
    body('gender').optional().isIn(['MALE', 'FEMALE']).withMessage('Nevazeci pol.'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { firstName, lastName, dateOfBirth, gender, allergies, notes } = req.body;

      let parentId = req.user.id;

      // Admin moze da doda dete drugom roditelju
      const isAdmin = req.user.role === 'ADMIN' || req.user.role === 'SUPERADMIN';
      if (isAdmin && req.body.parentId) {
        const parent = await prisma.user.findUnique({ where: { id: req.body.parentId } });
        if (!parent) {
          return res.status(404).json({ message: 'Roditelj nije pronadjen.' });
        }
        parentId = req.body.parentId;
      }

      let qrCode = generateQRCode();
      // Osiguraj da je QR kod unikatan
      while (await prisma.child.findUnique({ where: { qrCode } })) {
        qrCode = generateQRCode();
      }

      const child = await prisma.child.create({
        data: {
          firstName,
          lastName,
          dateOfBirth: new Date(dateOfBirth),
          gender: gender || null,
          allergies: allergies || null,
          notes: notes || null,
          qrCode,
          parentId,
        },
      });

      res.status(201).json({ child });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Greska na serveru.' });
    }
  }
);

// PATCH /api/children/:id - roditelj azurira svoje dete, admin bilo kog
router.patch(
  '/:id',
  [
    body('firstName').optional().notEmpty().withMessage('Ime ne moze biti prazno.'),
    body('lastName').optional().notEmpty().withMessage('Prezime ne moze biti prazno.'),
    body('dateOfBirth').optional().isISO8601().withMessage('Datum rodjenja nije validan.'),
    body('gender').optional().isIn(['MALE', 'FEMALE']).withMessage('Nevazeci pol.'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const child = await prisma.child.findUnique({ where: { id: req.params.id } });
      if (!child) {
        return res.status(404).json({ message: 'Dete nije pronadjeno.' });
      }

      const isAdmin = req.user.role === 'ADMIN' || req.user.role === 'SUPERADMIN';
      if (!isAdmin && child.parentId !== req.user.id) {
        return res.status(403).json({ message: 'Nemate dozvolu za ovu akciju.' });
      }

      const allowedFields = ['firstName', 'lastName', 'dateOfBirth', 'gender', 'allergies', 'notes'];
      const data = {};
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          data[field] = field === 'dateOfBirth' ? new Date(req.body[field]) : req.body[field];
        }
      }

      const updated = await prisma.child.update({
        where: { id: req.params.id },
        data,
      });

      res.json({ child: updated });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Greska na serveru.' });
    }
  }
);

// DELETE /api/children/:id - soft delete
router.delete('/:id', async (req, res) => {
  try {
    const child = await prisma.child.findUnique({ where: { id: req.params.id } });
    if (!child) {
      return res.status(404).json({ message: 'Dete nije pronadjeno.' });
    }

    const isAdmin = req.user.role === 'ADMIN' || req.user.role === 'SUPERADMIN';
    if (!isAdmin && child.parentId !== req.user.id) {
      return res.status(403).json({ message: 'Nemate dozvolu za ovu akciju.' });
    }

    await prisma.child.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });

    res.json({ message: 'Dete je uklonjeno.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Greska na serveru.' });
  }
});

module.exports = router;
