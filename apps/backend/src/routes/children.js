const express = require('express');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const prisma = require('../config/db');
const { stranicenje } = require('../utils/stranicenje');
const { protect, authorize } = require('../middleware/auth');
const obavestenja = require('../services/notifications');

const router = express.Router();

router.use(protect);

// Saglasnosti su da/ne ili `null` ("nije odgovoreno") - roditelj ih moze
// preskociti i dopuniti kasnije, a vratiti na "nije odgovoreno" ne mora.
const validacijaSaglasnosti = [
  ...['photoConsent', 'eatsLunch', 'eatsSnack', 'walksConsent'].map((polje) =>
    body(polje).optional({ values: 'null' }).isBoolean({ strict: true }).withMessage('Odgovor mora biti da ili ne.')
  ),
  body('pickupPersons')
    .optional({ values: 'null' })
    .isString()
    .isLength({ max: 500 })
    .withMessage('Spisak osoba koje preuzimaju dete je predugacak.'),
  // Broj telefona, ili rec kojom roditelj kaze da nema nikoga ("Nema").
  // Cim ima cifara, mora biti ispravan broj - "064 12" nije ni broj ni odgovor.
  body('extraContactPhone')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 100 })
    .custom((v) =>
      /\d/.test(v)
        ? /^\+?[\d\s\-/()]{6,20}$/.test(v) && v.replace(/\D/g, '').length >= 6
        : v.length >= 2
    )
    .withMessage('Dodatni kontakt: upisite ispravan broj telefona ili "Nema".'),
];

function generateQRCode() {
  const random = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `IGR-${random}`;
}

// GET /api/children - roditelj vidi svoju decu
router.get('/', async (req, res) => {
  try {
    const children = await prisma.child.findMany({
      where: { parentId: req.user.id, isActive: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: {
        // Otvorena poseta, ako je ima. Roditelj po istom QR kodu i prijavljuje i
        // odjavljuje dete, pa mora da vidi u kom je stanju - inace ne zna sta ce
        // sledece skeniranje uraditi.
        visits: {
          where: { status: 'CHECKED_IN' },
          select: { id: true, checkedInAt: true },
          take: 1,
        },
      },
    });

    res.json({
      children: children.map(({ visits, ...dete }) => ({
        ...dete,
        activeVisit: visits[0] || null,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Greska na serveru.' });
  }
});

// Filteri po saglasnostima za spisak dece u panelu. "Ne" je izricit odgovor
// roditelja (false), a "nije odgovoreno" je null - to su dve razlicite stvari.
const FILTERI_SAGLASNOSTI = {
  // Sve stavke su obavezne - i dodatni kontakt i ovlascene osobe.
  nepotpuno: {
    OR: [
      { photoConsent: null },
      { eatsLunch: null },
      { eatsSnack: null },
      { walksConsent: null },
      { extraContactPhone: null },
      { extraContactPhone: '' },
      { pickupPersons: null },
      { pickupPersons: '' },
    ],
  },
  bez_slikanja: { photoConsent: false },
  bez_rucka: { eatsLunch: false },
  bez_uzine: { eatsSnack: false },
  bez_setnje: { walksConsent: false },
};

// GET /api/children/all - admin vidi svu decu
// ?saglasnost=nepotpuno|bez_slikanja|bez_rucka|bez_uzine|bez_setnje
router.get('/all', authorize('ADMIN', 'SUPERADMIN'), async (req, res) => {
  try {
    const { page, limit, skip } = stranicenje(req.query, 20);
    const search = req.query.search || '';

    const where = { isActive: true };
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { qrCode: { contains: search, mode: 'insensitive' } },
      ];
    }
    // Filter po saglasnostima: osoblje trazi decu koja nesto ne smeju, ili
    // ciji roditelj jos nije odgovorio. Nepoznat filter se ignorise.
    const filter = FILTERI_SAGLASNOSTI[req.query.saglasnost];
    if (filter) where.AND = [filter];

    const [children, total] = await Promise.all([
      prisma.child.findMany({
        where,
        include: {
          parent: {
            omit: { password: true },
            include: { userPackages: true },
          },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
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
    body('gender').optional({ values: 'null' }).isIn(['MALE', 'FEMALE']).withMessage('Nevazeci pol.'),
    ...validacijaSaglasnosti,
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { firstName, lastName, dateOfBirth, gender, allergies, notes } = req.body;
      const { photoConsent, eatsLunch, eatsSnack, walksConsent, pickupPersons, extraContactPhone } =
        req.body;

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
          photoConsent: photoConsent ?? null,
          eatsLunch: eatsLunch ?? null,
          eatsSnack: eatsSnack ?? null,
          walksConsent: walksConsent ?? null,
          pickupPersons: pickupPersons || null,
          extraContactPhone: extraContactPhone || null,
          qrCode,
          parentId,
        },
      });

      // Roditelj dodaje dete iz aplikacije; osoblju treba da zna da je stigao
      // nov QR kod.
      await obavestenja.deteDodato({ child, parent: req.user });

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
    body('gender').optional({ values: 'null' }).isIn(['MALE', 'FEMALE']).withMessage('Nevazeci pol.'),
    ...validacijaSaglasnosti,
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

      const allowedFields = [
        'firstName',
        'lastName',
        'dateOfBirth',
        'gender',
        'allergies',
        'notes',
        'photoConsent',
        'eatsLunch',
        'eatsSnack',
        'walksConsent',
        'pickupPersons',
        'extraContactPhone',
      ];
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

    // Osoblju je vazno jer taj QR kod od sada nece raditi na recepciji.
    await obavestenja.deteUklonjeno({ child, byUserId: req.user.id });

    res.json({ message: 'Dete je uklonjeno.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Greska na serveru.' });
  }
});

module.exports = router;
