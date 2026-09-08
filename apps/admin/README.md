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
| `/korisnici/:id` | Deca, paketi, dodela paketa, korekcija sati, istorija korekcija i naplata minus sati |
| `/deca` | Sva deca sa QR kodovima i alergijama |
| `/posete` | Istorija poseta sa filterima po statusu i datumu |
| `/paketi` | CRUD ponude paketa sati |
| `/rezervacije` | Rodjendani, proslave, grupne posete i mesecni dogadjaji; potvrda i otkazivanje. Tip se bira iz spiska ili se upisuje rucno pod "Drugo" |
| `/dogadjaji` | Interna evidencija dogadjaja, ista polja kao rezervacije ali samo za osoblje (`/api/events` nema javnu rutu). Tip se bira iz spiska ili se upisuje rucno pod "Drugo" |
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
- **Pravilo obracuna** (`hour_grace_minutes`) cita backend u trenutku odjave
  deteta. Naplata ide u punim satima: minuti preko punog sata se ne naplacuju
  do praga (podrazumevano 15), a preko praga povlace ceo sat — 1h 15min je
  1 sat, 1h 16min su 2 sata. Svaki boravak je najmanje 1 sat.
- **Podaci o igraonici i ponasanje mobilne** su oznaceni kao javni i mobilna
  aplikacija ih cita sa `GET /api/settings/public` bez prijave. Menjaju se
  odmah kod roditelja, bez nove verzije aplikacije: naziv i kontakt, obavestenje
  na pocetnom ekranu, i koji tabovi se prikazuju (Paket i QR se ne mogu ugasiti).

Kljuc ne mora da postoji u bazi — dok nije sacuvan, prikazuje se podrazumevana
vrednost iz kataloga uz oznaku „podrazumevano". `PATCH` je upsert, pa prvo
cuvanje kreira zapis. Prazna vrednost je dozvoljena i znaci „nema" (obavestenje
se sakriva, telefon se ne prikazuje).

## Skeniranje QR koda

Kod deteta ima fiksan oblik: `IGR-` i osam heksadecimalnih znakova, uvek 12.
Ekran Prijave prima ga na tri nacina, i sva tri rade isto:

| Nacin | Sta treba |
|---|---|
| Kamera telefona | HTTPS sa sertifikatom kojem uredjaj veruje (vidi ispod) |
| Rucni citac | 2D imager u HID-KBW rezimu |
| Kucanje | nista |

**Smer se ne bira.** Prvo skeniranje deteta ga prijavljuje, sledece odjavljuje —
ekran to zna iz spiska prisutnih, pa nema prekidaca koji se moze zaboraviti.
Isto stanje vidi i roditelj u aplikaciji, iznad svog QR koda.

Dete moze imati najvise **jednu otvorenu posetu**, i to cuva delimicni
jedinstveni indeks u bazi (`visits_one_open_per_child`) — ne provera u kodu.
Dva skeniranja u istom trenutku (dva radnika, dupli dodir) zato ne mogu da
naprave dve posete, a ni da naplate istu dvaput.

### Rucni citac

Citac se racunaru predstavlja kao tastatura i "otkuca" kod za nekoliko
milisekundi. Zavrsni znak mu je podesiv (Enter, Tab, ili nista), pa ga
`useHardwareScanner` ne ceka — kraj prepoznaje po obliku koda. Zato radi u sve
tri postavke, i kada fokus nije u polju.

Ako ne radi, proveri redom:

1. **Mora biti 2D imager.** Laserski citac (crvena linija) fizicki ne moze da
   procita QR — cita samo crticne kodove.
2. **Mora biti u HID-KBW rezimu**, ne serial/POS. Prebacuje se skeniranjem
   konfiguracionog koda iz uputstva citaca.
3. **Mora umeti da cita sa ekrana telefona.** Stariji imageri to ne mogu.

Raspored tastature nije problem: `0-9`, `A-F` i `-` su na istom mestu na US
QWERTY i srpskom QWERTZ rasporedu.

### Kamera na telefonu

WebKit trazi **validan** sertifikat za `getUserMedia`. Bez njega Safari ne
postavi ni `navigator.mediaDevices` — nema greske, skener prosto cuti. Zato
`http://<ip>:5173` nikad nece dobiti kameru, a ni samopotpisan sertifikat koji
je korisnik "propustio" kroz upozorenje.

Isti sertifikat resava i drugu stvar: **pregledac pamti dozvolu za kameru samo
za origin kome veruje.** Ako se upozorenje o sertifikatu preskace rucno, pitanje
"would like to access the camera" vraca se pri svakoj poseti — koliko god puta
radnik potvrdio.

