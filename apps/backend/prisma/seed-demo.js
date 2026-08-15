// Puni bazu realnim primerima, da panel ne bude prazan dok se radi na njemu.
//
// Pokretanje:  npm run seed:demo
//
// Sta dira, a sta ne:
//   - NE dira admin naloge. Tvoj nalog ostaje kakav jeste.
//   - Demo roditelji imaju email na @primer.rs. Njih i sve njihovo (deca,
//     paketi, posete) brise i pravi iznova, pa skripta moze da se pokrece
//     vise puta bez duplikata.
//   - Postojeceg roditelja test@test.com samo preimenuje u pravo ime i dopuni
//     mu podatke. Email i lozinka ostaju isti, da prijava u mobilnoj
//     aplikaciji nastavi da radi.
//   - Jelovnik i raspored ne dira (za njih je `npm run seed`).
//
// Lozinka svih demo roditelja: lozinka123
require('dotenv').config();

const bcrypt = require('bcryptjs');
const prisma = require('../src/config/db');
const { startOfDay, addDays } = require('../src/utils/day');

const DEMO_DOMEN = '@primer.rs';
const LOZINKA = 'lozinka123';

// Roditelj koji vec postoji i cija se prijava cuva.
const POSTOJECI_EMAIL = 'test@test.com';

const PAKETI = [
  { name: 'Paket 10 sati', totalHours: 10, validityDays: 60, description: 'Za povremene dolaske.' },
  { name: 'Paket 15 sati', totalHours: 15, validityDays: 90, description: 'Najcesci izbor.' },
  { name: 'Paket 20 sati', totalHours: 20, validityDays: 90, description: 'Za redovne posetioce.' },
  { name: 'Paket 30 sati', totalHours: 30, validityDays: 120, description: 'Najpovoljniji po satu.' },
];

