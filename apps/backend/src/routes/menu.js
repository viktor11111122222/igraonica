const express = require('express');
const { body, validationResult } = require('express-validator');
const prisma = require('../config/db');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

const VALID_MEAL_TYPES = ['BREAKFAST', 'SNACK_MORNING', 'LUNCH', 'SNACK_AFTERNOON'];

// GET /api/menu?date=YYYY-MM-DD - javno, meni za odredjeni dan (default danas)
router.get('/', async (req, res) => {
  try {
    const dateStr = req.query.date || new Date().toISOString().split('T')[0];
    const date = new Date(dateStr + 'T00:00:00.000Z');

    const items = await prisma.menuItem.findMany({
      where: { date },
      orderBy: { mealType: 'asc' },
    });

    res.json({ date: dateStr, items });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Greska na serveru.' });
  }
});

// GET /api/menu/week?date=YYYY-MM-DD - javno, meni za celu nedelju
router.get('/week', async (req, res) => {
  try {
    const dateStr = req.query.date || new Date().toISOString().split('T')[0];
    const startDate = new Date(dateStr + 'T00:00:00.000Z');

    // Nadji ponedeljak te nedelje
    const day = startDate.getUTCDay();
    const monday = new Date(startDate);
    monday.setUTCDate(startDate.getUTCDate() - (day === 0 ? 6 : day - 1));

    const sunday = new Date(monday);
    sunday.setUTCDate(monday.getUTCDate() + 6);

    const items = await prisma.menuItem.findMany({
      where: {
        date: { gte: monday, lte: sunday },
      },
      orderBy: [{ date: 'asc' }, { mealType: 'asc' }],
    });

    // Grupisanje po danu
    const week = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setUTCDate(monday.getUTCDate() + i);
      const key = d.toISOString().split('T')[0];
      week[key] = items.filter(
        (item) => new Date(item.date).toISOString().split('T')[0] === key
      );
    }

    res.json({
      weekStart: monday.toISOString().split('T')[0],
      weekEnd: sunday.toISOString().split('T')[0],
      week,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Greska na serveru.' });
  }
});

// POST /api/menu - admin kreira stavku menija
router.post(
  '/',
  protect,
  authorize('ADMIN', 'SUPERADMIN'),
  [
    body('date').isISO8601().withMessage('Datum nije validan.'),
    body('mealType').isIn(VALID_MEAL_TYPES).withMessage('Nevazeci tip obroka.'),
    body('name').notEmpty().withMessage('Naziv jela je obavezan.'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { date, mealType, name, description, allergens } = req.body;
      const dateObj = new Date(date + 'T00:00:00.000Z');

      const existing = await prisma.menuItem.findFirst({
        where: { date: dateObj, mealType },
      });

      if (existing) {
        return res.status(409).json({ message: 'Stavka menija za ovaj datum i tip obroka vec postoji.' });
      }

      const item = await prisma.menuItem.create({
        data: {
          date: dateObj,
          mealType,
          name,
          description: description || null,
          allergens: allergens || null,
        },
      });

      res.status(201).json({ item });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Greska na serveru.' });
    }
  }
);

// POST /api/menu/bulk - admin kreira/azurira vise stavki odjednom
router.post(
  '/bulk',
  protect,
  authorize('ADMIN', 'SUPERADMIN'),
  [
    body('items').isArray({ min: 1 }).withMessage('Lista stavki je obavezna.'),
    body('items.*.date').isISO8601().withMessage('Datum nije validan.'),
    body('items.*.mealType').isIn(VALID_MEAL_TYPES).withMessage('Nevazeci tip obroka.'),
    body('items.*.name').notEmpty().withMessage('Naziv jela je obavezan.'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { items } = req.body;
      const results = [];

      for (const item of items) {
        const dateObj = new Date(item.date + 'T00:00:00.000Z');

        const upserted = await prisma.menuItem.upsert({
          where: {
            date_mealType: { date: dateObj, mealType: item.mealType },
          },
          update: {
            name: item.name,
            description: item.description || null,
            allergens: item.allergens || null,
          },
          create: {
            date: dateObj,
            mealType: item.mealType,
            name: item.name,
            description: item.description || null,
            allergens: item.allergens || null,
          },
        });

        results.push(upserted);
      }

      res.status(201).json({ items: results, count: results.length });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Greska na serveru.' });
    }
  }
);

// PATCH /api/menu/:id - admin azurira stavku menija
router.patch(
  '/:id',
  protect,
  authorize('ADMIN', 'SUPERADMIN'),
  [
    body('name').optional().notEmpty().withMessage('Naziv ne moze biti prazan.'),
    body('mealType').optional().isIn(VALID_MEAL_TYPES).withMessage('Nevazeci tip obroka.'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const allowedFields = ['name', 'description', 'allergens', 'mealType'];
      const data = {};
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          data[field] = req.body[field];
        }
      }

      const item = await prisma.menuItem.update({
        where: { id: req.params.id },
        data,
      });

      res.json({ item });
    } catch (err) {
      if (err.code === 'P2025') {
        return res.status(404).json({ message: 'Stavka menija nije pronadjena.' });
      }
      console.error(err);
      res.status(500).json({ message: 'Greska na serveru.' });
    }
  }
);

// DELETE /api/menu/:id - admin brise stavku menija
router.delete(
  '/:id',
  protect,
  authorize('ADMIN', 'SUPERADMIN'),
  async (req, res) => {
    try {
      await prisma.menuItem.delete({ where: { id: req.params.id } });
      res.json({ message: 'Stavka menija je obrisana.' });
    } catch (err) {
      if (err.code === 'P2025') {
        return res.status(404).json({ message: 'Stavka menija nije pronadjena.' });
      }
      console.error(err);
      res.status(500).json({ message: 'Greska na serveru.' });
    }
  }
);

module.exports = router;
