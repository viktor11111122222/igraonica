const express = require('express');
const { body, validationResult } = require('express-validator');
const prisma = require('../config/db');
const { protect, authorize } = require('../middleware/auth');
const { krajPoslePocetka } = require('../utils/time');

const router = express.Router();

const VALID_TYPES = ['BIRTHDAY', 'PRIVATE_EVENT', 'GROUP_BOOKING', 'OTHER'];
const VALID_STATUSES = ['PENDING', 'CONFIRMED', 'CANCELLED'];

// Dogadjaji su interna evidencija osoblja. Za razliku od rezervacija ovde nema
// javne rute - svaka putanja trazi prijavu i admin rolu, pa mobilna aplikacija
// nema odakle da ih procita.

// GET /api/events - admin lista sa filterima i stranicenjem
router.get(
  '/',
  protect,
  authorize('ADMIN', 'SUPERADMIN'),
  async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const skip = (page - 1) * limit;
      const { status, type, dateFrom, dateTo } = req.query;

      const where = {};
      if (status) where.status = status;
      if (type) where.type = type;
      if (dateFrom || dateTo) {
        where.date = {};
        if (dateFrom) where.date.gte = new Date(dateFrom + 'T00:00:00.000Z');
        if (dateTo) where.date.lte = new Date(dateTo + 'T23:59:59.999Z');
      }

      const [events, total] = await Promise.all([
        prisma.event.findMany({
          where,
          include: { user: { omit: { password: true } } },
          orderBy: { date: 'desc' },
          skip,
          take: limit,
        }),
        prisma.event.count({ where }),
      ]);

      res.json({
        events,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Greska na serveru.' });
    }
  }
);

// GET /api/events/:id - admin vidi detalje dogadjaja
router.get(
  '/:id',
  protect,
  authorize('ADMIN', 'SUPERADMIN'),
  async (req, res) => {
    try {
      const event = await prisma.event.findUnique({
        where: { id: req.params.id },
        include: { user: { omit: { password: true } } },
      });

      if (!event) {
        return res.status(404).json({ message: 'Dogadjaj nije pronadjen.' });
      }

      res.json({ event });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Greska na serveru.' });
    }
  }
);

// POST /api/events - admin kreira dogadjaj
router.post(
  '/',
  protect,
  authorize('ADMIN', 'SUPERADMIN'),
  [
    body('type').isIn(VALID_TYPES).withMessage('Nevazeci tip dogadjaja.'),
    // Tip OTHER nosi ime koje osoblje samo upisuje, pa bez njega red u tabeli
    // ne bi imao sta da prikaze.
    body('customType')
      .custom((naziv, { req }) => req.body.type !== 'OTHER' || String(naziv || '').trim() !== '')
      .withMessage('Za tip "Drugo" upisite naziv tipa.'),
    body('title').notEmpty().withMessage('Naziv je obavezan.'),
    body('date').isISO8601().withMessage('Datum nije validan.'),
    body('startTime').matches(/^([01]\d|2[0-3]):[0-5]\d$/).withMessage('Format HH:MM.'),
    body('endTime').matches(/^([01]\d|2[0-3]):[0-5]\d$/).withMessage('Format HH:MM.'),
    // Kod celodnevnog dogadjaja vremena se ne koriste, pa se tada ne proverava.
    body('endTime')
      .custom((kraj, { req }) => req.body.isFullDay === true || krajPoslePocetka(req.body.startTime, kraj))
      .withMessage('Vreme zavrsetka mora biti posle vremena pocetka.'),
    body('guestCount').optional().isInt({ min: 1 }).withMessage('Broj gostiju mora biti pozitivan.'),
    body('childAge').optional().isInt({ min: 0 }).withMessage('Uzrast mora biti pozitivan.'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { type, customType, title, date, startTime, endTime, guestCount, childName, childAge, contactPhone, notes, userId, isFullDay } = req.body;

      if (userId) {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
          return res.status(404).json({ message: 'Korisnik nije pronadjen.' });
        }
      }

      const event = await prisma.event.create({
        data: {
          type,
          customType: type === 'OTHER' ? String(customType).trim() : null,
          title,
          date: new Date(date + 'T00:00:00.000Z'),
          startTime,
          endTime,
          guestCount: guestCount || null,
          childName: childName || null,
          childAge: childAge || null,
          contactPhone: contactPhone || null,
          notes: notes || null,
          userId: userId || null,
          isFullDay: isFullDay || false,
        },
        include: { user: { omit: { password: true } } },
      });

      res.status(201).json({ event });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Greska na serveru.' });
    }
  }
);

