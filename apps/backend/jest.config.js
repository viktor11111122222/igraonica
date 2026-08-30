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
  // Podrazumevanih 5s je tesno za testove koji stvarno idu na bazu: dok je
  // masina zauzeta necim drugim (build, simulator), poneki prekoraci limit i
  // padne bez ikakve veze sa kodom.
  testTimeout: 20000,
};
