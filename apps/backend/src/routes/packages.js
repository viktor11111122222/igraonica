const express = require('express');
const { body, validationResult } = require('express-validator');
const prisma = require('../config/db');
const { protect, authorize } = require('../middleware/auth');
const obavestenja = require('../services/notifications');

const router = express.Router();

// ==================== TEMPLATE PAKETI (admin CRUD) ====================

// GET /api/packages - svi vide dostupne pakete
router.get('/', async (req, res) => {
  try {
    const packages = await prisma.package.findMany({
      where: { isActive: true },
      orderBy: { totalHours: 'asc' },
    });

    res.json({ packages });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Greska na serveru.' });
  }
});

// POST /api/packages - admin kreira paket
router.post(
  '/',
  protect,
  authorize('ADMIN', 'SUPERADMIN'),
  [
    body('name').notEmpty().withMessage('Naziv paketa je obavezan.'),
    body('totalHours').isFloat({ gt: 0 }).withMessage('Ukupan broj sati mora biti veci od 0.'),
    body('validityDays').isInt({ gt: 0 }).withMessage('Broj dana vazenja mora biti veci od 0.'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { name, description, totalHours, validityDays } = req.body;

      const pkg = await prisma.package.create({
        data: { name, description, totalHours, validityDays },
      });

      res.status(201).json({ package: pkg });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Greska na serveru.' });
    }
  }
);

// PATCH /api/packages/:id - admin azurira paket
router.patch(
  '/:id',
  protect,
  authorize('ADMIN', 'SUPERADMIN'),
  [
    body('name').optional().notEmpty().withMessage('Naziv ne moze biti prazan.'),
    body('totalHours').optional().isFloat({ gt: 0 }).withMessage('Sati moraju biti veci od 0.'),
    body('validityDays').optional().isInt({ gt: 0 }).withMessage('Dani moraju biti veci od 0.'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const allowedFields = ['name', 'description', 'totalHours', 'validityDays', 'isActive'];
      const data = {};
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          data[field] = req.body[field];
        }
      }

      const pkg = await prisma.package.update({
        where: { id: req.params.id },
        data,
      });

      res.json({ package: pkg });
    } catch (err) {
      if (err.code === 'P2025') {
        return res.status(404).json({ message: 'Paket nije pronadjen.' });
      }
      console.error(err);
      res.status(500).json({ message: 'Greska na serveru.' });
    }
  }
);

// DELETE /api/packages/:id - admin deaktivira paket
router.delete(
  '/:id',
  protect,
  authorize('ADMIN', 'SUPERADMIN'),
  async (req, res) => {
    try {
      await prisma.package.update({
        where: { id: req.params.id },
        data: { isActive: false },
      });

      res.json({ message: 'Paket je deaktiviran.' });
    } catch (err) {
      if (err.code === 'P2025') {
        return res.status(404).json({ message: 'Paket nije pronadjen.' });
      }
      console.error(err);
      res.status(500).json({ message: 'Greska na serveru.' });
    }
  }
);

// ==================== DODELJENI PAKETI (user packages) ====================

// POST /api/packages/assign - admin dodeljuje paket korisniku
router.post(
  '/assign',
  protect,
  authorize('ADMIN', 'SUPERADMIN'),
  [
    body('userId').notEmpty().withMessage('ID korisnika je obavezan.'),
    body('packageId').notEmpty().withMessage('ID paketa je obavezan.'),
    body('notes').optional(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { userId, packageId, notes } = req.body;

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        return res.status(404).json({ message: 'Korisnik nije pronadjen.' });
      }

      const pkg = await prisma.package.findUnique({ where: { id: packageId } });
      if (!pkg || !pkg.isActive) {
        return res.status(404).json({ message: 'Paket nije pronadjen ili nije aktivan.' });
      }

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + pkg.validityDays);

      // Nov paket prvo pokriva minus sate - odigrano pa placeno kroz paket.
      // `totalHours` pri tom ostaje pun iznos, da "iskorisceno = ukupno -
      // preostalo" i dalje govori istinu.
      const dug = Number(user.debtHours);
      const pokrivenDug = Math.min(Math.max(0, dug), Number(pkg.totalHours));

      // `totalHours` se snima ovde i ostaje nepromenjen do kraja - kasnija
      // izmena paketa ne sme unazad da promeni racunicu ovog roditelja.
      const userPackage = await prisma.$transaction(async (tx) => {
        const napravljen = await tx.userPackage.create({
          data: {
            userId,
            packageId,
            totalHours: pkg.totalHours,
            remainingHours: Number(pkg.totalHours) - pokrivenDug,
            expiresAt,
            notes,
          },
          include: { package: true },
        });

        if (pokrivenDug > 0) {
          // Racunica u bazi, ne "procitaj pa upisi": odjava koja se desi u
          // istom trenutku dodaje u minus, i to ne sme da se izgubi.
          await tx.$executeRaw`
            UPDATE users
               SET debt_hours = GREATEST(0, debt_hours - ${pokrivenDug}::numeric),
                   updated_at = NOW()
             WHERE id = ${userId}
          `;
        }

        return napravljen;
      });

      // Roditelj bi inace saznao za paket tek kad sam otvori aplikaciju.
      await obavestenja.paketDodeljen({ userPackage, paket: pkg, parentId: userId, pokrivenDug });

      res.status(201).json({ userPackage, settledDebtHours: pokrivenDug });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Greska na serveru.' });
    }
  }
);

