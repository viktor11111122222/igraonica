module.exports = {
  testMatch: ['**/tests/**/*.test.js'],
  // Namerno NIJE 'dotenv/config': to bi ucitalo .env, tj. razvojnu bazu, a
  // testovi brisu sve tabele. tests/env.js ucitava .env.test i proverava da
  // ime baze sadrzi "test".
  setupFiles: ['<rootDir>/tests/env.js'],
};
