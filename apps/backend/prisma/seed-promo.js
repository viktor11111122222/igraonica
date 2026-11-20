// Dopuna demo podataka: promocije, baneri, dogadjaji, blog i obavestenja.
//
// `seed-demo.js` puni porodice, pakete i posete, ali ne dira novije tabele, pa
// baneri i akcije ostaju prazni. Ova skripta popunjava bas njih.
//
// Pokretanje:  node prisma/seed-promo.js
//
// Moze da se pokrece vise puta - sve svoje redove prvo obrise po naslovu, pa
// napravi iznova. Tudje podatke ne dira.
require('dotenv').config();

const prisma = require('../src/config/db');

const dan = 24 * 60 * 60 * 1000;
const datum = (pomak) => {
  const d = new Date(Date.now() + pomak * dan);
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
};

const BANERI = [
  {
    title: 'Letnja skola crtanja',
    description:
      'Radionice crtanja svakog utorka i cetvrtka u 17h. Materijal je ukljucen, prijave na recepciji.',
    imageUrl: null,
    showPopup: true,
    isActive: true,
  },
  {
    title: 'Rodjendani uz 20% popusta',
    description:
      'Za rezervacije radnim danom do kraja meseca. Vazi za sve pakete proslava.',
    imageUrl: null,
    showPopup: false,
    isActive: true,
  },
  {
    title: 'Novo: kutak za najmladje',
    description: 'Poseban prostor za decu do 3 godine, sa mekim podlogama i igrackama.',
    imageUrl: null,
    showPopup: false,
    isActive: true,
  },
  {
    title: 'Zimski raspust - stari termin',
    description: 'Zavrsena promocija, stoji iskljucena da se vidi kako izgleda u panelu.',
    imageUrl: null,
    showPopup: false,
    isActive: false,
  },
];

const AKCIJE = [
  {
    title: 'Drugo dete 50% jeftinije',
    description: 'Kada dovedete dvoje dece istovremeno, drugo placa pola cene.',
    discountType: 'PERCENT',
    discountValue: 50,
    dateFrom: datum(-7),
    dateTo: datum(21),
    isActive: true,
  },
  {
    title: 'Paket 20 sati - 500 dinara popusta',
    description: 'Popust vazi na kupovinu paketa od 20 sati.',
    discountType: 'AMOUNT',
    discountValue: 500,
    dateFrom: datum(-2),
    dateTo: datum(14),
    isActive: true,
  },
  {
    title: 'Treci sat gratis',
    description: 'Svaki treci sat u danu je besplatan. Ne kombinuje se sa drugim akcijama.',
    discountType: 'TEXT',
    discountValue: null,
    dateFrom: datum(0),
    dateTo: datum(30),
    isActive: true,
  },
  {
    title: 'Uskrsnja akcija',
    description: 'Zavrsena akcija - ostaje u evidenciji.',
    discountType: 'PERCENT',
    discountValue: 15,
    dateFrom: datum(-60),
    dateTo: datum(-45),
    isActive: false,
  },
];

const DOGADJAJI = [
  {
    type: 'BIRTHDAY',
    title: 'Rodjendan - Mila (6)',
    date: datum(3),
    startTime: '16:00',
    endTime: '19:00',
    guestCount: 18,
    childName: 'Mila',
    childAge: 6,
    contactPhone: '0641234567',
    notes: 'Torta stize u 16:30. Bez kikirikija - alergija kod dvoje dece.',
    status: 'CONFIRMED',
  },
  {
    type: 'PRIVATE_EVENT',
    title: 'Privatno zakupljenje sale',
    date: datum(9),
    startTime: '10:00',
    endTime: '14:00',
    guestCount: 30,
    contactPhone: '0651112223',
    notes: 'Firma zakupila celu salu.',
    status: 'PENDING',
  },
  {
    type: 'GROUP_BOOKING',
    title: 'Vrtic Pcelica - grupna poseta',
    date: datum(5),
    startTime: '09:30',
    endTime: '12:00',
    guestCount: 24,
    contactPhone: '0113456789',
    notes: 'Dolaze sa tri vaspitaca.',
    status: 'CONFIRMED',
  },
  {
    type: 'OTHER',
    customType: 'Snimanje reklame',
    title: 'Snimanje promo materijala',
    date: datum(12),
    startTime: '08:00',
    endTime: '11:00',
    contactPhone: '0603334445',
    notes: 'Ekipa donosi svoju opremu.',
    status: 'PENDING',
  },
  {
    type: 'BIRTHDAY',
    title: 'Rodjendan - Luka (4)',
    date: datum(-10),
    startTime: '17:00',
    endTime: '20:00',
    guestCount: 12,
    childName: 'Luka',
    childAge: 4,
    status: 'CONFIRMED',
  },
];