// Porodice. `stanje` odredjuje kako ce paket izgledati u panelu, da se vide
// svi slucajevi a ne samo "sve je u redu".
const PORODICE = [
  {
    email: POSTOJECI_EMAIL,
    firstName: 'Jelena',
    lastName: 'Petrovic',
    phone: '060 123 4567',
    paket: 'Paket 15 sati',
    stanje: 'delimicno',
    deca: [], // vec postoje u bazi, ne diraju se
  },
  {
    email: 'milos.jovanovic' + DEMO_DOMEN,
    firstName: 'Milos',
    lastName: 'Jovanovic',
    phone: '063 244 1180',
    paket: 'Paket 20 sati',
    stanje: 'delimicno',
    deca: [
      { firstName: 'Sofija', lastName: 'Jovanovic', rodjena: '2020-03-18', pol: 'FEMALE' },
      { firstName: 'Vuk', lastName: 'Jovanovic', rodjena: '2018-07-02', pol: 'MALE', napomena: 'Voli da crta, tesko se odvaja pri dolasku.' },
    ],
  },
  {
    email: 'ivana.nikolic' + DEMO_DOMEN,
    firstName: 'Ivana',
    lastName: 'Nikolic',
    phone: '064 511 3390',
    paket: 'Paket 10 sati',
    stanje: 'skoro potrosen',
    deca: [
      { firstName: 'Teodora', lastName: 'Nikolic', rodjena: '2021-11-24', pol: 'FEMALE', alergije: 'Orasasti plodovi' },
    ],
  },
  {
    email: 'nikola.djordjevic' + DEMO_DOMEN,
    firstName: 'Nikola',
    lastName: 'Djordjevic',
    phone: '061 907 2245',
    paket: 'Paket 30 sati',
    stanje: 'nov',
    deca: [
      { firstName: 'Filip', lastName: 'Djordjevic', rodjena: '2019-01-30', pol: 'MALE' },
      { firstName: 'Nina', lastName: 'Djordjevic', rodjena: '2022-05-14', pol: 'FEMALE', alergije: 'Mleko' },
    ],
  },
  {
    email: 'ana.stankovic' + DEMO_DOMEN,
    firstName: 'Ana',
    lastName: 'Stankovic',
    phone: '062 330 7781',
    paket: 'Paket 15 sati',
    stanje: 'potrosen',
    deca: [
      { firstName: 'Mihajlo', lastName: 'Stankovic', rodjena: '2020-09-09', pol: 'MALE' },
    ],
  },
  {
    email: 'marija.ilic' + DEMO_DOMEN,
    firstName: 'Marija',
    lastName: 'Ilic',
    phone: '065 118 4402',
    paket: 'Paket 20 sati',
    stanje: 'delimicno',
    deca: [
      { firstName: 'Dunja', lastName: 'Ilic', rodjena: '2021-06-21', pol: 'FEMALE' },
      { firstName: 'Lazar', lastName: 'Ilic', rodjena: '2023-02-11', pol: 'MALE', napomena: 'Spava posle rucka, oko 13h.' },
    ],
  },
  {
    email: 'stefan.pavlovic' + DEMO_DOMEN,
    firstName: 'Stefan',
    lastName: 'Pavlovic',
    phone: '060 774 9013',
    paket: 'Paket 10 sati',
    stanje: 'istekao',
    deca: [
      { firstName: 'Petar', lastName: 'Pavlovic', rodjena: '2018-12-05', pol: 'MALE' },
    ],
  },
  {
    email: 'katarina.markovic' + DEMO_DOMEN,
    firstName: 'Katarina',
    lastName: 'Markovic',
    phone: '063 615 2278',
    paket: 'Paket 15 sati',
    stanje: 'nov',
    deca: [
      { firstName: 'Iva', lastName: 'Markovic', rodjena: '2022-08-17', pol: 'FEMALE', alergije: 'Gluten' },
    ],
  },
  {
    email: 'dragan.simic' + DEMO_DOMEN,
    firstName: 'Dragan',
    lastName: 'Simic',
    phone: '064 208 6634',
    paket: 'Paket 30 sati',
    stanje: 'delimicno',
    deca: [
      { firstName: 'Uros', lastName: 'Simic', rodjena: '2019-04-26', pol: 'MALE' },
      { firstName: 'Andjela', lastName: 'Simic', rodjena: '2021-10-08', pol: 'FEMALE' },
    ],
  },
  {
    email: 'milica.ristic' + DEMO_DOMEN,
    firstName: 'Milica',
    lastName: 'Ristic',
    phone: '061 442 5590',
    paket: 'Paket 20 sati',
    stanje: 'delimicno',
    deca: [
      { firstName: 'Tara', lastName: 'Ristic', rodjena: '2020-12-19', pol: 'FEMALE', napomena: 'Dolazi sa bakom utorkom.' },
    ],
  },
  {
    // Roditelj bez paketa - panel mora da pokaze i taj slucaj.
    email: 'vladimir.tomic' + DEMO_DOMEN,
    firstName: 'Vladimir',
    lastName: 'Tomic',
    phone: '062 903 1147',
    paket: null,
    deca: [
      { firstName: 'Jana', lastName: 'Tomic', rodjena: '2021-03-03', pol: 'FEMALE' },
    ],
  },
];

// Deterministican generator - isti podaci pri svakom pokretanju, pa se panel
// ne menja bez razloga izmedju dva pokretanja.
let seme = 20260813;
function nasumicno() {
  seme = (seme * 9301 + 49297) % 233280;
  return seme / 233280;
}

const izmedju = (min, max) => min + Math.floor(nasumicno() * (max - min + 1));
const izbor = (niz) => niz[Math.floor(nasumicno() * niz.length)];

function qrKod(i) {
  return `IGR-${String(i).padStart(4, '0')}${Math.floor(nasumicno() * 9000 + 1000)}`;
}

// Isto zaokruzivanje koje visits.js radi pri odjavi: navise na 15 min, uz
// minimalnu naplatu od 30 min.
function naplata(minuti) {
  const zaokruzeno = Math.max(30, Math.ceil(minuti / 15) * 15);
  return Math.round((zaokruzeno / 60) * 100) / 100;
}

function uSat(datum, sat, minut = 0) {
  const d = new Date(datum);
  d.setHours(sat, minut, 0, 0);
  return d;
}

