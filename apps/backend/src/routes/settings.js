const express = require('express');
const { body, validationResult } = require('express-validator');
const prisma = require('../config/db');
const { protect, authorize } = require('../middleware/auth');
const {
  CATALOG,
  DEFAULTS,
  PUBLIC_KEYS,
  cleanAnnouncementTabs,
} = require('../config/settings');

const router = express.Router();

// GET /api/settings/public - javno, podesavanja koja mobilna aplikacija cita.
// Mora pre '/:key', inace bi ta ruta uhvatila "public" kao kljuc.
// Vraca mapu kljuc -> vrednost, sa podrazumevanim vrednostima za sve sto jos
// nije upisano u bazu, da klijent nikad ne dobije prazno.
router.get('/public', async (req, res) => {
  try {
    const rows = await prisma.setting.findMany({
      where: { key: { in: PUBLIC_KEYS } },
    });

    const settings = {};
    for (const key of PUBLIC_KEYS) settings[key] = DEFAULTS[key];
    for (const row of rows) settings[row.key] = row.value;

    res.json({ settings });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Greska na serveru.' });
  }
});

// GET /api/settings - admin vidi sva podesavanja.
// Kljucevi iz kataloga se uvek vracaju, i kada jos nisu upisani u bazu -
// tada nose podrazumevanu vrednost i `stored: false`.
router.get(
  '/',
  protect,
  authorize('ADMIN', 'SUPERADMIN'),
  async (req, res) => {
    try {
      const rows = await prisma.setting.findMany({ orderBy: { key: 'asc' } });
      const byKey = new Map(rows.map((r) => [r.key, r]));

      const fromCatalog = CATALOG.map((item) => {
        const row = byKey.get(item.key);
        return {
          key: item.key,
          value: row ? row.value : item.value,
          description: row?.description || item.description,
          isPublic: item.public,
          stored: !!row,
          updatedAt: row?.updatedAt || null,
        };
      });

      // Kljucevi koje je neko dodao rucno, van kataloga.
      const extra = rows
        .filter((r) => !Object.hasOwn(DEFAULTS, r.key))
        .map((r) => ({
          key: r.key,
          value: r.value,
          description: r.description,
          isPublic: false,
          stored: true,
          updatedAt: r.updatedAt,
        }));

      res.json({ settings: [...fromCatalog, ...extra] });
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
    // Prazna vrednost je dozvoljena: telefon, adresa i obavestenje se brisu
    // tako sto se ostave prazni.
    body('value').isString().withMessage('Vrednost mora biti tekst.'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { key } = req.params;
      const setting = await prisma.setting.findUnique({ where: { key } });

      // Kljuc iz kataloga postoji i pre nego sto je ijednom sacuvan, pa se
      // prvo cuvanje mora poneti kao kreiranje, a ne kao 404.
      const known = CATALOG.find((c) => c.key === key);
      if (!setting && !known) {
        return res.status(404).json({ message: 'Podesavanje nije pronadjeno.' });
      }

      const description =
        req.body.description !== undefined
          ? req.body.description
          : setting?.description || known?.description || null;

      // Spisak ekrana za obavestenje se cisti od imena koja vise ne postoje,
      // da stara vrednost ne bi ostala u bazi kao nevidljivo smece.
      const value =
        key === 'announcement_tabs'
          ? cleanAnnouncementTabs(req.body.value)
          : req.body.value;

      const updated = await prisma.setting.upsert({
        where: { key },
        update: { value, description },
        create: { key, value, description },
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
    body('value').isString().withMessage('Vrednost mora biti tekst.'),
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
