const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const prisma = require('../config/db');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(protect);
router.use(authorize('ADMIN', 'SUPERADMIN'));

// GET /api/users
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const search = req.query.search || '';
    const role = req.query.role;

    const where = {};
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (role) {
      where.role = role;
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        omit: { password: true },
      }),
      prisma.user.count({ where }),
    ]);

    res.json({
      users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Greska na serveru.' });
  }
});

// GET /api/users/:id
router.get('/:id', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      omit: { password: true },
      include: { children: true, userPackages: { include: { package: true } } },
    });

    if (!user) {
      return res.status(404).json({ message: 'Korisnik nije pronadjen.' });
    }

    res.json({ user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Greska na serveru.' });
  }
});

// POST /api/users
router.post(
  '/',
  [
    body('email').isEmail().withMessage('Unesite validan email.'),
    body('password').isLength({ min: 6 }).withMessage('Lozinka mora imati najmanje 6 karaktera.'),
    body('firstName').notEmpty().withMessage('Ime je obavezno.'),
    body('lastName').notEmpty().withMessage('Prezime je obavezno.'),
    body('role').optional().isIn(['PARENT', 'ADMIN']).withMessage('Nevazeca uloga.'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { email, password, firstName, lastName, phone, role } = req.body;

      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        return res.status(400).json({ message: 'Korisnik sa ovim emailom vec postoji.' });
      }

      const hashedPassword = await bcrypt.hash(password, 12);

      const user = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          firstName,
          lastName,
          phone,
          role: role || 'PARENT',
        },
      });

      const { password: _, ...userWithoutPassword } = user;
      res.status(201).json({ user: userWithoutPassword });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Greska na serveru.' });
    }
  }
);

// PATCH /api/users/:id
router.patch(
  '/:id',
  [
    body('firstName').optional().notEmpty().withMessage('Ime ne moze biti prazno.'),
    body('lastName').optional().notEmpty().withMessage('Prezime ne moze biti prazno.'),
    body('role').optional().isIn(['PARENT', 'ADMIN']).withMessage('Nevazeca uloga.'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const allowedFields = ['firstName', 'lastName', 'phone', 'role', 'isActive'];
      const data = {};
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          data[field] = req.body[field];
        }
      }

      const user = await prisma.user.update({
        where: { id: req.params.id },
        data,
      });

      const { password: _, ...userWithoutPassword } = user;
      res.json({ user: userWithoutPassword });
    } catch (err) {
      if (err.code === 'P2025') {
        return res.status(404).json({ message: 'Korisnik nije pronadjen.' });
      }
      console.error(err);
      res.status(500).json({ message: 'Greska na serveru.' });
    }
  }
);

// DELETE /api/users/:id - soft delete
router.delete('/:id', async (req, res) => {
  try {
    await prisma.user.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });

    res.json({ message: 'Korisnik je deaktiviran.' });
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ message: 'Korisnik nije pronadjen.' });
    }
    console.error(err);
    res.status(500).json({ message: 'Greska na serveru.' });
  }
});

module.exports = router;
