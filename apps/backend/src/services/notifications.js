const prisma = require('../config/db');

// Obavestenja o dogadjajima u igraonici.
//
// Zapis je po primaocu, ne po dogadjaju: prijava deteta pravi jedno obavestenje
// za roditelja i po jedno za svakog admina. Tako svako ima svoje "procitano", a
// tekst moze da bude drugaciji - roditelj cita "Vase dete", osoblje cita ime.
//
// Pravilo bez izuzetka: obavestenje ne sme da obori radnju povodom koje nastaje.
// Ako upis padne, prijava deteta i dalje mora da prodje, pa se sve hvata ovde.

// Rod deteta se koristi za slaganje reci. Kada nije unet, ostaje "/a" oblik koji
// se vec koristi u porukama pri prijavi i odjavi.
function oblik(gender, muski, zenski, neutralno) {
  if (gender === 'MALE') return muski;
  if (gender === 'FEMALE') return zenski;
  return neutralno;
}

function uSat(datum) {
  return new Date(datum).toLocaleTimeString('sr-RS', { hour: '2-digit', minute: '2-digit' });
}

function imeDeteta(child) {
  return `${child.firstName} ${child.lastName}`.trim();
}

async function idAdmina() {
  const admini = await prisma.user.findMany({
    where: { role: { in: ['ADMIN', 'SUPERADMIN'] }, isActive: true },
    select: { id: true },
  });
  return admini.map((a) => a.id);
}

// Upisuje spisak obavestenja. Prima vec sastavljene zapise, jer isti dogadjaj
// nosi razlicit tekst roditelju i osoblju.
async function upisi(zapisi) {
  const zaUpis = zapisi.filter((z) => z && z.userId);
  if (!zaUpis.length) return;

  try {
    await prisma.notification.createMany({ data: zaUpis });
  } catch (err) {
    // Namerno se ne prosledjuje dalje - vidi komentar na vrhu.
    console.error('Obavestenja nisu upisana:', err.message);
  }
}

// Isti dogadjaj, dva teksta: roditelju i svakom aktivnom adminu.
async function obeStrane({ parentId, type, data, roditelju, osoblju, osimKorisnika }) {
  const admini = (await idAdmina()).filter((id) => id !== osimKorisnika && id !== parentId);

  await upisi([
    { userId: parentId, type, title: roditelju.title, body: roditelju.body, data },
    ...admini.map((id) => ({
      userId: id,
      type,
      title: osoblju.title,
      body: osoblju.body,
      data,
    })),
  ]);
}

// ---- Dogadjaji ----

// Dete je uslo u igraonicu.
async function detePrijavljeno({ child, visit, byUserId }) {
  const ime = imeDeteta(child);
  const sat = uSat(visit.checkedInAt);
  const rec = oblik(child.gender, 'prijavljen', 'prijavljena', 'prijavljen/a');

  await obeStrane({
    parentId: child.parentId,
    type: 'CHILD_CHECKED_IN',
    data: { childId: child.id, visitId: visit.id },
    roditelju: {
      title: 'Dete je u igraonici',
      body: `${child.firstName} je ${rec} u ${sat}.`,
    },
    osoblju: {
      title: 'Prijava',
      body: `${ime} je ${rec} u ${sat}.`,
    },
    osimKorisnika: byUserId,
  });
}

// Dete je izaslo. Roditelja zanima koliko je naplaceno i koliko je ostalo.
async function deteOdjavljeno({ child, visit, chargedMinutes, remainingHours, byUserId }) {
  const ime = imeDeteta(child);
  const sat = uSat(visit.checkedOutAt);
  const rec = oblik(child.gender, 'odjavljen', 'odjavljena', 'odjavljen/a');

  const sati = Math.floor(chargedMinutes / 60);
  const minuti = chargedMinutes % 60;
  const naplata = sati === 0 ? `${minuti} min` : minuti === 0 ? `${sati} h` : `${sati} h ${minuti} min`;
  const preostalo = `${Number(remainingHours).toFixed(1).replace('.', ',')} h`;

  await obeStrane({
    parentId: child.parentId,
    type: 'CHILD_CHECKED_OUT',
    data: { childId: child.id, visitId: visit.id, chargedMinutes, remainingHours },
    roditelju: {
      title: 'Dete je izaslo iz igraonice',
      body: `${child.firstName} je ${rec} u ${sat}. Naplaceno ${naplata}, u paketu ostaje ${preostalo}.`,
    },
    osoblju: {
      title: 'Odjava',
      body: `${ime} je ${rec} u ${sat}. Naplaceno ${naplata}.`,
    },
    osimKorisnika: byUserId,
  });
}

