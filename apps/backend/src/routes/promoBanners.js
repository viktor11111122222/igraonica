const express = require('express');
const { body, validationResult } = require('express-validator');
const prisma = require('../config/db');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

const izlaz = (row) => ({
  id: row.id,
  title: row.title,
  description: row.description,
  imageUrl: row.imageUrl,
  showPopup: row.showPopup,
  isActive: row.isActive,
  createdAt: row.createdAt,
});

// Zajednicka pravila za unos i izmenu. Kod izmene su sva polja opcionalna, pa
// se ista lista pravi dvaput sa razlicitom zastavicom.
function pravila(izmena) {
  const mozeDaFali = (lanac) => (izmena ? lanac.optional() : lanac);

  return [
    mozeDaFali(body('title').trim().notEmpty().withMessage('Naslov je obavezan.')),
    body('description').optional({ nullable: true }).isString(),
    body('imageUrl').optional({ nullable: true }).isString(),
    body('showPopup').optional().isBoolean(),
    body('isActive').optional().isBoolean(),
  ];
}

// GET /api/promo-banners - javno, promocije koje su trenutno ukljucene.
//
// Aplikacija ovo cita bez prijave: baner je reklama, ne licni podatak. Nema
// roka vazenja - promocija stoji dok je osoblje ne iskljuci ili obrise.
router.get('/', async (req, res) => {
  try {
    const rows = await prisma.promoBanner.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ promoBanners: rows.map(izlaz) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Greska na serveru.' });
  }
});

// GET /api/promo-banners/all - admin vidi i istekle i iskljucene.
router.get('/all', protect, authorize('ADMIN', 'SUPERADMIN'), async (req, res) => {
  try {
    const rows = await prisma.promoBanner.findMany({ orderBy: { createdAt: 'desc' } });
    res.json({ promoBanners: rows.map(izlaz) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Greska na serveru.' });
  }
});

// POST /api/promo-banners - admin pravi promociju.
router.post('/', protect, authorize('ADMIN', 'SUPERADMIN'), pravila(false), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const row = await prisma.promoBanner.create({
      data: {
        title: req.body.title.trim(),
        description: req.body.description?.trim() || null,
        imageUrl: req.body.imageUrl?.trim() || null,
        showPopup: req.body.showPopup ?? true,
        isActive: req.body.isActive ?? true,
      },
    });

    res.status(201).json({ promoBanner: izlaz(row) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Greska na serveru.' });
  }
});

// PATCH /api/promo-banners/:id - admin menja promociju ili je ukljucuje/iskljucuje.
router.patch('/:id', protect, authorize('ADMIN', 'SUPERADMIN'), pravila(true), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const postojeca = await prisma.promoBanner.findUnique({ where: { id: req.params.id } });
    if (!postojeca) {
      return res.status(404).json({ message: 'Promocija nije pronadjena.' });
    }

    const data = {};
    if (req.body.title !== undefined) data.title = req.body.title.trim();
    if (req.body.description !== undefined) data.description = req.body.description?.trim() || null;
    if (req.body.imageUrl !== undefined) data.imageUrl = req.body.imageUrl?.trim() || null;
    if (req.body.showPopup !== undefined) data.showPopup = req.body.showPopup;
    if (req.body.isActive !== undefined) data.isActive = req.body.isActive;

    const row = await prisma.promoBanner.update({ where: { id: req.params.id }, data });
    res.json({ promoBanner: izlaz(row) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Greska na serveru.' });
  }
});

// DELETE /api/promo-banners/:id - admin brise promociju.
router.delete('/:id', protect, authorize('ADMIN', 'SUPERADMIN'), async (req, res) => {
  try {
    await prisma.promoBanner.delete({ where: { id: req.params.id } });
    res.json({ message: 'Promocija je obrisana.' });
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ message: 'Promocija nije pronadjena.' });
    }
    console.error(err);
    res.status(500).json({ message: 'Greska na serveru.' });
  }
});

module.exports = router;
