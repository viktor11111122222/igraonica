const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const prisma = require('../config/db');
const generateToken = require('../utils/generateToken');
const { normalizujEmail, poEmailu } = require('../utils/email');
const obavestenja = require('../services/notifications');
const { protect } = require('../middleware/auth');
const { prijavaLimiter } = require('../middleware/rateLimit');

const router = express.Router();

// POST /api/auth/register
router.post(
  '/register',
  [
    body('email').trim().isEmail().withMessage('Unesite validan email.'),
    body('password').isLength({ min: 6 }).withMessage('Lozinka mora imati najmanje 6 karaktera.'),
    body('firstName').notEmpty().withMessage('Ime je obavezno.'),
    body('lastName').notEmpty().withMessage('Prezime je obavezno.'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { password, firstName, lastName, phone } = req.body;
      const email = normalizujEmail(req.body.email);

      const existingUser = await prisma.user.findFirst({ where: poEmailu(email) });
      if (existingUser) {
        return res.status(400).json({ message: 'Korisnik sa ovim emailom vec postoji.' });
      }

      const hashedPassword = await bcrypt.hash(password, 12);

      const user = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          firstName,
          lastName,
          phone,
        },
      });

      const token = generateToken(user.id, user.passwordChangedAt);
      const { password: _, ...userWithoutPassword } = user;

      // Osoblje inace ne bi videlo nov nalog dok samo ne otvori spisak.
      await obavestenja.roditeljSeRegistrovao({ user });

      res.status(201).json({ token, user: userWithoutPassword });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Greska na serveru.' });
    }
  }
);

// POST /api/auth/login
router.post(
  '/login',
  prijavaLimiter,
  [
    body('email').trim().isEmail().withMessage('Unesite validan email.'),
    body('password').notEmpty().withMessage('Lozinka je obavezna.'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { password } = req.body;

      const user = await prisma.user.findFirst({ where: poEmailu(req.body.email) });
      if (!user) {
        return res.status(401).json({ message: 'Pogresan email ili lozinka.' });
      }

      if (!user.isActive) {
        return res.status(401).json({ message: 'Vas nalog je deaktiviran.' });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).json({ message: 'Pogresan email ili lozinka.' });
      }

      const token = generateToken(user.id, user.passwordChangedAt);
      const { password: _, ...userWithoutPassword } = user;

      res.json({ token, user: userWithoutPassword });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Greska na serveru.' });
    }
  }
);

// GET /api/auth/me
router.get('/me', protect, async (req, res) => {
  res.json({ user: req.user });
});

// PATCH /api/auth/profile
router.patch(
  '/profile',
  protect,
  [
    body('firstName').optional().notEmpty().withMessage('Ime ne moze biti prazno.'),
    body('lastName').optional().notEmpty().withMessage('Prezime ne moze biti prazno.'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const allowedFields = ['firstName', 'lastName', 'phone', 'avatarUrl', 'pushToken'];
      const data = {};
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          data[field] = req.body[field];
        }
      }

      const user = await prisma.user.update({
        where: { id: req.user.id },
        data,
      });

      const { password: _, ...userWithoutPassword } = user;
      res.json({ user: userWithoutPassword });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Greska na serveru.' });
    }
  }
);

// POST /api/auth/change-password
router.post(
  '/change-password',
  protect,
  [
    body('currentPassword').notEmpty().withMessage('Trenutna lozinka je obavezna.'),
    body('newPassword').isLength({ min: 6 }).withMessage('Nova lozinka mora imati najmanje 6 karaktera.'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { currentPassword, newPassword } = req.body;

      const user = await prisma.user.findUnique({ where: { id: req.user.id } });

      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        return res.status(400).json({ message: 'Trenutna lozinka nije tacna.' });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 12);

      const izmenjen = await prisma.user.update({
        where: { id: req.user.id },
        data: { password: hashedPassword, passwordChangedAt: new Date() },
      });

      // Nov token nosi nov zig: uredjaj sa kog je lozinka promenjena ostaje
      // prijavljen, svi ostali ispadaju.
      const token = generateToken(izmenjen.id, izmenjen.passwordChangedAt);
      res.json({ token, message: 'Lozinka je uspesno promenjena.' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Greska na serveru.' });
    }
  }
);

// DELETE /api/auth/me
// Brisanje sopstvenog naloga. Nepovratno i stvarno brise red iz baze - zato
// trazi lozinku, iako je zahtev vec autorizovan tokenom: token moze da ostane
// otvoren na tudjem racunaru, a ovo je jedina radnja koja se ne moze vratiti.
router.delete(
  '/me',
  protect,
  [body('password').notEmpty().withMessage('Lozinka je obavezna.')],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const user = await prisma.user.findUnique({ where: { id: req.user.id } });
      if (!user) {
        return res.status(404).json({ message: 'Korisnik nije pronadjen.' });
      }

      const isMatch = await bcrypt.compare(req.body.password, user.password);
      if (!isMatch) {
        return res.status(400).json({ message: 'Lozinka nije tacna.' });
      }

      // Panel bez ijednog administratora se ne moze vratiti kroz aplikaciju -
      // ni da se doda nov nalog, ni da se nekom podigne uloga.
      if (user.role === 'ADMIN' || user.role === 'SUPERADMIN') {
        const ostaliAdmini = await prisma.user.count({
          where: {
            id: { not: user.id },
            role: { in: ['ADMIN', 'SUPERADMIN'] },
            isActive: true,
          },
        });
        if (ostaliAdmini === 0) {
          return res.status(409).json({
            message:
              'Vi ste jedini administrator. Postavite drugog administratora pa tek onda obrisite svoj nalog.',
          });
        }
      }

      // Posete dece se brisu rucno: Child ide u kaskadi za roditeljem, ali
      // Visit.child je obavezna veza pa bi kaskada pukla na stranom kljucu.
      // Osoblje ovde nema sta da izgubi - njihove prijave tudje dece ostaju,
      // samo bez imena onoga ko ih je uneo.
      await prisma.$transaction([
        prisma.visit.deleteMany({ where: { child: { parentId: user.id } } }),
        prisma.user.delete({ where: { id: user.id } }),
      ]);

      res.json({ message: 'Nalog je obrisan.' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Greska na serveru.' });
    }
  }
);

module.exports = router;
