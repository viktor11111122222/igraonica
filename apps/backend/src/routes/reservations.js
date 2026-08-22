const express = require('express');
const { body, validationResult } = require('express-validator');
const prisma = require('../config/db');
const { protect, authorize } = require('../middleware/auth');
const { krajPoslePocetka } = require('../utils/time');

const router = express.Router();

const VALID_TYPES = ['BIRTHDAY', 'PRIVATE_EVENT', 'GROUP_BOOKING'];
const VALID_STATUSES = ['PENDING', 'CONFIRMED', 'CANCELLED'];

// GET /api/reservations - javno, nadolazece rezervacije (da roditelji vide kad je zauzeto)
router.get('/', async (req, res) => {
  try {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const reservations = await prisma.reservation.findMany({
      where: {
        date: { gte: today },
        status: { not: 'CANCELLED' },
      },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
      select: {
        id: true,
        type: true,
        title: true,
        date: true,
        startTime: true,
        endTime: true,
        isFullDay: true,
        status: true,
      },
    });

    res.json({ reservations });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Greska na serveru.' });
  }
});

// GET /api/reservations/all - admin vidi sve rezervacije (i prosle i otkazane)
router.get(
  '/all',
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

      const [reservations, total] = await Promise.all([
        prisma.reservation.findMany({
          where,
          include: { user: { omit: { password: true } } },
          orderBy: { date: 'desc' },
          skip,
          take: limit,
        }),
        prisma.reservation.count({ where }),
      ]);

      res.json({
        reservations,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Greska na serveru.' });
    }
  }
);

// GET /api/reservations/:id - admin vidi detalje rezervacije
router.get(
  '/:id',
  protect,
  authorize('ADMIN', 'SUPERADMIN'),
  async (req, res) => {
    try {
      const reservation = await prisma.reservation.findUnique({
        where: { id: req.params.id },
        include: { user: { omit: { password: true } } },
      });

      if (!reservation) {
        return res.status(404).json({ message: 'Rezervacija nije pronadjena.' });
      }

      res.json({ reservation });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Greska na serveru.' });
    }
  }
);

// POST /api/reservations - admin kreira rezervaciju
router.post(
  '/',
  protect,
  authorize('ADMIN', 'SUPERADMIN'),
  [
    body('type').isIn(VALID_TYPES).withMessage('Nevazeci tip rezervacije.'),
    body('title').notEmpty().withMessage('Naziv je obavezan.'),
    body('date').isISO8601().withMessage('Datum nije validan.'),
    body('startTime').matches(/^([01]\d|2[0-3]):[0-5]\d$/).withMessage('Format HH:MM.'),
    body('endTime').matches(/^([01]\d|2[0-3]):[0-5]\d$/).withMessage('Format HH:MM.'),
    // Rezervacija od 20:00 do 17:00 se cuvala bez pogovora. Kod celodnevne
    // rezervacije vremena se ne koriste, pa se tada ne proverava.
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
      const { type, title, date, startTime, endTime, guestCount, childName, childAge, contactPhone, notes, userId, isFullDay } = req.body;

      if (userId) {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
          return res.status(404).json({ message: 'Korisnik nije pronadjen.' });
        }
      }

      const reservation = await prisma.reservation.create({
        data: {
          type,
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

      res.status(201).json({ reservation });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Greska na serveru.' });
    }
  }
);

// PATCH /api/reservations/:id - admin azurira rezervaciju
router.patch(
  '/:id',
  protect,
  authorize('ADMIN', 'SUPERADMIN'),
  [
    body('type').optional().isIn(VALID_TYPES).withMessage('Nevazeci tip.'),
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
      const allowedFields = ['type', 'title', 'startTime', 'endTime', 'guestCount', 'childName', 'childAge', 'contactPhone', 'notes', 'status', 'isFullDay'];
      const data = {};
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          data[field] = req.body[field];
        }
      }

      if (req.body.date) {
        data.date = new Date(req.body.date + 'T00:00:00.000Z');
      }

      // Izmena moze da posalje samo jedno od dva vremena, pa se drugo uzima iz
      // zapisa - inace bi se pomeranjem pocetka moglo dobiti "od 20:00 do 17:00".
      if (data.startTime !== undefined || data.endTime !== undefined || data.isFullDay !== undefined) {
        const postojeca = await prisma.reservation.findUnique({ where: { id: req.params.id } });
        if (!postojeca) {
          return res.status(404).json({ message: 'Rezervacija nije pronadjena.' });
        }
        const celodnevna = data.isFullDay ?? postojeca.isFullDay;
        const pocetak = data.startTime ?? postojeca.startTime;
        const kraj = data.endTime ?? postojeca.endTime;
        if (!celodnevna && !krajPoslePocetka(pocetak, kraj)) {
          return res.status(400).json({ message: 'Vreme zavrsetka mora biti posle vremena pocetka.' });
        }
      }

      const reservation = await prisma.reservation.update({
        where: { id: req.params.id },
        data,
        include: { user: { omit: { password: true } } },
      });

      res.json({ reservation });
    } catch (err) {
      if (err.code === 'P2025') {
        return res.status(404).json({ message: 'Rezervacija nije pronadjena.' });
      }
      console.error(err);
      res.status(500).json({ message: 'Greska na serveru.' });
    }
  }
);

// DELETE /api/reservations/:id - admin brise rezervaciju
router.delete(
  '/:id',
  protect,
  authorize('ADMIN', 'SUPERADMIN'),
  async (req, res) => {
    try {
      await prisma.reservation.delete({ where: { id: req.params.id } });
      res.json({ message: 'Rezervacija je obrisana.' });
    } catch (err) {
      if (err.code === 'P2025') {
        return res.status(404).json({ message: 'Rezervacija nije pronadjena.' });
      }
      console.error(err);
      res.status(500).json({ message: 'Greska na serveru.' });
    }
  }
);

module.exports = router;
