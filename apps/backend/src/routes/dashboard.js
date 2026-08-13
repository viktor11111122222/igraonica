const express = require('express');
const prisma = require('../config/db');
const { protect, authorize } = require('../middleware/auth');
const { startOfDay, endOfDay, addDays, toKey } = require('../utils/day');

const router = express.Router();

router.use(protect);
router.use(authorize('ADMIN', 'SUPERADMIN'));

// GET /api/dashboard/stats - glavne statistike
router.get('/stats', async (req, res) => {
  try {
    // Lokalni dan, ne UTC: "danas" mora da pocne u ponoc po nasem vremenu.
    const todayStart = startOfDay();
    const todayEnd = endOfDay();

    const [totalUsers, totalChildren, activeKids, pendingCheckouts, todayVisits, todayHours] = await Promise.all([
      prisma.user.count({ where: { role: 'PARENT', isActive: true } }),
      prisma.child.count({ where: { isActive: true } }),
      prisma.visit.count({ where: { status: 'CHECKED_IN' } }),
      prisma.visit.count({ where: { status: 'CHECKED_IN' } }),
      prisma.visit.count({
        where: { checkedInAt: { gte: todayStart, lte: todayEnd } },
      }),
      prisma.visit.findMany({
        where: {
          checkedOutAt: { gte: todayStart, lte: todayEnd },
          hoursDeducted: { not: null },
        },
        select: { hoursDeducted: true },
      }),
    ]);

    const hoursUsedToday = todayHours.reduce((sum, v) => sum + Number(v.hoursDeducted), 0);

    res.json({
      totalUsers,
      totalChildren,
      activeKids,
      pendingCheckouts,
      todayVisits,
      hoursUsedToday: Math.round(hoursUsedToday * 100) / 100,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Greska na serveru.' });
  }
});

// GET /api/dashboard/recent-activity - poslednje aktivnosti
router.get('/recent-activity', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;

    const visits = await prisma.visit.findMany({
      include: {
        child: true,
        checkedInBy: { omit: { password: true } },
        checkedOutBy: { omit: { password: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    });

    res.json({ visits });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Greska na serveru.' });
  }
});

// GET /api/dashboard/chart/visits?period=week|month - grafikon poseta
router.get('/chart/visits', async (req, res) => {
  try {
    const period = req.query.period || 'week';
    const days = period === 'month' ? 30 : 7;

    const startDate = startOfDay(addDays(new Date(), -days + 1));

    const visits = await prisma.visit.findMany({
      where: { checkedInAt: { gte: startDate } },
      select: { checkedInAt: true },
    });

    const chart = {};
    for (let i = 0; i < days; i++) {
      chart[toKey(addDays(startDate, i))] = 0;
    }

    visits.forEach((v) => {
      const key = toKey(v.checkedInAt);
      if (chart[key] !== undefined) {
        chart[key]++;
      }
    });

    const data = Object.entries(chart).map(([date, count]) => ({ date, count }));

    res.json({ period, data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Greska na serveru.' });
  }
});

// GET /api/dashboard/chart/hours?period=week|month - grafikon utrosenih sati
router.get('/chart/hours', async (req, res) => {
  try {
    const period = req.query.period || 'week';
    const days = period === 'month' ? 30 : 7;

    const startDate = startOfDay(addDays(new Date(), -days + 1));

    const visits = await prisma.visit.findMany({
      where: {
        checkedOutAt: { gte: startDate },
        hoursDeducted: { not: null },
      },
      select: { checkedOutAt: true, hoursDeducted: true },
    });

    const chart = {};
    for (let i = 0; i < days; i++) {
      chart[toKey(addDays(startDate, i))] = 0;
    }

    visits.forEach((v) => {
      const key = toKey(v.checkedOutAt);
      if (chart[key] !== undefined) {
        chart[key] += Number(v.hoursDeducted);
      }
    });

    const data = Object.entries(chart).map(([date, hours]) => ({
      date,
      hours: Math.round(hours * 100) / 100,
    }));

    res.json({ period, data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Greska na serveru.' });
  }
});

module.exports = router;
