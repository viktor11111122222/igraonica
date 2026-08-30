const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const { normalizujEmail } = require('../utils/email');

// Bez ovoga se lozinka moze pogadjati neograniceno: prijava je jedina ruta koja
// prima lozinku i jedina koja se moze napadati spolja.

const MINUT = 60 * 1000;

// Broje se samo NEUSPELE prijave, i to po nalogu (email + adresa). Uspesna
// prijava ne trosi pokusaje, pa radnik koji ceo dan ulazi i izlazi nikad ne
// udari u granicu, a onaj ko pogadja tudju lozinku udari posle deset promasaja.
const prijavaLimiter = rateLimit({
  windowMs: 15 * MINUT,
  limit: Number(process.env.LOGIN_RATE_LIMIT || 10),
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  // `ipKeyGenerator` sazima IPv6 na mrezu, da promena poslednjeg bloka adrese
  // ne bi bila zaobilaznica.
  keyGenerator: (req) => `${ipKeyGenerator(req.ip)}:${normalizujEmail(req.body?.email)}`,
  message: { message: 'Previse pokusaja prijave. Sacekajte 15 minuta pa probajte ponovo.' },
});

// Gruba brana za celu grupu ruta sa lozinkom (prijava, registracija, promena
// lozinke): jedna adresa ne moze da preplavi server pogadjanjem po raznim
// nalozima. Granica je visoka koliko da nikad ne smeta stvarnom radu.
const nalozimaLimiter = rateLimit({
  windowMs: 15 * MINUT,
  limit: Number(process.env.AUTH_RATE_LIMIT || 300),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Previse zahteva. Sacekajte pa probajte ponovo.' },
});

module.exports = { prijavaLimiter, nalozimaLimiter };