// PATCH /api/events/:id - admin azurira dogadjaj
router.patch(
  '/:id',
  protect,
  authorize('ADMIN', 'SUPERADMIN'),
  [
    body('type').optional().isIn(VALID_TYPES).withMessage('Nevazeci tip.'),
    body('customType').optional({ nullable: true }).isString().withMessage('Naziv tipa mora biti tekst.'),
    body('status').optional().isIn(VALID_STATUSES).withMessage('Nevazeci status.'),
    body('title').optional().notEmpty().withMessage('Naziv ne moze biti prazan.'),
    body('startTime').optional().matches(/^([01]\d|2[0-3]):[0-5]\d$/).withMessage('Format HH:MM.'),
    body('endTime').optional().matches(/^([01]\d|2[0-3]):[0-5]\d$/).withMessage('Format HH:MM.'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const allowedFields = ['type', 'customType', 'title', 'startTime', 'endTime', 'guestCount', 'childName', 'childAge', 'contactPhone', 'notes', 'status', 'isFullDay'];
      const data = {};
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          data[field] = req.body[field];
        }
      }

      if (req.body.date) {
        data.date = new Date(req.body.date + 'T00:00:00.000Z');
      }

      // Izmena moze da posalje samo deo polja, pa se ostatak uzima iz zapisa -
      // inace bi se pomeranjem pocetka moglo dobiti "od 20:00 do 17:00", a
      // prelaskom na tip "Drugo" dogadjaj bez upisanog naziva tipa.
      const menjaVreme =
        data.startTime !== undefined || data.endTime !== undefined || data.isFullDay !== undefined;
      const menjaTip = data.type !== undefined || data.customType !== undefined;

      if (menjaVreme || menjaTip) {
        const postojeci = await prisma.event.findUnique({ where: { id: req.params.id } });
        if (!postojeci) {
          return res.status(404).json({ message: 'Dogadjaj nije pronadjen.' });
        }

        if (menjaVreme) {
          const celodnevni = data.isFullDay ?? postojeci.isFullDay;
          const pocetak = data.startTime ?? postojeci.startTime;
          const kraj = data.endTime ?? postojeci.endTime;
          if (!celodnevni && !krajPoslePocetka(pocetak, kraj)) {
            return res.status(400).json({ message: 'Vreme zavrsetka mora biti posle vremena pocetka.' });
          }
        }

        if (menjaTip) {
          const tip = data.type ?? postojeci.type;
          if (tip === 'OTHER') {
            const naziv = String(data.customType ?? postojeci.customType ?? '').trim();
            if (!naziv) {
              return res.status(400).json({ message: 'Za tip "Drugo" upisite naziv tipa.' });
            }
            data.customType = naziv;
          } else {
            // Prelazak na tip iz spiska brise stari upisani naziv - inace bi
            // ostao u bazi i vratio se ako se tip vrati na "Drugo".
            data.customType = null;
          }
        }
      }

      const event = await prisma.event.update({
        where: { id: req.params.id },
        data,
        include: { user: { omit: { password: true } } },
      });

      res.json({ event });
    } catch (err) {
      if (err.code === 'P2025') {
        return res.status(404).json({ message: 'Dogadjaj nije pronadjen.' });
      }
      console.error(err);
      res.status(500).json({ message: 'Greska na serveru.' });
    }
  }
);

// DELETE /api/events/:id - admin brise dogadjaj
router.delete(
  '/:id',
  protect,
  authorize('ADMIN', 'SUPERADMIN'),
  async (req, res) => {
    try {
      await prisma.event.delete({ where: { id: req.params.id } });
      res.json({ message: 'Dogadjaj je obrisan.' });
    } catch (err) {
      if (err.code === 'P2025') {
        return res.status(404).json({ message: 'Dogadjaj nije pronadjen.' });
      }
      console.error(err);
      res.status(500).json({ message: 'Greska na serveru.' });
    }
  }
);

module.exports = router;
