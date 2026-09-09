const express = require('express');
const { body, validationResult } = require('express-validator');
const prisma = require('../config/db');
const { protect, authorize } = require('../middleware/auth');
const { krajPoslePocetka, minutiOdPonoci } = require('../utils/time');
const { nazivTipa } = require('../utils/rezervacije');

const router = express.Router();

// GET /api/schedule - javno, nedeljni raspored (recurring aktivnosti)
router.get('/', async (req, res) => {
  try {
    const activities = await prisma.activity.findMany({
      where: { isActive: true, isRecurring: true },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });

    // Grupisanje po danu
    const week = {};
    for (let i = 0; i < 7; i++) {
      week[i] = activities.filter((a) => a.dayOfWeek === i);
    }

    res.json({ activities, week });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Greska na serveru.' });
  }
});

// GET /api/schedule/day/:dayOfWeek - javno, raspored za odredjeni dan (0=pon, 6=ned)
router.get('/day/:dayOfWeek', async (req, res) => {
  try {
    const dayOfWeek = parseInt(req.params.dayOfWeek);
    if (isNaN(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
      return res.status(400).json({ message: 'Dan mora biti broj izmedju 0 (ponedeljak) i 6 (nedelja).' });
    }

    const activities = await prisma.activity.findMany({
      where: { isActive: true, isRecurring: true, dayOfWeek },
      orderBy: { startTime: 'asc' },
    });

    res.json({ dayOfWeek, activities });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Greska na serveru.' });
  }
});

// GET /api/schedule/events?dateFrom=&dateTo= - javno, one-off dogadjaji u periodu
router.get('/events', async (req, res) => {
  try {
    const { dateFrom, dateTo } = req.query;

    const where = { isActive: true, isRecurring: false, specificDate: {} };

    if (dateFrom) {
      where.specificDate.gte = new Date(dateFrom + 'T00:00:00.000Z');
    } else {
      where.specificDate.gte = new Date();
    }

    if (dateTo) {
      where.specificDate.lte = new Date(dateTo + 'T23:59:59.999Z');
    }

    const events = await prisma.activity.findMany({
      where,
      orderBy: [{ specificDate: 'asc' }, { startTime: 'asc' }],
    });

    res.json({ events });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Greska na serveru.' });
  }
});

// GET /api/schedule/plan?date=YYYY-MM-DD - javno, sve sto se tog dana desava.
//
// Spaja tri izvora koja je aplikacija ranije morala sama da trazi (i nije):
// nedeljne aktivnosti za taj dan u nedelji, jednokratne dogadjaje bas tog
// datuma i rezervacije.
//
// Rezervacija zauzima igraonicu i jaca je od redovnog programa - svejedno je li
// rodjendan, privatna proslava ili nesto sto je osoblje samo nazvalo. Dok traje,
// aktivnosti se ne odrzavaju, pa se ni ne prikazuju: celodnevna gasi ceo dan, a
// ona u terminu samo ono sto upada u njeno vreme. Sto je pre i posle nje ostaje.
//
// Rezervacije idu na vrh spiska bez obzira na sat.
//
// Racunaju se samo potvrdjene. Zahtev na cekanju nije dogovoren posao: ne
// prikazuje se roditelju, i - jednako vazno - ne gasi aktivnosti tog dana.
// Suprotno bi znacilo prazan dan zbog rodjendana koji mozda nece ni biti.
router.get('/plan', async (req, res) => {
  try {
    const { date } = req.query;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ message: 'Datum mora biti u formatu YYYY-MM-DD.' });
    }

    const dan = new Date(`${date}T00:00:00.000Z`);
    if (Number.isNaN(dan.getTime())) {
      return res.status(400).json({ message: 'Datum nije validan.' });
    }

    // Backend racuna 0 = ponedeljak, a getUTCDay vraca 0 = nedelja.
    const dayOfWeek = (dan.getUTCDay() + 6) % 7;

    const [nedeljne, jednokratne, rezervacije] = await Promise.all([
      prisma.activity.findMany({
        where: { isActive: true, isRecurring: true, dayOfWeek },
        orderBy: { startTime: 'asc' },
      }),
      prisma.activity.findMany({
        where: { isActive: true, isRecurring: false, specificDate: dan },
        orderBy: { startTime: 'asc' },
      }),
      prisma.reservation.findMany({
        where: { date: dan, status: 'CONFIRMED' },
        orderBy: { startTime: 'asc' },
        // Ime deteta se namerno ne salje - spisak vidi svaki roditelj.
        select: {
          id: true,
          type: true,
          customType: true,
          startTime: true,
          endTime: true,
          isFullDay: true,
        },
      }),
    ]);

    // Termini se dodiruju bez preklapanja: aktivnost 09:00-10:00 i rezervacija
    // od 10:00 mogu jedno za drugim.
    const upadaUZauzeto = (a) =>
      rezervacije.some((r) => {
        if (r.isFullDay) return true;

        const pocetak = minutiOdPonoci(a.startTime);
        const kraj = minutiOdPonoci(a.endTime);
        const rPocetak = minutiOdPonoci(r.startTime);
        const rKraj = minutiOdPonoci(r.endTime);
        if ([pocetak, kraj, rPocetak, rKraj].some((v) => v === null)) return false;

        return pocetak < rKraj && rPocetak < kraj;
      });

    const aktivnost = (a) => ({
      id: a.id,
      kind: 'ACTIVITY',
      title: a.title,
      description: a.description,
      startTime: a.startTime,
      endTime: a.endTime,
      ageGroup: a.ageGroup,
      color: a.color,
    });

    const items = [
      ...rezervacije.map((r) => ({
        id: r.id,
        // Rodjendan se izdvaja samo zbog izgleda kartice u aplikaciji.
        kind: r.type === 'BIRTHDAY' ? 'BIRTHDAY' : 'RESERVATION',
        // Stoji naziv tipa, a ne naslov koji je osoblje upisalo: taj naslov je
        // interna beleska i cesto nosi ime deteta, koje u spisku koji vidi
        // svaki roditelj nema sta da trazi.
        title: nazivTipa(r),
        description: null,
        startTime: r.startTime,
        endTime: r.endTime,
        isFullDay: r.isFullDay,
      })),
      ...[...nedeljne, ...jednokratne]
        .filter((a) => !upadaUZauzeto(a))
        .sort((a, b) => a.startTime.localeCompare(b.startTime))
        .map(aktivnost),
    ];

    res.json({ date, dayOfWeek, items });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Greska na serveru.' });
  }
});