Origin je i ime, ne samo adresa. LAN adresa se menja (druga mreza, hotspot,
DHCP) i sa njom se gubi zapamcena dozvola, pa sertifikat pokriva i
`<ime-racunara>.local`. **Na telefonu treba otvarati bas to ime**, ne IP.

```bash
# Sertifikat (CA se pravi samo prvi put) pa dev server preko HTTPS-a
npm run dev:https
```

Skripta ispise tacnu adresu i putanju do CA. Zatim na telefonu, **jednom**:

1. Otvori `rootCA.crt` (npr. `python3 -m http.server 8000` u fascikli sa
   sertifikatima, pa `http://<ip>:8000/rootCA.crt`) → Allow
2. Settings → General → VPN & Device Management → instaliraj profil
3. Settings → General → About → **Certificate Trust Settings** → ukljuci ga

Bez treceg koraka profil je instaliran ali sertifikat i dalje nije od
poverenja — a to je tacno stanje u kome se dozvola za kameru ne pamti.

**Safari pita iznova i kad je sertifikat ispravan**, jer je podrazumevano
"Ask" po poseti. Da bi pitanje nestalo zauvek:

- Settings → Safari → Camera → **Allow**, ili
- na samoj stranici: `aA` u traci adrese → Website Settings → Camera → **Allow**

Za Chrome na telefonu isto vazi: dozvola se pamti tek kad sertifikat prodje bez
upozorenja.

Sertifikat vazi 397 dana i vezan je za trenutnu LAN adresu i ime racunara;
`npm run cert` ga izdaje ponovo (CA ostaje isti, telefon ne mora nista da radi
ponovo). Vite ga cita samo pri pokretanju. Putanju menja `SSL_CERT_DIR`.

U simulator se isti CA ubacuje jednom komandom:

```bash
xcrun simctl keychain booted add-root-cert ~/.local/share/igraonica-dev-certs/rootCA.crt
```

## Obavestenja

Zvono u zaglavlju svake stranice. Broji neprocitana, klik otvara spisak.

Osoblje dobija ono sto se desi **van panela** — roditelj otvori nalog, doda ili
ukloni dete, ili drugi radnik prijavi dete na drugoj stanici. Ko je sam izvrsio
radnju ne dobija obavestenje o njoj: ishod mu je vec na ekranu, a feed bi se
punio sopstvenim klikovima.

Roditelj u aplikaciji dobija ono sto se tice njega: dete je uslo, dete je
izaslo (sa naplatom i preostalim satima), dobio je paket, ispravljeni su mu
sati.

Zapis je po primaocu, ne po dogadjaju — jedna prijava deteta pravi obavestenje
za roditelja i po jedno za svakog admina, sa razlicitim tekstom. Tako svako ima
svoje "procitano".

**Ovo nisu push obavestenja.** Vide se kada je aplikacija otvorena (osvezava se
na 15 s u aplikaciji, 30 s u panelu). Za obavestenje na zakljucanom ekranu
iPhone-a treba `expo-notifications`, nativni build i **placen Apple Developer
nalog** za APNs kljuc. Kolona `users.push_token` i katalog dogadjaja su vec tu,
pa se push kaci na isto kada nalog postoji.

## Struktura

```
src/
  lib/api.js               jedina tacka za fetch; token, greske, upload, 401
  lib/format.js            datumi, sati, cene, nazivi enum-a — sve u sr-RS
  hooks/useFetch.js        ucitavanje sa reload-om; menja se `path` -> refetch
  hooks/useActiveVisits.js ko je u igraonici; jedan tajmer za traku i Prijave
  hooks/useHardwareScanner.js  rucni citac kao tastatura, na nivou prozora
  context/                 AuthContext (prijava, /auth/me, provera role),
                           ThemeContext (svetla/tamna/sistemska)
  components/              Layout (sidebar + fioka), ui.jsx (Modal, Field,
                           Badge...), BarChart, QrScanner, ClosedDays
  pages/                   jedna datoteka po stranici iz tabele gore

vite.config.js         obican dev server
vite.config.https.js   isti, ali preko HTTPS-a — za skener na telefonu
eslint.config.js       `npm run lint`
```

## Boje

Tokeni u `styles.css` prate `apps/mobile/src/theme.js` da bi roditeljski i
admin deo izgledali kao isti proizvod.

Izuzetak su oznake na grafikonima: brend `#7c9fc9` i `#f8b653` padaju na
kontrastu prema beloj podlozi (2.67:1 i 1.73:1) i na hromi, pa grafikoni
koriste tamnije korake iste familije — `#2f6296` i `#9a6410`. Oni prolaze
provere kontrasta, hrome i razdvojivosti za daltoniste.
