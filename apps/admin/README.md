# admin — web admin panel

React + Vite panel koji osoblje igraonice koristi za svakodnevni rad. Prica sa
istim backendom kao mobilna aplikacija (`apps/backend`, `http://localhost:3001/api`).

## Pokretanje

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # produkcijski build u dist/
npm run preview  # posluzi build lokalno
```

Backend mora da radi (`cd ../backend && npm run dev`). Vite proksira `/api` i
`/uploads` na port 3001, pa u kodu nema hardkodovanog URL-a ni CORS-a.

## Prijava

Potreban je nalog sa ulogom `ADMIN` ili `SUPERADMIN` — roditeljski nalozi se
odbijaju odmah na prijavi. Ako u bazi nema nijednog admina:

```bash
cd ../backend && node -e "
require('dotenv').config();
const bcrypt = require('bcryptjs');
const prisma = require('./src/config/db');
bcrypt.hash('LOZINKA', 12)
  .then(p => prisma.user.upsert({
    where: { email: 'admin@igraonica.com' },
    update: { role: 'ADMIN', password: p },
    create: { email: 'admin@igraonica.com', password: p, firstName: 'Admin', lastName: 'Igraonica', role: 'ADMIN' },
  }))
  .then(() => console.log('ok'))
  .finally(() => process.exit(0));
"
```

Token se cuva u `localStorage`, a korisnik se pri svakom ucitavanju provera
preko `GET /api/auth/me` — rola je mogla da se promeni od poslednje prijave.

## Stranice

| Ruta | Sta radi |
|---|---|
| `/` | Statistike dana, grafikoni poseta i sati, poslednje aktivnosti |
| `/prijave` | Skener QR koda za prijavu/odjavu + lista dece koja su trenutno unutra |
| `/korisnici` | Nalozi roditelja i osoblja (pretraga, kreiranje, deaktivacija) |
| `/korisnici/:id` | Deca, paketi, dodela paketa, korekcija sati i istorija korekcija |
| `/deca` | Sva deca sa QR kodovima i alergijama |
| `/posete` | Istorija poseta sa filterima po statusu i datumu |
| `/paketi` | CRUD ponude paketa sati |
| `/rezervacije` | Rodjendani i proslave, potvrda i otkazivanje |
| `/jelovnik` | Unos obroka za celu nedelju odjednom (`POST /menu/bulk`) |
| `/raspored` | Nedeljne aktivnosti i jednokratni dogadjaji |
| `/blog` | Objave za roditelje, upload naslovne slike, objavljivanje |
| `/podesavanja` | Tema panela, pravila obracuna, podaci o igraonici, ponasanje mobilne aplikacije |

## Podesavanja

Katalog kljuceva zivi u `apps/backend/src/config/settings.js` — tamo se dodaje
novo podesavanje, a u `src/pages/Settings.jsx` samo njegov opis i tip polja.

Tri vrste:

- **Tema panela** (`system` / `light` / `dark`) je licna preferenca uredjaja i
  cuva se u `localStorage`, ne u bazi — drugi admin na drugom racunaru bira svoju.
- **Pravila obracuna** (`rounding_minutes`, `minimum_charge_minutes`) cita
  backend u trenutku odjave deteta.
- **Podaci o igraonici i ponasanje mobilne** su oznaceni kao javni i mobilna
  aplikacija ih cita sa `GET /api/settings/public` bez prijave. Menjaju se
  odmah kod roditelja, bez nove verzije aplikacije: naziv i kontakt, obavestenje
  na pocetnom ekranu, i koji tabovi se prikazuju (Paket i QR se ne mogu ugasiti).

Kljuc ne mora da postoji u bazi — dok nije sacuvan, prikazuje se podrazumevana
vrednost iz kataloga uz oznaku „podrazumevano". `PATCH` je upsert, pa prvo
cuvanje kreira zapis. Prazna vrednost je dozvoljena i znaci „nema" (obavestenje
se sakriva, telefon se ne prikazuje).

## Struktura

```
src/
  lib/api.js       jedina tacka za fetch; token, greske, upload
  lib/format.js    datumi, sati, cene, nazivi enum-a — sve u sr-RS
  hooks/useFetch.js  ucitavanje sa reload-om; menja se `path` -> refetch
  context/         AuthContext (prijava, /auth/me, provera role)
  components/      Layout (sidebar), ui.jsx (Modal, Field, Badge...), BarChart
  pages/           jedna datoteka po stranici iz tabele gore
```

## Boje

Tokeni u `styles.css` prate `apps/mobile/src/theme.js` da bi roditeljski i
admin deo izgledali kao isti proizvod.

Izuzetak su oznake na grafikonima: brend `#7c9fc9` i `#f8b653` padaju na
kontrastu prema beloj podlozi (2.67:1 i 1.73:1) i na hromi, pa grafikoni
koriste tamnije korake iste familije — `#2f6296` i `#9a6410`. Oni prolaze
provere kontrasta, hrome i razdvojivosti za daltoniste.
