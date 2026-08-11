const express = require('express');
const { body, validationResult } = require('express-validator');
const prisma = require('../config/db');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// GET /api/settings - admin vidi sva podesavanja
router.get(
  '/',
  protect,
  authorize('ADMIN', 'SUPERADMIN'),
  async (req, res) => {
    try {
      const settings = await prisma.setting.findMany({
        orderBy: { key: 'asc' },
      });

      res.json({ settings });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Greska na serveru.' });
    }
  }
);

// GET /api/settings/:key - admin cita jedno podesavanje
router.get(
  '/:key',
  protect,
  authorize('ADMIN', 'SUPERADMIN'),
  async (req, res) => {
    try {
      const setting = await prisma.setting.findUnique({
        where: { key: req.params.key },
      });

      if (!setting) {
        return res.status(404).json({ message: 'Podesavanje nije pronadjeno.' });
      }

      res.json({ setting });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Greska na serveru.' });
    }
  }
);

// PATCH /api/settings/:key - admin menja podesavanje
router.patch(
  '/:key',
  protect,
  authorize('ADMIN', 'SUPERADMIN'),
  [
    body('value').notEmpty().withMessage('Vrednost je obavezna.'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const setting = await prisma.setting.findUnique({
        where: { key: req.params.key },
      });

      if (!setting) {
        return res.status(404).json({ message: 'Podesavanje nije pronadjeno.' });
      }

      const updated = await prisma.setting.update({
        where: { key: req.params.key },
        data: {
          value: req.body.value,
          description: req.body.description !== undefined ? req.body.description : setting.description,
        },
      });

      res.json({ setting: updated });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Greska na serveru.' });
    }
  }
);

// POST /api/settings - admin kreira novo podesavanje
router.post(
  '/',
  protect,
  authorize('ADMIN', 'SUPERADMIN'),
  [
    body('key').notEmpty().withMessage('Kljuc je obavezan.'),
    body('value').notEmpty().withMessage('Vrednost je obavezna.'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { key, value, description } = req.body;

      const existing = await prisma.setting.findUnique({ where: { key } });
      if (existing) {
        return res.status(409).json({ message: 'Podesavanje sa ovim kljucem vec postoji.' });
      }

      const setting = await prisma.setting.create({
        data: { key, value, description },
      });

      res.status(201).json({ setting });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Greska na serveru.' });
    }
  }
);

// DELETE /api/settings/:key - admin brise podesavanje
router.delete(
  '/:key',
  protect,
  authorize('ADMIN', 'SUPERADMIN'),
  async (req, res) => {
    try {
      await prisma.setting.delete({
        where: { key: req.params.key },
      });

      res.json({ message: 'Podesavanje je obrisano.' });
    } catch (err) {
      if (err.code === 'P2025') {
        return res.status(404).json({ message: 'Podesavanje nije pronadjeno.' });
      }
      console.error(err);
      res.status(500).json({ message: 'Greska na serveru.' });
    }
  }
);

module.exports = router;
