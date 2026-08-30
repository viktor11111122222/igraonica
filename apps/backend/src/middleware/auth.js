const jwt = require('jsonwebtoken');
const prisma = require('../config/db');

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ message: 'Niste prijavljeni.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({ where: { id: decoded.id } });

    if (!user) {
      return res.status(401).json({ message: 'Korisnik vise ne postoji.' });
    }

    // Deaktiviran nalog nije obrisan nalog - ista poruka za oba je izgledala
    // kao da je nalog nestao.
    if (!user.isActive) {
      return res.status(401).json({ message: 'Vas nalog je deaktiviran.' });
    }

    // Promena lozinke izbacuje uredjaje koji su ostali prijavljeni: token nosi
    // zig promene, pa se sve sto ne odgovara trenutnom stanju odbija.
    const zigNaloga = user.passwordChangedAt ? new Date(user.passwordChangedAt).getTime() : 0;
    if ((decoded.pwd ?? 0) !== zigNaloga) {
      return res.status(401).json({ message: 'Lozinka je promenjena. Prijavite se ponovo.' });
    }

    const { password, ...userWithoutPassword } = user;
    req.user = userWithoutPassword;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Nevazeci token.' });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Nemate dozvolu za ovu akciju.' });
    }
    next();
  };
};

module.exports = { protect, authorize };