const OBJAVE = [
  {
    title: 'Kako da pripremite dete za prvi dolazak',
    slug: 'prvi-dolazak',
    excerpt: 'Nekoliko saveta koji olaksavaju prvi boravak bez roditelja.',
    content:
      'Prvi dolazak u igraonicu ume da bude uzbudljiv i pomalo strasan.\n\n' +
      'Dodjite ranije, prosetajte kroz prostor zajedno i upoznajte dete sa osobljem. ' +
      'Ostanite kratko, pa se pozdravite jasno i bez oklevanja - produzeno opraštanje ' +
      'najcesce oteza rastanak.\n\n' +
      'Ponesite omiljenu igracku i recite nam sve sto treba da znamo o navikama i alergijama.',
    isPublished: true,
    isFeatured: true,
  },
  {
    title: 'Jelovnik: sta i zasto sluzimo',
    slug: 'jelovnik-objasnjenje',
    excerpt: 'Obroci se prave svakog jutra, bez polufabrikata.',
    content:
      'Jelovnik pravimo nedeljno unapred i objavljujemo ga u aplikaciji.\n\n' +
      'Svi obroci se spremaju istog jutra. Alergene oznacavamo uz svako jelo, ' +
      'a za posebne potrebe dogovaramo zamenu.',
    isPublished: true,
    isFeatured: false,
  },
  {
    title: 'Najava: prosirenje prostora',
    slug: 'prosirenje-prostora',
    excerpt: 'Radovi pocinju na jesen.',
    content: 'Nacrt je gotov, cekamo dozvole. Detalji uskoro.',
    isPublished: false,
    isFeatured: false,
  },
];

async function main() {
  // Baneri
  await prisma.promoBanner.deleteMany({ where: { title: { in: BANERI.map((b) => b.title) } } });
  await prisma.promoBanner.createMany({ data: BANERI });

  // Akcije
  await prisma.promotion.deleteMany({ where: { title: { in: AKCIJE.map((a) => a.title) } } });
  await prisma.promotion.createMany({ data: AKCIJE });

  // Dogadjaji
  await prisma.event.deleteMany({ where: { title: { in: DOGADJAJI.map((d) => d.title) } } });
  await prisma.event.createMany({ data: DOGADJAJI });

  // Blog - trazi autora, uzimamo bilo kog admina.
  const admin = await prisma.user.findFirst({ where: { role: { in: ['ADMIN', 'SUPERADMIN'] } } });
  let objava = 0;
  if (admin) {
    await prisma.blogPost.deleteMany({ where: { slug: { in: OBJAVE.map((o) => o.slug) } } });
    await prisma.blogPost.createMany({
      data: OBJAVE.map((o) => ({
        ...o,
        authorId: admin.id,
        publishedAt: o.isPublished ? new Date() : null,
      })),
    });
    objava = OBJAVE.length;
  }

  // Obavestenja za roditelja koji se koristi u mobilnoj aplikaciji.
  const roditelj = await prisma.user.findUnique({ where: { email: 'roditelj@igraonica.com' } });
  let obavestenja = 0;
  if (roditelj) {
    await prisma.notification.deleteMany({ where: { userId: roditelj.id } });
    const deca = await prisma.child.findMany({ where: { parentId: roditelj.id } });
    const ime = deca[0]?.firstName || 'dete';
    await prisma.notification.createMany({
      data: [
        {
          userId: roditelj.id,
          type: 'CHILD_CHECKED_IN',
          title: 'Prijava',
          body: `${ime} je prijavljen/a u igraonicu.`,
          readAt: null,
        },
        {
          userId: roditelj.id,
          type: 'PACKAGE_ASSIGNED',
          title: 'Novi paket',
          body: 'Dodeljen vam je paket od 20 sati.',
          readAt: null,
        },
        {
          userId: roditelj.id,
          type: 'CHILD_CHECKED_OUT',
          title: 'Odjava',
          body: `${ime} je odjavljen/a. Naplaceno 2 sata.`,
          readAt: new Date(),
        },
      ],
    });
    obavestenja = 3;
  }

  console.log(`Baneri: ${BANERI.length} (aktivnih ${BANERI.filter((b) => b.isActive).length}).`);
  console.log(`Akcije: ${AKCIJE.length} (aktivnih ${AKCIJE.filter((a) => a.isActive).length}).`);
  console.log(`Dogadjaji: ${DOGADJAJI.length}.`);
  console.log(`Blog objave: ${objava}${admin ? '' : ' (nema admina, preskoceno)'}.`);
  console.log(`Obavestenja: ${obavestenja}${roditelj ? '' : ' (nema roditelja, preskoceno)'}.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
