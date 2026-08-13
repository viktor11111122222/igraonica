const prisma = require('../src/config/db');
const bcrypt = require('bcryptjs');

const TEST_ADMIN = {
  email: 'testadmin@igraonica.com',
  password: 'admin123',
  firstName: 'Test',
  lastName: 'Admin',
  role: 'ADMIN',
};

const TEST_PARENT = {
  email: 'testparent@igraonica.com',
  password: 'parent123',
  firstName: 'Test',
  lastName: 'Roditelj',
  role: 'PARENT',
};

async function cleanDB() {
  // Treca brana (posle tests/env.js i jest.config.js): cleanDB brise sve, pa
  // se pred svako brisanje jos jednom proverava da je baza zaista testna.
  const dbName = (process.env.DATABASE_URL || '').split('/').pop().split('?')[0];
  if (!dbName.includes('test')) {
    throw new Error(
      `cleanDB odbija da obrise bazu "${dbName}" - ime baze mora da sadrzi "test".`
    );
  }

  await prisma.hourAdjustment.deleteMany();
  await prisma.visit.deleteMany();
  await prisma.userPackage.deleteMany();
  await prisma.child.deleteMany();
  await prisma.blogPost.deleteMany();
  await prisma.menuItem.deleteMany();
  await prisma.activity.deleteMany();
  await prisma.closedDay.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.setting.deleteMany();
  await prisma.package.deleteMany();
  await prisma.user.deleteMany();
}

async function createTestUser(data) {
  const hashedPassword = await bcrypt.hash(data.password, 4);
  return prisma.user.create({
    data: {
      email: data.email,
      password: hashedPassword,
      firstName: data.firstName,
      lastName: data.lastName,
      role: data.role || 'PARENT',
      phone: data.phone || null,
    },
  });
}

async function disconnectDB() {
  await prisma.$disconnect();
  await prisma._pool.end();
}

module.exports = {
  prisma,
  cleanDB,
  createTestUser,
  disconnectDB,
  TEST_ADMIN,
  TEST_PARENT,
};
