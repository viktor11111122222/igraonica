// Testovi brisu sve tabele (cleanDB), pa NIKAD ne smeju da gadjaju razvojnu
// bazu. Zato se ovde ucitava .env.test umesto .env, i to pre nego sto bilo koji
// modul dodirne process.env.DATABASE_URL.
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env.test') });

const url = process.env.DATABASE_URL || '';

// Druga brana: cak i ako .env.test nestane ili neko promeni konfiguraciju,
// testovi padaju umesto da obrisu podatke. Ime baze mora da sadrzi "test".
const dbName = url.split('/').pop().split('?')[0];

if (!dbName.includes('test')) {
  throw new Error(
    `Testovi odbijaju da se pokrenu nad bazom "${dbName}": ime baze mora da ` +
      'sadrzi "test" jer testovi brisu sve tabele. Proveri apps/backend/.env.test'
  );
}
