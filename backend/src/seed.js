require('dotenv').config();
const bcrypt = require('bcryptjs');
const prisma = require('./config/db');

const seed = async () => {
  const existingAdmin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  if (existingAdmin) {
    console.log('Admin vec postoji:', existingAdmin.email);
    process.exit(0);
  }

  const hashedPassword = await bcrypt.hash('admin123', 12);

  const admin = await prisma.user.create({
    data: {
      email: 'admin@igraonica.com',
      password: hashedPassword,
      firstName: 'Admin',
      lastName: 'Igraonica',
      role: 'ADMIN',
    },
  });

  console.log('Admin kreiran:', admin.email);
  console.log('Lozinka: admin123');

  await prisma.setting.createMany({
    data: [
      { key: 'closing_time', value: '21:00', description: 'Vreme zatvaranja igraonice' },
      { key: 'rounding_minutes', value: '15', description: 'Zaokruzivanje minuta pri checkout-u' },
      { key: 'minimum_charge_minutes', value: '30', description: 'Minimalna naplata u minutima' },
      { key: 'app_name', value: 'Kids Club', description: 'Naziv aplikacije' },
      { key: 'contact_phone', value: '', description: 'Kontakt telefon' },
      { key: 'address', value: '', description: 'Adresa igraonice' },
    ],
  });

  console.log('Podesavanja kreirana.');
  process.exit(0);
};

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
