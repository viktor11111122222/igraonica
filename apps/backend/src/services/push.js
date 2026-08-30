// Slanje obavestenja na zakljucan ekran, preko Expo push servisa.
//
// Ukljucuje se tek kad su podeseni kredencijali (FCM za Android, APNs za iOS) i
// kad je `PUSH_ENABLED=true`. Dok je ugaseno, obavestenja i dalje postoje u
// aplikaciji (zvonce) - samo ne stizu na zakljucan ekran.
const prisma = require('../config/db');

const EXPO_URL = process.env.EXPO_PUSH_URL || 'https://exp.host/--/api/v2/push/send';

// Expo prima najvise 100 poruka po zahtevu.
const PAKET = 100;

function ukljuceno() {
  return process.env.PUSH_ENABLED === 'true';
}

// Tokeni koje su uredjaji upisali kroz PATCH /auth/profile.
async function tokeni(userIds) {
  const korisnici = await prisma.user.findMany({
    where: { id: { in: [...new Set(userIds)] }, pushToken: { not: null }, isActive: true },
    select: { id: true, pushToken: true },
  });

  return new Map(korisnici.map((k) => [k.id, k.pushToken]));
}

// Salje jedno obavestenje po zapisu koji je vec upisan u bazu. Zapisi bez
// tokena se preskacu - taj korisnik jednostavno nema uredjaj koji slusa.
async function posalji(zapisi) {
  if (!ukljuceno() || !zapisi?.length) return { poslato: 0 };

  const mapa = await tokeni(zapisi.map((z) => z.userId));
  const poruke = zapisi
    .filter((z) => mapa.has(z.userId))
    .map((z) => ({
      to: mapa.get(z.userId),
      title: z.title,
      body: z.body,
      data: z.data ?? {},
      sound: 'default',
    }));

  if (!poruke.length) return { poslato: 0 };

  for (let i = 0; i < poruke.length; i += PAKET) {
    const deo = poruke.slice(i, i + PAKET);
    const odgovor = await fetch(EXPO_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(deo),
    });

    if (!odgovor.ok) {
      throw new Error(`Expo push je odbio zahtev (${odgovor.status}).`);
    }

    // Uredjaj koji je obrisao aplikaciju vraca "DeviceNotRegistered"; taj token
    // se brise da se ne bi slalo u prazno do kraja veka.
    const telo = await odgovor.json().catch(() => ({}));
    const zaBrisanje = (telo?.data || [])
      .map((r, idx) => (r?.details?.error === 'DeviceNotRegistered' ? deo[idx].to : null))
      .filter(Boolean);

    if (zaBrisanje.length) {
      await prisma.user.updateMany({
        where: { pushToken: { in: zaBrisanje } },
        data: { pushToken: null },
      });
    }
  }

  return { poslato: poruke.length };
}

module.exports = { posalji, ukljuceno };
