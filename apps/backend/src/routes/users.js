const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const prisma = require('../config/db');
const { stranicenje } = require('../utils/stranicenje');
const { protect, authorize } = require('../middleware/auth');
const obavestenja = require('../services/notifications');
const { normalizujEmail, poEmailu } = require('../utils/email');

const router = express.Router();

router.use(protect);
router.use(authorize('ADMIN', 'SUPERADMIN'));

// Ko sme sta nad tudjim nalogom.
//
// Obican admin je mogao da spusti superadmina na PARENT ili da ga iskljuci -
// dovoljno da igraonica ostane bez vlasnika naloga. I sam sebe je mogao da
// iskljuci, pa da se zakljuca napolju.
function nesmeDaMenja(kojiAdmin, cilj, izmene) {
  const diraSuperadmina = cilj.role === 'SUPERADMIN';
  if (diraSuperadmina && kojiAdmin.role !== 'SUPERADMIN') {
    return 'Nalog superadmina moze da menja samo superadmin.';
  }

  const sebe = cilj.id === kojiAdmin.id;
  if (sebe && izmene.isActive === false) {
    return 'Ne mozete iskljuciti sopstveni nalog.';
  }
  if (sebe && izmene.role !== undefined && izmene.role !== kojiAdmin.role) {
    return 'Ne mozete sami sebi promeniti ulogu.';
  }

  return null;
}

// GET /api/users
router.get('/', async (req, res) => {
  try {
    const { page, limit, skip } = stranicenje(req.query, 20);
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
    body('email').trim().isEmail().withMessage('Unesite validan email.'),
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
      const { password, firstName, lastName, phone, role } = req.body;
      const email = normalizujEmail(req.body.email);

      const existingUser = await prisma.user.findFirst({ where: poEmailu(email) });
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
      const cilj = await prisma.user.findUnique({ where: { id: req.params.id } });
      if (!cilj) {
        return res.status(404).json({ message: 'Korisnik nije pronadjen.' });
      }

      const zabrana = nesmeDaMenja(req.user, cilj, req.body);
      if (zabrana) {
        return res.status(403).json({ message: zabrana });
      }

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

// POST /api/users/:id/settle-debt - roditelj je platio minus sate
//
// Naplata se desava na pultu, van aplikacije; panel samo evidentira da je
// dug izmiren. Minus se ponistava ceo, jer se i placa ceo.
router.post('/:id/settle-debt', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) {
      return res.status(404).json({ message: 'Korisnik nije pronadjen.' });
    }

    const dug = Number(user.debtHours);
    if (dug <= 0) {
      return res.status(400).json({ message: 'Roditelj nema minus sate.' });
    }

    // Uslov na iznos: ako je u medjuvremenu druga odjava dodala sate, ovaj
    // zahtev nista ne menja i radnik vidi tacan, novi iznos.
    const ponisteno = await prisma.user.updateMany({
      where: { id: req.params.id, debtHours: user.debtHours },
      data: { debtHours: 0 },
    });

    if (ponisteno.count === 0) {
      const sada = await prisma.user.findUnique({ where: { id: req.params.id } });
      return res.status(409).json({
        message: 'Minus sati su se promenili u medjuvremenu, proverite iznos.',
        debtHours: sada ? Number(sada.debtHours) : 0,
      });
    }

    // Roditelju minus nestaje sa naloga; bez ovoga bi brojka samo pala na nulu.
    await obavestenja.minusNaplacen({ parentId: req.params.id, hours: dug });

    res.json({ message: `Naplaceno ${dug} h minusa.`, settledHours: dug, debtHours: 0 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Greska na serveru.' });
  }
});

// DELETE /api/users/:id - soft delete
router.delete('/:id', async (req, res) => {
  try {
    const cilj = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!cilj) {
      return res.status(404).json({ message: 'Korisnik nije pronadjen.' });
    }

    const zabrana = nesmeDaMenja(req.user, cilj, { isActive: false });
    if (zabrana) {
      return res.status(403).json({ message: zabrana });
    }

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