// GET /api/packages/my - roditelj vidi svoje pakete
router.get('/my', protect, async (req, res) => {
  try {
    const [userPackages, korisnik] = await Promise.all([
      prisma.userPackage.findMany({
        where: { userId: req.user.id },
        include: { package: true },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.findUnique({ where: { id: req.user.id }, select: { debtHours: true } }),
    ]);

    // Minus sati stoje uz pakete: aplikacija ih prikazuje na istom mestu gde i
    // preostale sate, pa nema potrebe za drugim zahtevom.
    res.json({ userPackages, debtHours: Number(korisnik?.debtHours || 0) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Greska na serveru.' });
  }
});

// GET /api/packages/user/:userId - admin vidi pakete korisnika
router.get(
  '/user/:userId',
  protect,
  authorize('ADMIN', 'SUPERADMIN'),
  async (req, res) => {
    try {
      const user = await prisma.user.findUnique({ where: { id: req.params.userId } });
      if (!user) {
        return res.status(404).json({ message: 'Korisnik nije pronadjen.' });
      }

      const userPackages = await prisma.userPackage.findMany({
        where: { userId: req.params.userId },
        include: { package: true },
        orderBy: { createdAt: 'desc' },
      });

      res.json({ userPackages });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Greska na serveru.' });
    }
  }
);

// ==================== HOUR ADJUSTMENTS ====================

// POST /api/packages/:userPackageId/adjust-hours - admin rucno menja sate
router.post(
  '/:userPackageId/adjust-hours',
  protect,
  authorize('ADMIN', 'SUPERADMIN'),
  [
    body('hours').isFloat().withMessage('Broj sati je obavezan (pozitivan za dodavanje, negativan za oduzimanje).'),
    body('reason').optional(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { hours, reason } = req.body;

      const userPackage = await prisma.userPackage.findUnique({
        where: { id: req.params.userPackageId },
      });

      if (!userPackage) {
        return res.status(404).json({ message: 'Korisnicki paket nije pronadjen.' });
      }

      const hoursBefore = Number(userPackage.remainingHours);
      const hoursAfter = Math.max(0, hoursBefore + hours);

      // Rucnim dodavanjem preostalo moze da predje ukupno. Tada se podize i
      // ukupno, da "iskorisceno = ukupno - preostalo" nikad ne bude negativno.
      const totalHours = Math.max(Number(userPackage.totalHours), hoursAfter);

      const [updated, adjustment] = await prisma.$transaction([
        prisma.userPackage.update({
          where: { id: req.params.userPackageId },
          data: { remainingHours: hoursAfter, totalHours },
          include: { package: true },
        }),
        prisma.hourAdjustment.create({
          data: {
            userPackageId: req.params.userPackageId,
            adjustedById: req.user.id,
            hoursBefore,
            hoursAfter,
            reason,
          },
        }),
      ]);

      await obavestenja.satiIspravljeni({
        userPackage: updated,
        hours: Number(hours),
        reason,
        parentId: userPackage.userId,
      });

      res.json({ userPackage: updated, adjustment });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Greska na serveru.' });
    }
  }
);

// GET /api/packages/:userPackageId/adjustments - admin vidi istoriju promena sati
router.get(
  '/:userPackageId/adjustments',
  protect,
  authorize('ADMIN', 'SUPERADMIN'),
  async (req, res) => {
    try {
      const userPackage = await prisma.userPackage.findUnique({
        where: { id: req.params.userPackageId },
      });

      if (!userPackage) {
        return res.status(404).json({ message: 'Korisnicki paket nije pronadjen.' });
      }

      const adjustments = await prisma.hourAdjustment.findMany({
        where: { userPackageId: req.params.userPackageId },
        include: {
          adjustedBy: { omit: { password: true } },
        },
        orderBy: { createdAt: 'desc' },
      });

      res.json({ adjustments });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Greska na serveru.' });
    }
  }
);

module.exports = router;