// GET /api/schedule/all - admin vidi sve (ukljucujuci neaktivne)
router.get(
  '/all',
  protect,
  authorize('ADMIN', 'SUPERADMIN'),
  async (req, res) => {
    try {
      const activities = await prisma.activity.findMany({
        orderBy: [{ isRecurring: 'desc' }, { dayOfWeek: 'asc' }, { startTime: 'asc' }],
      });

      res.json({ activities });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Greska na serveru.' });
    }
  }
);

// POST /api/schedule - admin kreira aktivnost
router.post(
  '/',
  protect,
  authorize('ADMIN', 'SUPERADMIN'),
  [
    body('title').notEmpty().withMessage('Naziv je obavezan.'),
    body('startTime').matches(/^([01]\d|2[0-3]):[0-5]\d$/).withMessage('Vreme pocetka mora biti u formatu HH:MM (00:00-23:59).'),
    body('endTime').matches(/^([01]\d|2[0-3]):[0-5]\d$/).withMessage('Vreme zavrsetka mora biti u formatu HH:MM (00:00-23:59).'),
    // Aktivnost od 18:00 do 09:00 se cuvala bez pogovora, pa je roditelj u
    // aplikaciji video besmislen termin.
    body('endTime')
      .custom((kraj, { req }) => krajPoslePocetka(req.body.startTime, kraj))
      .withMessage('Vreme zavrsetka mora biti posle vremena pocetka.'),
    body('dayOfWeek').optional().isInt({ min: 0, max: 6 }).withMessage('Dan mora biti 0-6.'),
    body('isRecurring').optional().isBoolean(),
    body('specificDate').optional().isISO8601().withMessage('Datum nije validan.'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { title, description, dayOfWeek, startTime, endTime, ageGroup, color, isRecurring, specificDate } = req.body;

      const recurring = isRecurring !== undefined ? isRecurring : true;

      if (recurring && (dayOfWeek === undefined || dayOfWeek === null)) {
        return res.status(400).json({ message: 'Dan u nedelji je obavezan za recurring aktivnosti.' });
      }

      if (!recurring && !specificDate) {
        return res.status(400).json({ message: 'Datum je obavezan za jednokratne dogadjaje.' });
      }

      const activity = await prisma.activity.create({
        data: {
          title,
          description: description || null,
          dayOfWeek: recurring ? dayOfWeek : 0,
          startTime,
          endTime,
          ageGroup: ageGroup || null,
          color: color || null,
          isRecurring: recurring,
          specificDate: specificDate ? new Date(specificDate + 'T00:00:00.000Z') : null,
        },
      });

      res.status(201).json({ activity });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Greska na serveru.' });
    }
  }
);