// Novi roditelj se registrovao iz aplikacije - osoblje to inace ne bi videlo
// dok samo ne otvori spisak.
async function roditeljSeRegistrovao({ user }) {
  const admini = await idAdmina();
  await upisi(
    admini.map((id) => ({
      userId: id,
      type: 'PARENT_REGISTERED',
      title: 'Nov roditelj',
      body: `${user.firstName} ${user.lastName} je otvorio nalog u aplikaciji.`,
      data: { userId: user.id },
    }))
  );
}

// Roditelj je dodao dete iz aplikacije.
async function deteDodato({ child, parent }) {
  const admini = await idAdmina();
  await upisi(
    admini.map((id) => ({
      userId: id,
      type: 'CHILD_ADDED',
      title: 'Novo dete',
      body: `${parent.firstName} ${parent.lastName} je dodao/la dete ${imeDeteta(child)} (${child.qrCode}).`,
      data: { childId: child.id, userId: parent.id },
    }))
  );
}

// Roditelj je uklonio dete iz aplikacije. Osoblju je vazno jer taj QR kod vise
// nece raditi na recepciji.
async function deteUklonjeno({ child, byUserId }) {
  const admini = (await idAdmina()).filter((id) => id !== byUserId);
  await upisi(
    admini.map((id) => ({
      userId: id,
      type: 'CHILD_REMOVED',
      title: 'Dete uklonjeno',
      body: `${imeDeteta(child)} (${child.qrCode}) vise nije u aplikaciji.`,
      data: { childId: child.id },
    }))
  );
}

// Osoblje je dodelilo paket - roditelj to vidi tek ako sam otvori aplikaciju.
async function paketDodeljen({ userPackage, paket, parentId }) {
  await upisi([
    {
      userId: parentId,
      type: 'PACKAGE_ASSIGNED',
      title: 'Dobili ste paket',
      body: `${paket.name} - ${Number(userPackage.remainingHours).toFixed(1).replace('.', ',')} h. Vazi do ${new Date(userPackage.expiresAt).toLocaleDateString('sr-RS')}.`,
      data: { userPackageId: userPackage.id },
    },
  ]);
}

// Osoblje je rucno ispravilo sate.
async function satiIspravljeni({ userPackage, hours, reason, parentId }) {
  const znak = hours > 0 ? '+' : '';
  const kolicina = `${znak}${Number(hours).toFixed(1).replace('.', ',')} h`;

  await upisi([
    {
      userId: parentId,
      type: 'HOURS_ADJUSTED',
      title: 'Ispravka sati',
      body: `${kolicina}${reason ? ` (${reason})` : ''}. U paketu sada ${Number(userPackage.remainingHours).toFixed(1).replace('.', ',')} h.`,
      data: { userPackageId: userPackage.id, hours },
    },
  ]);
}

// Svaki dogadjaj se omotava tako da nikad ne baci dalje. Poziva se iz ruta
// posle uspesne radnje - prijava deteta ne sme da padne zato sto obavestenje
// nije upisano.
function bezObzira(fn) {
  return async (...args) => {
    try {
      await fn(...args);
    } catch (err) {
      console.error(`Obavestenje "${fn.name}" nije poslato:`, err.message);
    }
  };
}

module.exports = {
  detePrijavljeno: bezObzira(detePrijavljeno),
  deteOdjavljeno: bezObzira(deteOdjavljeno),
  roditeljSeRegistrovao: bezObzira(roditeljSeRegistrovao),
  deteDodato: bezObzira(deteDodato),
  deteUklonjeno: bezObzira(deteUklonjeno),
  paketDodeljen: bezObzira(paketDodeljen),
  satiIspravljeni: bezObzira(satiIspravljeni),
};
