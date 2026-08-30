const express = require('express');
const { body, validationResult } = require('express-validator');
const prisma = require('../config/db');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// Datumi se drze na UTC ponoci, isto kao u menu.js. Kolona je @db.Date, pa
// bi lokalna ponoc istocno od Grinica pala na prethodni dan.
function toUtcDate(key) {
  return new Date(`${key}T00:00:00.000Z`);
}

function toKey(date) {
  return new Date(date).toISOString().split('T')[0];
}

// Prvi dan tekuceg meseca - podrazumevani donji kraj opsega. Traka datuma u
// aplikaciji prikazuje ceo mesec, pa mora da vidi i neradne dane koji su vec
// prosli, inace bi oznake nestajale kako mesec odmice.
function firstOfThisMonth() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

const izlaz = (row) => ({
  id: row.id,
  date: toKey(row.date),
  reason: row.reason,
  note: row.note,
  kind: 'CLOSED',
});

// Celodnevni rodjendan zauzima igraonicu ceo dan, pa je taj dan neradni i bez
// rucnog oznacavanja u panelu - inace bi osoblje istu stvar upisivalo dvaput, a
// roditelj bi je video na dva razlicita nacina.
//
// `kind` govori aplikaciji da je razlog rodjendan, da bi svuda prikazala isto.
// Ako je dan i rucno oznacen, rodjendan je precutan razlog, a rucna napomena se
// zadrzava - ona obicno kaze ono sto rodjendan sam po sebi ne kaze.
function spojiRodjendane(rows, rodjendani) {
  const poDatumu = new Map(rows.map((r) => [r.date, r]));

  for (const r of rodjendani) {
    const datum = toKey(r.date);
    poDatumu.set(datum, {
      id: r.id,
      date: datum,
      reason: 'Rodjendan',
      note: poDatumu.get(datum)?.note ?? null,
      kind: 'BIRTHDAY',
    });
  }

  return [...poDatumu.values()].sort((a, b) => a.date.localeCompare(b.date));
}

// GET /api/closed-days?from=YYYY-MM-DD&to=YYYY-MM-DD - javno.
// Bez parametara vraca od pocetka tekuceg meseca pa nadalje.
router.get('/', async (req, res) => {
  try {
    const { from, to } = req.query;

    const where = { date: { gte: from ? toUtcDate(from) : firstOfThisMonth() } };
    if (to) where.date.lte = toUtcDate(to);

    const [rows, rodjendani] = await Promise.all([
      prisma.closedDay.findMany({ where, orderBy: { date: 'asc' } }),
      prisma.reservation.findMany({
        where: { type: 'BIRTHDAY', isFullDay: true, status: { not: 'CANCELLED' }, date: where.date },
        orderBy: { date: 'asc' },
        select: { id: true, date: true },
      }),
    ]);

    res.json({ closedDays: spojiRodjendane(rows.map(izlaz), rodjendani) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Greska na serveru.' });
  }
});

// GET /api/closed-days/all - admin vidi i prosle datume.
router.get('/all', protect, authorize('ADMIN', 'SUPERADMIN'), async (req, res) => {
  try {
    const rows = await prisma.closedDay.findMany({ orderBy: { date: 'desc' } });
    res.json({ closedDays: rows.map(izlaz) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Greska na serveru.' });
  }
});

// POST /api/closed-days - admin oznacava dan kao neradni.
router.post(
  '/',
  protect,
  authorize('ADMIN', 'SUPERADMIN'),
  [
    body('date').isISO8601().withMessage('Datum nije validan.'),
    body('reason').trim().notEmpty().withMessage('Razlog je obavezan.'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { date, reason, note } = req.body;
      const dateObj = toUtcDate(date.split('T')[0]);

      const existing = await prisma.closedDay.findUnique({ where: { date: dateObj } });
      if (existing) {
        return res.status(409).json({ message: 'Taj dan je vec oznacen kao neradni.' });
      }

      const row = await prisma.closedDay.create({
        data: { date: dateObj, reason: reason.trim(), note: note?.trim() || null },
      });

      res.status(201).json({ closedDay: izlaz(row) });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Greska na serveru.' });
    }
  }
);

// PATCH /api/closed-days/:id - admin menja razlog ili napomenu.
router.patch(
  '/:id',
  protect,
  authorize('ADMIN', 'SUPERADMIN'),
  [body('reason').optional().trim().notEmpty().withMessage('Razlog ne moze biti prazan.')],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const data = {};
      if (req.body.reason !== undefined) data.reason = req.body.reason.trim();
      if (req.body.note !== undefined) data.note = req.body.note?.trim() || null;
      if (req.body.date !== undefined) data.date = toUtcDate(req.body.date.split('T')[0]);

      const row = await prisma.closedDay.update({ where: { id: req.params.id }, data });

      res.json({ closedDay: izlaz(row) });
    } catch (err) {
      if (err.code === 'P2025') {
        return res.status(404).json({ message: 'Neradni dan nije pronadjen.' });
      }
      if (err.code === 'P2002') {
        return res.status(409).json({ message: 'Taj dan je vec oznacen kao neradni.' });
      }
      console.error(err);
      res.status(500).json({ message: 'Greska na serveru.' });
    }
  }
);

// DELETE /api/closed-days/:id - admin vraca dan u radne.
router.delete('/:id', protect, authorize('ADMIN', 'SUPERADMIN'), async (req, res) => {
  try {
    await prisma.closedDay.delete({ where: { id: req.params.id } });
    res.json({ message: 'Dan je vracen u radne.' });
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ message: 'Neradni dan nije pronadjen.' });
    }
    console.error(err);
    res.status(500).json({ message: 'Greska na serveru.' });
  }
});

module.exports = router;
