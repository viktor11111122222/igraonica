const express = require('express');
const { body, validationResult } = require('express-validator');
const prisma = require('../config/db');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// Datumi se drze na UTC ponoci, isto kao u menu.js i closedDays.js. Kolona je
// @db.Date, pa bi lokalna ponoc istocno od Grinica pala na prethodni dan.
function toUtcDate(key) {
  return new Date(`${key}T00:00:00.000Z`);
}

function toKey(date) {
  return new Date(date).toISOString().split('T')[0];
}

function danas() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

// Decimal iz Prisme je objekat; aplikacija ocekuje broj. TEXT akcije nemaju
// vrednost, pa tu ostaje null.
const izlaz = (row) => ({
  id: row.id,
  title: row.title,
  description: row.description,
  discountType: row.discountType,
  discountValue: row.discountValue === null ? null : Number(row.discountValue),
  dateFrom: toKey(row.dateFrom),
  dateTo: toKey(row.dateTo),
  isActive: row.isActive,
});

const DATUM = /^\d{4}-\d{2}-\d{2}$/;

// Zajednicka pravila za unos i izmenu. Kod izmene su sva polja opcionalna, pa
// se ista lista pravi dvaput sa razlicitom zastavicom.
function pravila(izmena) {
  const mozeDaFali = (lanac) => (izmena ? lanac.optional() : lanac);

  return [
    mozeDaFali(body('title').trim().notEmpty().withMessage('Naziv je obavezan.')),
    mozeDaFali(
      body('dateFrom').matches(DATUM).withMessage('Datum pocetka mora biti u formatu YYYY-MM-DD.')
    ),
    mozeDaFali(
      body('dateTo').matches(DATUM).withMessage('Datum kraja mora biti u formatu YYYY-MM-DD.')
    ),
    body('discountType')
      .optional()
      .isIn(['PERCENT', 'AMOUNT', 'TEXT'])
      .withMessage('Vrsta popusta mora biti PERCENT, AMOUNT ili TEXT.'),
    body('discountValue')
      .optional({ nullable: true })
      .isFloat({ min: 0 })
      .withMessage('Popust ne moze biti negativan.'),
    body('isActive').optional().isBoolean(),
  ];
}

// Provere koje zavise od vise polja odjednom. Kod izmene se ono sto nije
// poslato uzima iz zapisa - inace bi pomeranje samo pocetka moglo da napravi
// akciju koja se zavrsava pre nego sto pocne.
function nevaljalo(podaci) {
  const { title, dateFrom, dateTo, discountType, discountValue } = podaci;

  if (dateFrom && dateTo && dateTo < dateFrom) {
    return 'Datum kraja ne moze biti pre datuma pocetka.';
  }

  // Procenat preko 100 je uvek greska u kucanju, a u aplikaciji bi ispao
  // besmislen natpis ("-150%").
  if (discountType === 'PERCENT' && discountValue != null && discountValue > 100) {
    return 'Procenat popusta ne moze biti veci od 100.';
  }

  // Brojcana akcija bez broja ne bi imala sta da pokaze. Opisna (TEXT) ga
  // namerno nema - sve pise u nazivu.
  if (discountType !== 'TEXT' && (discountValue == null || discountValue === '')) {
    return 'Unesite vrednost popusta ili izaberite opisnu akciju.';
  }

  if (!title) return 'Naziv je obavezan.';

  return null;
}

// GET /api/promotions?date=YYYY-MM-DD - javno, akcije koje vaze tog dana.
// Bez parametra vazi danasnji dan. Neaktivne se ne prikazuju.
router.get('/', async (req, res) => {
  try {
    const { date } = req.query;
    if (date && !DATUM.test(date)) {
      return res.status(400).json({ message: 'Datum mora biti u formatu YYYY-MM-DD.' });
    }

    const dan = date ? toUtcDate(date) : danas();

    const rows = await prisma.promotion.findMany({
      where: { isActive: true, dateFrom: { lte: dan }, dateTo: { gte: dan } },
      orderBy: [{ dateFrom: 'asc' }, { title: 'asc' }],
    });

    res.json({ promotions: rows.map(izlaz) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Greska na serveru.' });
  }
});

// GET /api/promotions/all - admin vidi i istekle i iskljucene.
router.get('/all', protect, authorize('ADMIN', 'SUPERADMIN'), async (req, res) => {
  try {
    const rows = await prisma.promotion.findMany({ orderBy: { dateFrom: 'desc' } });
    res.json({ promotions: rows.map(izlaz) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Greska na serveru.' });
  }
});

// POST /api/promotions - admin pravi akciju.
router.post('/', protect, authorize('ADMIN', 'SUPERADMIN'), pravila(false), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const tip = req.body.discountType || 'PERCENT';
  const vrednost = tip === 'TEXT' ? null : req.body.discountValue;

  const greska = nevaljalo({
    title: req.body.title?.trim(),
    dateFrom: req.body.dateFrom,
    dateTo: req.body.dateTo,
    discountType: tip,
    discountValue: vrednost,
  });
  if (greska) return res.status(400).json({ message: greska });

  try {
    const promotion = await prisma.promotion.create({
      data: {
        title: req.body.title.trim(),
        description: req.body.description?.trim() || null,
        discountType: tip,
        discountValue: vrednost,
        dateFrom: toUtcDate(req.body.dateFrom),
        dateTo: toUtcDate(req.body.dateTo),
        isActive: req.body.isActive ?? true,
      },
    });

    res.status(201).json({ promotion: izlaz(promotion) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Greska na serveru.' });
  }
});

// PATCH /api/promotions/:id - admin menja akciju.
router.patch('/:id', protect, authorize('ADMIN', 'SUPERADMIN'), pravila(true), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const postojeca = await prisma.promotion.findUnique({ where: { id: req.params.id } });
    if (!postojeca) {
      return res.status(404).json({ message: 'Akcija nije pronadjena.' });
    }

    const stara = izlaz(postojeca);
    const tip = req.body.discountType ?? stara.discountType;
    // Prelazak na opisnu akciju brise broj; prelazak sa nje trazi novi.
    const vrednost =
      tip === 'TEXT'
        ? null
        : req.body.discountValue !== undefined
          ? req.body.discountValue
          : stara.discountValue;

    const spojeno = {
      title: req.body.title !== undefined ? req.body.title.trim() : stara.title,
      dateFrom: req.body.dateFrom ?? stara.dateFrom,
      dateTo: req.body.dateTo ?? stara.dateTo,
      discountType: tip,
      discountValue: vrednost,
    };

    const greska = nevaljalo(spojeno);
    if (greska) return res.status(400).json({ message: greska });

    const promotion = await prisma.promotion.update({
      where: { id: req.params.id },
      data: {
        title: spojeno.title,
        description:
          req.body.description !== undefined
            ? req.body.description?.trim() || null
            : postojeca.description,
        discountType: tip,
        discountValue: vrednost,
        dateFrom: toUtcDate(spojeno.dateFrom),
        dateTo: toUtcDate(spojeno.dateTo),
        isActive: req.body.isActive ?? postojeca.isActive,
      },
    });

    res.json({ promotion: izlaz(promotion) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Greska na serveru.' });
  }
});

// DELETE /api/promotions/:id
router.delete('/:id', protect, authorize('ADMIN', 'SUPERADMIN'), async (req, res) => {
  try {
    await prisma.promotion.delete({ where: { id: req.params.id } });
    res.json({ message: 'Akcija je obrisana.' });
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ message: 'Akcija nije pronadjena.' });
    }
    console.error(err);
    res.status(500).json({ message: 'Greska na serveru.' });
  }
});

module.exports = router;
