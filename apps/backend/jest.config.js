module.exports = {
  // Svi testovi dele istu bazu i svaka grupa je brise pre sebe. U vise radnika
  // odjednom brisu jedni drugima podatke, pa padne skoro sve. `npm test` je i
  // ranije slao --runInBand; ovim isto vazi i za `npx jest` pokrenut rucno.
  maxWorkers: 1,
  testMatch: ['**/tests/**/*.test.js'],
  // Namerno NIJE 'dotenv/config': to bi ucitalo .env, tj. razvojnu bazu, a
  // testovi brisu sve tabele. tests/env.js ucitava .env.test i proverava da
  // ime baze sadrzi "test".
  setupFiles: ['<rootDir>/tests/env.js'],
};
