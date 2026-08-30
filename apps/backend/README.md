# Backend igraonice

Express + Prisma + PostgreSQL, port 3001. Sluzi i panel (`apps/admin`) i mobilnu
aplikaciju (`apps/mobile`).

## Pokretanje

```bash
npm run dev        # nodemon na 3001
npm test           # Jest (uvek serijski, vidi nize)
npm run lint
npm run seed       # jelovnik i raspored
npm run seed:demo  # demo roditelji, deca, posete
```

## Baza i migracije

```bash
npx prisma migrate dev --name opis_izmene   # napravi i primeni migraciju
npx prisma generate                         # OBAVEZNO posle svake izmene seme
```

**`migrate dev` ovde ne regenerise klijenta.** Klijent se generise u
`src/generated/prisma` (custom `output` + `prisma.config.ts`), pa se posle svake
izmene seme mora pokrenuti i `npx prisma generate`. Bez toga `prisma.<model>`
ostane `undefined`, a testovi padnu sa `Cannot read properties of undefined` ili
`PrismaClientValidationError` na novoj koloni - greska ni jednom recju ne pominje
klijenta.

Testna baza se migrira zasebno:

```bash
DATABASE_URL=$(grep '^DATABASE_URL' .env.test | cut -d'"' -f2) npx prisma migrate deploy
```

Preimenovanje kolone se pise rucno (`--create-only`, pa `ALTER TABLE ... RENAME
COLUMN`): Prisma za promenu imena predlaze brisanje i dodavanje kolone, sto
odnosi podatke.

## Testovi

Svi testovi dele istu bazu i svaka grupa je brise pre sebe, pa moraju da idu
jedan po jedan. To je zakljucano na dva mesta (`maxWorkers: 1` u
`jest.config.js` i `--runInBand` u `npm test`), a `tests/env.js` odbija da
pokrene testove ako ime baze ne sadrzi "test".

## Podesavanja okruzenja

| Promenljiva | Sta radi |
|---|---|
| `DATABASE_URL` | veza ka bazi |
| `JWT_SECRET`, `JWT_EXPIRES_IN` | potpis i rok tokena |
| `PORT` | podrazumevano 3001 |
| `CORS_ORIGINS` | zarezom razdvojene adrese panela; prazno = sve (razvoj) |
| `LOGIN_RATE_LIMIT` | promasenih prijava po nalogu na 15 min (podrazumevano 10) |
| `AUTH_RATE_LIMIT` | zahteva ka `/api/auth` po adresi na 15 min (podrazumevano 300) |
| `PUSH_ENABLED` | `true` ukljucuje slanje push obavestenja (podrazumevano ugaseno) |
| `EXPO_PUSH_URL` | adresa Expo push servisa (za testove i sopstveni relej) |

## Obavestenja na zakljucanom ekranu (push)

Zvonce u aplikaciji radi uvek - obavestenja se upisuju u bazu pri svakoj radnji.
Push je dodatni put do roditelja i ide preko Expo servisa:

1. Aplikacija pri prijavi trazi dozvolu i salje token kroz `PATCH /auth/profile`
   (`src/utils/push.js` u `apps/mobile`).
2. Server pri svakom obavestenju salje poruku na tokene tih korisnika
   (`src/services/push.js`).

Da bi push stvarno stizao, potrebno je jos:

- EAS projekat (`extra.eas.projectId` u `app.json`) - bez njega uredjaj ne moze
  ni da dobije token;
- kredencijali: FCM V1 za Android i APNs kljuc za iOS, kroz `eas credentials`;
- build aplikacije sa tim podesavanjima (na simulatoru iOS push ne radi uopste);
- `PUSH_ENABLED=true` na serveru.

Dok to nije podeseno, sve radi kao i pre: obavestenja stoje u aplikaciji, a
slanje miruje (`posalji()` odmah izadje). Token uredjaja sa kog je aplikacija
obrisana server sam brise kad Expo javi `DeviceNotRegistered`.

## Sta gde stoji

- `src/routes` - rute po celinama; admin rute imaju `authorize('ADMIN', 'SUPERADMIN')`
- `src/services/notifications.js` - obavestenja (nikad ne obaraju radnju povodom koje nastaju)
- `src/utils/naplata.js` - racunica naplate boravka (puni sati, prag preko sata)
- `src/config/settings.js` - katalog podesavanja, jedini izvor kljuceva
