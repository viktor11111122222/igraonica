const express = require('express');
const prisma = require('../config/db');
const { protect, authorize } = require('../middleware/auth');
const { numericSetting } = require('../config/settings');

const router = express.Router();

router.use(protect);

async function getSetting(key, fallback) {
  const setting = await prisma.setting.findUnique({ where: { key } });
  return setting ? setting.value : fallback;
}

function roundUpMinutes(minutes, roundTo) {
  return Math.ceil(minutes / roundTo) * roundTo;
}

function findActivePackage(userPackages) {
  const now = new Date();
  return userPackages
    .filter((up) => up.isActive && new Date(up.expiresAt) > now && Number(up.remainingHours) > 0)
    .sort((a, b) => new Date(a.expiresAt) - new Date(b.expiresAt))[0] || null;
}

// POST /api/visits/check-in - admin skenira QR kod deteta pri dolasku
router.post(
  '/check-in',
  authorize('ADMIN', 'SUPERADMIN'),
  async (req, res) => {
    try {
      const { qrCode } = req.body;

      if (!qrCode) {
        return res.status(400).json({ message: 'QR kod je obavezan.' });
      }

      // 1. Nadji dete po QR kodu
      const child = await prisma.child.findUnique({
        where: { qrCode },
        include: {
          parent: {
            omit: { password: true },
            include: {
              userPackages: { include: { package: true } },
            },
          },
        },
      });

      if (!child) {
        return res.status(404).json({ message: 'Dete sa ovim QR kodom nije pronadjeno.' });
      }

      if (!child.isActive) {
        return res.status(400).json({ message: 'Ovaj nalog deteta je deaktiviran.' });
      }

      // 2. Proveri da dete nije vec checked-in
      const openVisit = await prisma.visit.findFirst({
        where: { childId: child.id, status: 'CHECKED_IN' },
      });

      if (openVisit) {
        return res.status(409).json({
          message: 'Dete je vec prijavljeno u igraonici.',
          visit: openVisit,
        });
      }

      // 3. Nadji aktivan paket roditelja sa preostalim satima
      const activePackage = findActivePackage(child.parent.userPackages);

      if (!activePackage) {
        return res.status(400).json({
          message: 'Roditelj nema aktivan paket sa preostalim satima.',
          child: { id: child.id, firstName: child.firstName, lastName: child.lastName },
          parent: { id: child.parent.id, firstName: child.parent.firstName, lastName: child.parent.lastName },
        });
      }

      // 4. Kreiraj posetu
      //
      // Provera iznad je citanje, pa izmedju nje i upisa moze da se ubaci drugo
      // skeniranje (dva radnika, ili dupli dodir). Zato pravu bravu drzi
      // delimicni jedinstveni indeks u bazi - ovde se samo prepoznaje njegov
      // sudar i vraca ista poruka kao da je provera uhvatila.
      let visit;
      try {
        visit = await prisma.visit.create({
          data: {
            childId: child.id,
            userPackageId: activePackage.id,
            checkedInAt: new Date(),
            checkedInById: req.user.id,
            status: 'CHECKED_IN',
          },
          include: {
            child: true,
            userPackage: { include: { package: true } },
          },
        });
      } catch (err) {
        if (err.code === 'P2002') {
          const postojeca = await prisma.visit.findFirst({
            where: { childId: child.id, status: 'CHECKED_IN' },
          });
          return res.status(409).json({
            message: 'Dete je vec prijavljeno u igraonici.',
            visit: postojeca,
          });
        }
        throw err;
      }

      res.status(201).json({
        message: `${child.firstName} ${child.lastName} je prijavljen/a.`,
        visit,
        remainingHours: Number(activePackage.remainingHours),
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Greska na serveru.' });
    }
  }
);

// POST /api/visits/check-out - admin skenira QR kod deteta pri odlasku
router.post(
  '/check-out',
  authorize('ADMIN', 'SUPERADMIN'),
  async (req, res) => {
    try {
      const { qrCode } = req.body;

      if (!qrCode) {
        return res.status(400).json({ message: 'QR kod je obavezan.' });
      }

      // 1. Nadji dete po QR kodu
      const child = await prisma.child.findUnique({ where: { qrCode } });

      if (!child) {
        return res.status(404).json({ message: 'Dete sa ovim QR kodom nije pronadjeno.' });
      }

      // 2. Nadji otvorenu posetu
      const openVisit = await prisma.visit.findFirst({
        where: { childId: child.id, status: 'CHECKED_IN' },
        include: { userPackage: true },
      });

      if (!openVisit) {
        return res.status(400).json({ message: 'Dete nije prijavljeno u igraonici.' });
      }

      // 3. Izracunaj trajanje
      const now = new Date();
      const checkedInAt = new Date(openVisit.checkedInAt);
      const rawMinutes = Math.max(1, Math.round((now - checkedInAt) / 60000));

      // 4. Zaokruzi na osnovu podesavanja
      // `numericSetting` vraca podrazumevanu vrednost ako je u bazi nesto
      // neupotrebljivo. Naplata ne sme da zavisi od toga sta je neko upisao.
      const roundingMinutes = numericSetting('rounding_minutes', await getSetting('rounding_minutes'));
      const minimumChargeMinutes = numericSetting('minimum_charge_minutes', await getSetting('minimum_charge_minutes'));

      const roundedMinutes = Math.max(minimumChargeMinutes, roundUpMinutes(rawMinutes, roundingMinutes));
      const hoursDeducted = roundedMinutes / 60;

      // 5. Zatvori posetu i oduzmi sate - sve u transakciji.
      //
      // Dve stvari se ovde brane od trke, jer je odjava tacka na kojoj se
      // stvarno naplacuje:
      //
      //   - posetu zatvara `updateMany` sa uslovom na status. Ako je neko drugi
      //     bio brzi, uslov ne pogadja nijedan red i vracamo istu poruku kao da
      //     dete nije prijavljeno. Ranije je `update` po id-u prolazio i drugi
      //     put, pa je radnik dobijao dve potvrde za istu posetu.
      //
      //   - sati se skidaju racunicom u samoj bazi (`GREATEST(0, ... - x)`), a
      //     ne "procitaj pa upisi". Inace bi korekcija sati koja se desi u istom
      //     trenutku bila pregazena, ili bi odjava pregazila nju.
      const rezultat = await prisma.$transaction(async (tx) => {
        const zatvorena = await tx.visit.updateMany({
          where: { id: openVisit.id, status: 'CHECKED_IN' },
          data: {
            checkedOutAt: now,
            durationMinutes: roundedMinutes,
            hoursDeducted,
            checkedOutById: req.user.id,
            status: 'CHECKED_OUT',
          },
        });

        if (zatvorena.count === 0) return null;

        if (openVisit.userPackageId) {
          await tx.$executeRaw`
            UPDATE user_packages
               SET remaining_hours = GREATEST(0, remaining_hours - ${hoursDeducted}::numeric),
                   updated_at = NOW()
             WHERE id = ${openVisit.userPackageId}
          `;
        }

        const visit = await tx.visit.findUnique({
          where: { id: openVisit.id },
          include: { child: true, userPackage: { include: { package: true } } },
        });

        return {
          visit,
          remainingHours: visit.userPackage ? Number(visit.userPackage.remainingHours) : 0,
        };
      });

      if (!rezultat) {
        return res.status(400).json({ message: 'Dete nije prijavljeno u igraonici.' });
      }

      res.json({
        message: `${child.firstName} ${child.lastName} je odjavljen/a.`,
        visit: rezultat.visit,
        duration: {
          raw: rawMinutes,
          charged: roundedMinutes,
          hoursDeducted,
        },
        remainingHours: rezultat.remainingHours,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Greska na serveru.' });
    }
  }
);

// GET /api/visits/active - admin vidi svu decu koja su trenutno u igraonici
router.get(
  '/active',
  authorize('ADMIN', 'SUPERADMIN'),
  async (req, res) => {
    try {
      const visits = await prisma.visit.findMany({
        where: { status: 'CHECKED_IN' },
        include: {
          child: {
            include: {
              parent: { omit: { password: true } },
            },
          },
          userPackage: { include: { package: true } },
          checkedInBy: { omit: { password: true } },
        },
        orderBy: { checkedInAt: 'asc' },
      });

      // Dodaj koliko je svako dete vec u igraonici
      const now = new Date();
      const visitsWithDuration = visits.map((v) => ({
        ...v,
        currentDurationMinutes: Math.round((now - new Date(v.checkedInAt)) / 60000),
      }));

      res.json({ visits: visitsWithDuration, count: visits.length });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Greska na serveru.' });
    }
  }
);

// GET /api/visits/history - admin vidi istoriju poseta (filtrirano, paginirano)
router.get(
  '/history',
  authorize('ADMIN', 'SUPERADMIN'),
  async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const skip = (page - 1) * limit;
      const { childId, status, dateFrom, dateTo } = req.query;

      const where = {};
      if (childId) where.childId = childId;
      if (status) where.status = status;
      if (dateFrom || dateTo) {
        where.checkedInAt = {};
        if (dateFrom) where.checkedInAt.gte = new Date(dateFrom);
        if (dateTo) {
          const to = new Date(dateTo);
          to.setHours(23, 59, 59, 999);
          where.checkedInAt.lte = to;
        }
      }

      const [visits, total] = await Promise.all([
        prisma.visit.findMany({
          where,
          include: {
            child: true,
            userPackage: { include: { package: true } },
            checkedInBy: { omit: { password: true } },
            checkedOutBy: { omit: { password: true } },
          },
          orderBy: { checkedInAt: 'desc' },
          skip,
          take: limit,
        }),
        prisma.visit.count({ where }),
      ]);

      res.json({
        visits,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Greska na serveru.' });
    }
  }
);

// GET /api/visits/my - roditelj vidi posete svoje dece
router.get('/my', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const children = await prisma.child.findMany({
      where: { parentId: req.user.id },
      select: { id: true },
    });
    const childIds = children.map((c) => c.id);

    if (childIds.length === 0) {
      return res.json({ visits: [], pagination: { page, limit, total: 0, pages: 0 } });
    }

    const where = { childId: { in: childIds } };

    const [visits, total] = await Promise.all([
      prisma.visit.findMany({
        where,
        include: {
          child: true,
          userPackage: { include: { package: true } },
        },
        orderBy: { checkedInAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.visit.count({ where }),
    ]);

    res.json({
      visits,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Greska na serveru.' });
  }
});

// POST /api/visits/auto-close - zatvara sve otvorene posete (poziva se cron-om ili rucno)
router.post(
  '/auto-close',
  authorize('ADMIN', 'SUPERADMIN'),
  async (req, res) => {
    try {
      const openVisits = await prisma.visit.findMany({
        where: { status: 'CHECKED_IN' },
        include: { userPackage: true, child: true },
      });

      if (openVisits.length === 0) {
        return res.json({ message: 'Nema otvorenih poseta.', closed: 0 });
      }

      // `numericSetting` vraca podrazumevanu vrednost ako je u bazi nesto
      // neupotrebljivo. Naplata ne sme da zavisi od toga sta je neko upisao.
      const roundingMinutes = numericSetting('rounding_minutes', await getSetting('rounding_minutes'));
      const minimumChargeMinutes = numericSetting('minimum_charge_minutes', await getSetting('minimum_charge_minutes'));
      const now = new Date();

      const operations = [];

      for (const visit of openVisits) {
        const rawMinutes = Math.max(1, Math.round((now - new Date(visit.checkedInAt)) / 60000));
        const roundedMinutes = Math.max(minimumChargeMinutes, roundUpMinutes(rawMinutes, roundingMinutes));
        const hoursDeducted = roundedMinutes / 60;

        operations.push(
          prisma.visit.update({
            where: { id: visit.id },
            data: {
              checkedOutAt: now,
              durationMinutes: roundedMinutes,
              hoursDeducted,
              checkedOutById: req.user.id,
              status: 'AUTO_CLOSED',
            },
          })
        );

        if (visit.userPackage) {
          const currentHours = Number(visit.userPackage.remainingHours);
          const newHours = Math.max(0, currentHours - hoursDeducted);
          operations.push(
            prisma.userPackage.update({
              where: { id: visit.userPackage.id },
              data: { remainingHours: newHours },
            })
          );
        }
      }

      await prisma.$transaction(operations);

      res.json({
        message: `${openVisits.length} poseta automatski zatvoreno.`,
        closed: openVisits.length,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Greska na serveru.' });
    }
  }
);

module.exports = router;
