const express = require('express');
const prisma = require('../config/db');
const { protect, authorize } = require('../middleware/auth');
const { numericSetting } = require('../config/settings');
const { naplativiSati } = require('../utils/naplata');
const obavestenja = require('../services/notifications');

const router = express.Router();

router.use(protect);

async function getSetting(key, fallback) {
  const setting = await prisma.setting.findUnique({ where: { key } });
  return setting ? setting.value : fallback;
}

// `numericSetting` vraca podrazumevanu vrednost kad je u bazi nesto
// neupotrebljivo. Naplata ne sme da zavisi od toga sta je neko upisao.
async function pragMinuta() {
  return numericSetting('hour_grace_minutes', await getSetting('hour_grace_minutes'));
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
      //
      // Dete ulazi i kad paketa nema. Boravak se tada pri odjavi upisuje
      // roditelju u minus sate - radnik na pultu ne vraca dete zbog naplate.
      const activePackage = findActivePackage(child.parent.userPackages);

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
            userPackageId: activePackage ? activePackage.id : null,
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

      await obavestenja.detePrijavljeno({ child, visit, byUserId: req.user.id });

      res.status(201).json({
        message: `${child.firstName} ${child.lastName} je prijavljen/a.`,
        visit,
        remainingHours: activePackage ? Number(activePackage.remainingHours) : 0,
        // Radnik mora da vidi na traci ishoda da ovaj boravak ide u minus.
        withoutPackage: !activePackage,
        debtHours: Number(child.parent.debtHours),
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

      // 4. Naplata: puni sati, sa pragom minuta preko punog sata
      const hoursDeducted = naplativiSati(rawMinutes, await pragMinuta());
      const roundedMinutes = hoursDeducted * 60;

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

        // Koliko je paket stvarno pokrio. Stanje pre izmene se cita u istom
        // upitu (`FOR UPDATE` drzi red do kraja transakcije) - da se cita
        // posebno pa upisuje, dve odjave nad istim paketom bi se pregazile.
        let pokriveno = 0;
        if (openVisit.userPackageId) {
          const [red] = await tx.$queryRaw`
            UPDATE user_packages up
               SET remaining_hours = GREATEST(0, up.remaining_hours - ${hoursDeducted}::numeric),
                   updated_at = NOW()
              FROM (
                SELECT id, remaining_hours AS pre
                  FROM user_packages
                 WHERE id = ${openVisit.userPackageId}
                   FOR UPDATE
              ) s
             WHERE up.id = s.id
            RETURNING s.pre AS pre, up.remaining_hours AS posle
          `;
          if (red) pokriveno = Number(red.pre) - Number(red.posle);
        }

        // Ostatak ide roditelju u minus. Bez paketa je to ceo boravak, a sa
        // paketom koji nije dogurao do kraja - samo razlika.
        const uMinus = Math.max(0, hoursDeducted - pokriveno);
        let dugUkupno = 0;

        if (uMinus > 0) {
          const [korisnik] = await tx.$queryRaw`
            UPDATE users
               SET debt_hours = debt_hours + ${uMinus}::numeric,
                   updated_at = NOW()
             WHERE id = ${child.parentId}
            RETURNING debt_hours
          `;
          dugUkupno = korisnik ? Number(korisnik.debt_hours) : 0;

          await tx.visit.update({
            where: { id: openVisit.id },
            data: { debtHours: uMinus },
          });
        } else {
          // Odjava je trenutak kad je roditelj na pultu, pa se stanje minusa
          // vraca i kad ga ova poseta nije menjala - radnik ima sta da naplati.
          const korisnik = await tx.user.findUnique({
            where: { id: child.parentId },
            select: { debtHours: true },
          });
          dugUkupno = Number(korisnik?.debtHours || 0);
        }

        const visit = await tx.visit.findUnique({
          where: { id: openVisit.id },
          include: { child: true, userPackage: { include: { package: true } } },
        });

        return {
          visit,
          remainingHours: visit.userPackage ? Number(visit.userPackage.remainingHours) : 0,
          uMinus,
          dugUkupno,
        };
      });

      if (!rezultat) {
        return res.status(400).json({ message: 'Dete nije prijavljeno u igraonici.' });
      }

      await obavestenja.deteOdjavljeno({
        child,
        visit: rezultat.visit,
        chargedMinutes: roundedMinutes,
        remainingHours: rezultat.remainingHours,
        debtHours: rezultat.dugUkupno,
        byUserId: req.user.id,
      });

      res.json({
        message: `${child.firstName} ${child.lastName} je odjavljen/a.`,
        visit: rezultat.visit,
        duration: {
          raw: rawMinutes,
          charged: roundedMinutes,
          hoursDeducted,
        },
        remainingHours: rezultat.remainingHours,
        // Koliko je ova poseta dodala u minus i koliko roditelj sada duguje.
        debtAdded: rezultat.uMinus,
        debtHours: rezultat.dugUkupno,
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

      const prag = await pragMinuta();
      const now = new Date();

      const operations = [];
      // Dvoje dece istog roditelja trose isti paket, pa stanje paketa ide kroz
      // petlju. Da se svaka poseta racuna od pocetnog broja, druga izmena bi
      // pregazila prvu i sati bi se skinuli samo za jedno dete.
      const stanjePaketa = new Map();
      const dugPoRoditelju = new Map();

      for (const visit of openVisits) {
        const rawMinutes = Math.max(1, Math.round((now - new Date(visit.checkedInAt)) / 60000));
        const hoursDeducted = naplativiSati(rawMinutes, prag);
        const roundedMinutes = hoursDeducted * 60;

        let pokriveno = 0;
        if (visit.userPackage) {
          const pre = stanjePaketa.has(visit.userPackage.id)
            ? stanjePaketa.get(visit.userPackage.id)
            : Number(visit.userPackage.remainingHours);
          pokriveno = Math.min(pre, hoursDeducted);
          stanjePaketa.set(visit.userPackage.id, pre - pokriveno);
        }

        // Sto paket nije pokrio ide roditelju u minus - i kad paketa nema, i
        // kad je ostao kraci od boravka.
        const uMinus = Math.max(0, hoursDeducted - pokriveno);
        if (uMinus > 0) {
          const dosad = dugPoRoditelju.get(visit.child.parentId) || 0;
          dugPoRoditelju.set(visit.child.parentId, dosad + uMinus);
        }

        operations.push(
          prisma.visit.update({
            where: { id: visit.id },
            data: {
              checkedOutAt: now,
              durationMinutes: roundedMinutes,
              hoursDeducted,
              debtHours: uMinus > 0 ? uMinus : null,
              checkedOutById: req.user.id,
              status: 'AUTO_CLOSED',
            },
          })
        );
      }

      for (const [userPackageId, preostalo] of stanjePaketa) {
        operations.push(
          prisma.userPackage.update({
            where: { id: userPackageId },
            data: { remainingHours: preostalo },
          })
        );
      }

      for (const [parentId, sati] of dugPoRoditelju) {
        operations.push(prisma.$executeRaw`
          UPDATE users
             SET debt_hours = debt_hours + ${sati}::numeric,
                 updated_at = NOW()
           WHERE id = ${parentId}
        `);
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
