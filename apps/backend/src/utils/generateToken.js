const jwt = require('jsonwebtoken');

// Koliko token vazi. Dve duzine, jer "Zapamti me" i obicna prijava nisu ista
// stvar: bez kvacice sesija traje jedan boravak (smena osoblja, jedno otvaranje
// aplikacije), sa kvacicom mesec dana.
//
// Duzi rok je svesno ogranicen - OWASP trajnu prijavu tretira kao poseban,
// dugovecan kredencijal koji mora da ima rok i mora da se moze povuci. Ovde se
// povlaci promenom lozinke (zig `pwd` ispod) ili deaktivacijom naloga.
const KRATKO = process.env.JWT_EXPIRES_IN || '12h';
const DUGO = process.env.JWT_REMEMBER_EXPIRES_IN || '30d';

// Token nosi i zig poslednje promene lozinke. `iat` za to nije dovoljan: on je
// u sekundama, pa token izdat u istoj sekundi u kojoj je lozinka promenjena ne
// bi mogao da se razlikuje od onih pre nje.
//
// Stari tokeni (izdati pre ovog pravila) nemaju `pwd`; kod naloga kojima
// lozinka nikad nije menjana to je i dalje 0, pa i dalje vaze.
const generateToken = (userId, passwordChangedAt = null, { rememberMe = false } = {}) => {
  return jwt.sign(
    { id: userId, pwd: passwordChangedAt ? new Date(passwordChangedAt).getTime() : 0 },
    process.env.JWT_SECRET,
    { expiresIn: rememberMe ? DUGO : KRATKO }
  );
};

module.exports = generateToken;