async function ocisti() {
  const demo = await prisma.user.findMany({
    where: { email: { endsWith: DEMO_DOMEN } },
    select: { id: true },
  });
  const ids = demo.map((u) => u.id);

  // Redosled prati strane kljuceve: prvo ono sto pokazuje na pakete i decu.
  await prisma.hourAdjustment.deleteMany();
  await prisma.visit.deleteMany();
  await prisma.userPackage.deleteMany();
  await prisma.reservation.deleteMany();

  if (ids.length) {
    await prisma.child.deleteMany({ where: { parentId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }

  return ids.length;
}

async function main() {
  const admin = await prisma.user.findFirst({
    where: { role: { in: ['ADMIN', 'SUPERADMIN'] } },
  });
  if (!admin) {
    throw new Error('Nema admin naloga - prvo pokreni `node src/seed.js`.');
  }

  const obrisano = await ocisti();
  console.log(`Ocisceno: ${obrisano} demo roditelja iz prethodnog pokretanja.`);

  // ---- Paketi ----
  const paketi = {};
  for (const p of PAKETI) {
    const postoji = await prisma.package.findFirst({ where: { name: p.name } });
    paketi[p.name] = postoji
      ? await prisma.package.update({ where: { id: postoji.id }, data: p })
      : await prisma.package.create({ data: p });
  }
  console.log(`Paketi: ${Object.keys(paketi).length}.`);

  const lozinka = await bcrypt.hash(LOZINKA, 10);
  const danas = startOfDay();

  const sviParovi = []; // { dete, userPackage } - tekuci paketi
  const stariParovi = []; // ranije potroseni paketi, samo zbog istorije
  let brojDece = 0;
  let brojRoditelja = 0;

  for (const porodica of PORODICE) {
    let roditelj;

    if (porodica.email === POSTOJECI_EMAIL) {
      // Lozinka se namerno ne dira - mobilna aplikacija ostaje prijavljena.
      roditelj = await prisma.user.update({
        where: { email: POSTOJECI_EMAIL },
        data: {
          firstName: porodica.firstName,
          lastName: porodica.lastName,
          phone: porodica.phone,
        },
      });
    } else {
      roditelj = await prisma.user.create({
        data: {
          email: porodica.email,
          password: lozinka,
          firstName: porodica.firstName,
          lastName: porodica.lastName,
          phone: porodica.phone,
          role: 'PARENT',
        },
      });
    }
    brojRoditelja++;

    // ---- Deca ----
    for (const d of porodica.deca) {
      brojDece++;
      await prisma.child.create({
        data: {
          parentId: roditelj.id,
          firstName: d.firstName,
          lastName: d.lastName,
          dateOfBirth: new Date(`${d.rodjena}T00:00:00.000Z`),
          gender: d.pol,
          allergies: d.alergije || null,
          notes: d.napomena || null,
          qrCode: qrKod(brojDece),
        },
      });
    }

    const deca = await prisma.child.findMany({ where: { parentId: roditelj.id } });

    // ---- Paket ----
    if (!porodica.paket) continue;

    const paket = paketi[porodica.paket];
    const ukupno = Number(paket.totalHours);

    let istice = addDays(danas, paket.validityDays - izmedju(5, 40));
    let aktivan = true;
    if (porodica.stanje === 'istekao') {
      istice = addDays(danas, -izmedju(3, 20));
      aktivan = true; // ostaje aktivan, ali je rok prosao - tako se i vidi
    }

    const userPackage = await prisma.userPackage.create({
      data: {
        userId: roditelj.id,
        packageId: paket.id,
        totalHours: ukupno,
        remainingHours: ukupno, // ispravlja se posle, kada se saberu posete
        purchasedAt: addDays(danas, -izmedju(10, 60)),
        expiresAt: istice,
        isActive: aktivan,
        notes: porodica.stanje === 'nov' ? 'Kupljen na licu mesta.' : null,
      },
    });

    for (const dete of deca) {
      sviParovi.push({
        dete,
        userPackage,
        stanje: porodica.stanje,
        porodica: roditelj.id,
      });
    }

    // Stalni gosti su vec trosili paket pre ovog. Bez toga bi istorija poseta
    // bila plitka - dublja ne moze, jer je ogranicena satima tekuceg paketa.
    if (porodica.stanje === 'delimicno' || porodica.stanje === 'skoro potrosen') {
      const stari = await prisma.userPackage.create({
        data: {
          userId: roditelj.id,
          packageId: paket.id,
          totalHours: ukupno,
          remainingHours: 0,
          purchasedAt: addDays(danas, -izmedju(150, 200)),
          expiresAt: addDays(danas, -izmedju(35, 60)),
          isActive: false,
          notes: 'Prethodni paket, potrosen.',
        },
      });

      for (const dete of deca) {
        stariParovi.push({ dete, userPackage: stari });
      }
    }
  }

  console.log(`Roditelji: ${brojRoditelja}, deca: ${brojDece}.`);

  // ---- Posete ----
  //
  // Koliko sati treba potrositi zavisi od stanja paketa, da panel pokaze i
  // pun i skoro prazan i potrosen paket.
  const CILJ = { nov: 0.12, delimicno: 0.45, 'skoro potrosen': 0.85, potrosen: 1, istekao: 0.6 };

  const potroseno = new Map(); // userPackageId -> sati
  let brojPoseta = 0;

  // Sipa posete na jedan paket dok se ne potrosi `cilj` sati. Dani se mesaju
  // pa uzimaju redom, da bi cilj zaista bio dostignut.
  //
  // `deca` je cela porodica: braca i sestre dele paket, pa se za svaki dan
  // bira ko je tog dana dosao. Da se islo dete po dete, prvo bi potrosilo ceo
  // paket i ostala bi bez ijedne posete.
  async function posejPosete({ deca, userPackage, cilj, odDana, doDana }) {
    const ukupno = Number(userPackage.totalHours);

    const dani = Array.from({ length: doDana - odDana + 1 }, (_, i) => odDana + i);
    for (let i = dani.length - 1; i > 0; i--) {
      const j = Math.floor(nasumicno() * (i + 1));
      [dani[i], dani[j]] = [dani[j], dani[i]];
    }

    for (const dan of dani) {
      const vec = potroseno.get(userPackage.id) || 0;
      if (vec >= cilj) break;

      const dete = izbor(deca);
      const datum = addDays(danas, -dan);

      let dolazak = uSat(datum, izmedju(9, 17), izbor([0, 15, 30, 45]));
      let minuti = izmedju(45, 210);

      // Danasnja poseta mora da bude i zavrsena, dakle cela u proslosti -
      // inace bi panel prikazivao odjavu koja se jos nije desila.
      if (dan === 0) {
        const otvaranje = uSat(datum, 9);
        const proteklo = Math.floor((Date.now() - otvaranje.getTime()) / 60000);
        if (proteklo < 90) continue; // rano je, jos niko nije ni dosao ni otisao
        minuti = Math.min(minuti, proteklo - 30);
        dolazak = new Date(
          otvaranje.getTime() + izmedju(0, proteklo - minuti) * 60000
        );
      }

      const odlazak = new Date(dolazak.getTime() + minuti * 60000);
      // Ne moze da se naplati vise nego sto je na paketu ostalo - backend to
      // isto ogranicava pri odjavi. Bez ovoga zbir poseta premasi paket i
      // brojke u panelu se ne slazu.
      const sati = Math.min(naplata(minuti), ukupno - vec);
      if (sati <= 0) break;

      // Poneka poseta ostane otvorena pa je zatvori automatika na kraju dana.
      const autoZatvorena = nasumicno() > 0.93;

      await prisma.visit.create({
        data: {
          childId: dete.id,
          userPackageId: userPackage.id,
          checkedInAt: dolazak,
          checkedOutAt: odlazak,
          durationMinutes: minuti,
          hoursDeducted: sati,
          checkedInById: admin.id,
          checkedOutById: admin.id,
          status: autoZatvorena ? 'AUTO_CLOSED' : 'CHECKED_OUT',
          notes: autoZatvorena ? 'Zatvoreno automatski na kraju dana.' : null,
        },
      });

      potroseno.set(userPackage.id, vec + sati);
      brojPoseta++;
    }
  }

  // Parovi se grupisu po paketu, jer braca i sestre dele isti.
  function poPaketu(parovi) {
    const mapa = new Map();
    for (const p of parovi) {
      const zapis = mapa.get(p.userPackage.id) || {
        userPackage: p.userPackage,
        stanje: p.stanje,
        deca: [],
      };
      zapis.deca.push(p.dete);
      mapa.set(p.userPackage.id, zapis);
    }
    return [...mapa.values()];
  }

  // Tekuci paketi: od danas unazad mesec dana. Danas je ukljucen namerno -
  // bez toga bi tekuci dan bio prazan, a to je dan koji se najcesce gleda.
  for (const { userPackage, deca, stanje } of poPaketu(sviParovi)) {
    await posejPosete({
      deca,
      userPackage,
      cilj: Number(userPackage.totalHours) * (CILJ[stanje] ?? 0.4),
      odDana: 0,
      doDana: 29,
    });
  }

  // Danasnji promet se dosipa namerno. Gornja petlja bira dane izvlacenjem, pa
  // tekuci dan ume da ostane skoro prazan - a to je bas dan koji se gleda.
  for (const { userPackage, deca } of poPaketu(sviParovi)) {
    const ukupno = Number(userPackage.totalHours);
    const vec = potroseno.get(userPackage.id) || 0;
    if (ukupno - vec < 1) continue; // potrosen paket, nema cime da dodje

    const otvaranje = uSat(danas, 9);
    const proteklo = Math.floor((Date.now() - otvaranje.getTime()) / 60000);
    if (proteklo < 90) break; // rano jutro, jos nema zavrsenih poseta

    const minuti = Math.min(izmedju(60, 180), proteklo - 30);
    const dolazak = new Date(
      otvaranje.getTime() + izmedju(0, proteklo - minuti) * 60000
    );
    const sati = Math.min(naplata(minuti), ukupno - vec);

    await prisma.visit.create({
      data: {
        childId: izbor(deca).id,
        userPackageId: userPackage.id,
        checkedInAt: dolazak,
        checkedOutAt: new Date(dolazak.getTime() + minuti * 60000),
        durationMinutes: minuti,
        hoursDeducted: sati,
        checkedInById: admin.id,
        checkedOutById: admin.id,
        status: 'CHECKED_OUT',
      },
    });

    potroseno.set(userPackage.id, vec + sati);
    brojPoseta++;
  }

  // Raniji paketi: potroseni do kraja, pre vise meseci.
  for (const { userPackage, deca } of poPaketu(stariParovi)) {
    await posejPosete({
      deca,
      userPackage,
      cilj: Number(userPackage.totalHours),
      odDana: 40,
      doDana: 165,
    });
  }

  // ---- Deca koja su bas sada u igraonici ----
  //
  // Bez ovoga bi ekran "Prijave" uvek bio prazan, a to je glavni radni ekran.
  // Po jedno dete iz razlicitih porodica: da lista prisutnih ne bude troje
  // brace i sestara iz iste kuce, sto se u praksi retko vidi.
  const vidjenePorodice = new Set();
  const uIgraonici = [];
  for (const par of sviParovi) {
    if (uIgraonici.length >= 5) break;
    if (par.stanje === 'potrosen' || par.stanje === 'istekao') continue;
    if (vidjenePorodice.has(par.porodica)) continue;
    vidjenePorodice.add(par.porodica);
    uIgraonici.push(par);
  }

  for (const { dete, userPackage } of uIgraonici) {
    const preMinuta = izmedju(25, 160);
    await prisma.visit.create({
      data: {
        childId: dete.id,
        userPackageId: userPackage.id,
        checkedInAt: new Date(Date.now() - preMinuta * 60000),
        checkedInById: admin.id,
        status: 'CHECKED_IN',
      },
    });
    brojPoseta++;
  }

  // ---- Preostali sati moraju da se slazu sa posetama ----
  for (const [userPackageId, sati] of potroseno) {
    const up = await prisma.userPackage.findUnique({ where: { id: userPackageId } });
    const preostalo = Math.max(0, Number(up.totalHours) - sati);
    await prisma.userPackage.update({
      where: { id: userPackageId },
      data: { remainingHours: Math.round(preostalo * 100) / 100 },
    });
  }

  console.log(`Posete: ${brojPoseta}, od toga ${uIgraonici.length} dece je trenutno u igraonici.`);

  // ---- Rezervacije ----
  const roditelji = await prisma.user.findMany({ where: { role: 'PARENT' } });
  const nadji = (email) => roditelji.find((r) => r.email === email);

  const REZERVACIJE = [
    {
      type: 'BIRTHDAY',
      title: 'Sofijin 6. rodjendan',
      date: addDays(danas, 2),
      startTime: '16:00',
      endTime: '19:00',
      guestCount: 18,
      childName: 'Sofija Jovanovic',
      childAge: 6,
      status: 'CONFIRMED',
      isFullDay: true,
      notes: 'Torta stize u 15:30. Roditelji donose dekoraciju.',
      email: 'milos.jovanovic' + DEMO_DOMEN,
    },
    {
      type: 'BIRTHDAY',
      title: 'Filipov 7. rodjendan',
      date: addDays(danas, 9),
      startTime: '17:00',
      endTime: '20:00',
      guestCount: 22,
      childName: 'Filip Djordjevic',
      childAge: 7,
      status: 'PENDING',
      notes: 'Ceka se potvrda broja gostiju.',
      email: 'nikola.djordjevic' + DEMO_DOMEN,
    },
    {
      type: 'PRIVATE_EVENT',
      title: 'Privatna proslava - krstenje',
      date: addDays(danas, 5),
      startTime: '12:00',
      endTime: '16:00',
      guestCount: 30,
      status: 'CONFIRMED',
      isFullDay: true,
      contactPhone: '063 445 1120',
      email: 'marija.ilic' + DEMO_DOMEN,
    },
    {
      type: 'GROUP_BOOKING',
      title: 'Vrtic Leptiric - grupna poseta',
      date: addDays(danas, 12),
      startTime: '10:00',
      endTime: '12:00',
      guestCount: 24,
      status: 'PENDING',
      contactPhone: '021 555 118',
      notes: 'Dolaze sa dve vaspitacice.',
    },
    {
      type: 'BIRTHDAY',
      title: 'Ivin 3. rodjendan',
      date: addDays(danas, 16),
      startTime: '16:30',
      endTime: '19:00',
      guestCount: 12,
      childName: 'Iva Markovic',
      childAge: 3,
      status: 'CANCELLED',
      notes: 'Otkazano, dete je bolesno.',
      email: 'katarina.markovic' + DEMO_DOMEN,
    },
    {
      type: 'BIRTHDAY',
      title: 'Urosev 6. rodjendan',
      date: addDays(danas, -11),
      startTime: '17:00',
      endTime: '20:00',
      guestCount: 16,
      childName: 'Uros Simic',
      childAge: 6,
      status: 'CONFIRMED',
      email: 'dragan.simic' + DEMO_DOMEN,
    },
  ];

  for (const r of REZERVACIJE) {
    const { email, ...podaci } = r;
    await prisma.reservation.create({
      data: { ...podaci, userId: email ? nadji(email)?.id || null : null },
    });
  }
  console.log(`Rezervacije: ${REZERVACIJE.length}.`);

  // ---- Neradni dani ----
  // Neradni dani se stavljaju samo unapred. Danasnji dan mora da ostane radni:
  // to je dan koji se gleda, a zatvorena igraonica sakriva jelovnik i
  // aktivnosti, pa demo podaci izgledaju kao da nesto ne radi.
  const zatvorenDanas = await prisma.closedDay.findUnique({
    where: { date: new Date(Date.UTC(danas.getFullYear(), danas.getMonth(), danas.getDate())) },
  });
  if (zatvorenDanas) {
    await prisma.closedDay.delete({ where: { id: zatvorenDanas.id } });
    console.log('Uklonjen neradni dan koji je pao na danas.');
  }

  const NERADNI = [
    { date: addDays(danas, 3), reason: 'Rodjendan', note: 'Zatvoreno za privatnu proslavu' },
    { date: addDays(danas, 6), reason: 'Privatna proslava', note: 'Krstenje, ceo dan' },
  ];

  for (const d of NERADNI) {
    const kljuc = new Date(
      Date.UTC(d.date.getFullYear(), d.date.getMonth(), d.date.getDate())
    );
    const postoji = await prisma.closedDay.findUnique({ where: { date: kljuc } });
    if (!postoji) {
      await prisma.closedDay.create({
        data: { date: kljuc, reason: d.reason, note: d.note },
      });
    }
  }
  console.log(`Neradni dani: ${NERADNI.length} (postojeci se ne diraju).`);

  console.log(`\nLozinka svih demo roditelja: ${LOZINKA}`);
  console.log(`${POSTOJECI_EMAIL} zadrzava staru lozinku.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
