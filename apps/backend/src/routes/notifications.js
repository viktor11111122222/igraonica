const express = require('express');
const prisma = require('../config/db');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Svako vidi samo svoja obavestenja - i roditelj i admin. Zato nema `authorize`:
// filter po `req.user.id` je ono sto deli pristup.
router.use(protect);

// GET /api/notifications - moja obavestenja, najnovija prva
router.get('/', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * limit;

    // `unread=1` za slucaj kada klijent hoce samo neprocitana.
    const where = { userId: req.user.id };
    if (req.query.unread === '1') where.readAt = null;

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { userId: req.user.id, readAt: null } }),
    ]);

    res.json({
      notifications,
      unreadCount,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Greska na serveru.' });
  }
});

// GET /api/notifications/unread-count - samo broj, za znacku
router.get('/unread-count', async (req, res) => {
  try {
    const unreadCount = await prisma.notification.count({
      where: { userId: req.user.id, readAt: null },
    });
    res.json({ unreadCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Greska na serveru.' });
  }
});

// PATCH /api/notifications/:id/read - oznaci jedno kao procitano
router.patch('/:id/read', async (req, res) => {
  try {
    // `updateMany` sa uslovom na vlasnika: tudje obavestenje ne moze da se
    // oznaci, a i ponovljeni zahtev prolazi bez greske.
    const rezultat = await prisma.notification.updateMany({
      where: { id: req.params.id, userId: req.user.id },
      data: { readAt: new Date() },
    });

    if (rezultat.count === 0) {
      return res.status(404).json({ message: 'Obavestenje nije pronadjeno.' });
    }

    const notification = await prisma.notification.findUnique({ where: { id: req.params.id } });
    res.json({ notification });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Greska na serveru.' });
  }
});

// POST /api/notifications/read-all - oznaci sve kao procitano
router.post('/read-all', async (req, res) => {
  try {
    const rezultat = await prisma.notification.updateMany({
      where: { userId: req.user.id, readAt: null },
      data: { readAt: new Date() },
    });

    res.json({ message: 'Sva obavestenja su oznacena kao procitana.', count: rezultat.count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Greska na serveru.' });
  }
});

module.exports = router;
