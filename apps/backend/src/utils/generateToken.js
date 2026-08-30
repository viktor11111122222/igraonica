const jwt = require('jsonwebtoken');

// Token nosi i zig poslednje promene lozinke. `iat` za to nije dovoljan: on je
// u sekundama, pa token izdat u istoj sekundi u kojoj je lozinka promenjena ne
// bi mogao da se razlikuje od onih pre nje.
//
// Stari tokeni (izdati pre ovog pravila) nemaju `pwd`; kod naloga kojima
// lozinka nikad nije menjana to je i dalje 0, pa i dalje vaze.
const generateToken = (userId, passwordChangedAt = null) => {
  return jwt.sign(
    { id: userId, pwd: passwordChangedAt ? new Date(passwordChangedAt).getTime() : 0 },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  );
};

module.exports = generateToken;