// PATCH /api/schedule/:id - admin azurira aktivnost
router.patch(
  '/:id',
  protect,
  authorize('ADMIN', 'SUPERADMIN'),
  [
    body('title').optional().notEmpty().withMessage('Naziv ne moze biti prazan.'),
    body('startTime').optional().matches(/^\d{2}:\d{2}$/).withMessage('Format HH:MM.'),
    body('endTime').optional().matches(/^\d{2}:\d{2}$/).withMessage('Format HH:MM.'),
    body('dayOfWeek').optional().isInt({ min: 0, max: 6 }).withMessage('Dan mora biti 0-6.'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const allowedFields = ['title', 'description', 'dayOfWeek', 'startTime', 'endTime', 'ageGroup', 'color', 'isRecurring', 'isActive'];
      const data = {};
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          data[field] = req.body[field];
        }
      }

      if (req.body.specificDate !== undefined) {
        data.specificDate = req.body.specificDate ? new Date(req.body.specificDate + 'T00:00:00.000Z') : null;
      }

      // Izmena moze da posalje samo jedno od dva vremena, pa se drugo uzima iz
      // zapisa - inace bi se pomeranjem pocetka moglo dobiti "od 18:00 do 09:00".
      if (data.startTime !== undefined || data.endTime !== undefined) {
        const postojeca = await prisma.activity.findUnique({ where: { id: req.params.id } });
        if (!postojeca) {
          return res.status(404).json({ message: 'Aktivnost nije pronadjena.' });
        }
        const pocetak = data.startTime ?? postojeca.startTime;
        const kraj = data.endTime ?? postojeca.endTime;
        if (!krajPoslePocetka(pocetak, kraj)) {
          return res.status(400).json({ message: 'Vreme zavrsetka mora biti posle vremena pocetka.' });
        }
      }

      const activity = await prisma.activity.update({
        where: { id: req.params.id },
        data,
      });

      res.json({ activity });
    } catch (err) {
      if (err.code === 'P2025') {
        return res.status(404).json({ message: 'Aktivnost nije pronadjena.' });
      }
      console.error(err);
      res.status(500).json({ message: 'Greska na serveru.' });
    }
  }
);

// DELETE /api/schedule/:id - admin brise aktivnost
router.delete(
  '/:id',
  protect,
  authorize('ADMIN', 'SUPERADMIN'),
  async (req, res) => {
    try {
      await prisma.activity.delete({ where: { id: req.params.id } });
      res.json({ message: 'Aktivnost je obrisana.' });
    } catch (err) {
      if (err.code === 'P2025') {
        return res.status(404).json({ message: 'Aktivnost nije pronadjena.' });
      }
      console.error(err);
      res.status(500).json({ message: 'Greska na serveru.' });
    }
  }
);

module.exports = router;
