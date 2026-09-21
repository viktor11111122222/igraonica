// Kes odgovora sa servera, u memoriji.
//
// Zasto uopste: backend na sve /api rute salje `Cache-Control: no-store`, i to
// namerno - jelovnik, raspored i obavestenja se menjaju iz admina dok je
// aplikacija otvorena. Kes pretrazivaca je zato iskljucen, pa se ovde radi na
// sloju aplikacije, gde se tacno zna kada podatak vise ne vazi.
//
// Radi dve stvari:
//
//   1. Spaja zahteve u letu. Ako dva mesta u isti mah traze isti podatak
//      (pokretanje aplikacije povlaci podesavanja, neradne dane, pocetnu i
//      broj obavestenja odjednom), na mrezu ide jedan zahtev, a odgovor dobiju
//      oba. Ovo je uvek tacno - nema zastarelog podatka.
//
//   2. Kratko cuva odgovor. Prelazak na drugi tab i nazad time postaje
//      trenutan umesto da svaki put ceka mrezu.
//
// Sta kes NE sme da uradi: da sakrije promenu. Zato:
//   - traje krace od `REFRESH_INTERVAL` (15s), pa redovno osvezavanje uvek
//     stigne do servera,
//   - svaka izmena (POST/PATCH/DELETE) ga cisti u celosti,
//   - povlacenje ekrana nadole ga cisti (korisnik izricito trazi svez podatak),
//   - prijava i odjava ga cise, da podaci jednog naloga nikad ne procure u
//     drugi.

// Mora ostati manje od REFRESH_INTERVAL iz useAutoRefresh (15s).
export const TRAJANJE_MS = 8000;

// Gornja granica broja kljuceva. Kljuc nosi i upit (`?date=...`), pa bi bez
// ovoga listanje jelovnika kroz mesece polako punilo memoriju.
export const NAJVISE_KLJUCEVA = 60;

// kljuc -> { vrednost, istice }
const zapisi = new Map();
// kljuc -> { posao, generacija }, samo dok zahtev traje
const uLetu = new Map();

// Raste pri svakom ponistavanju. Zahtev pamti generaciju u kojoj je krenuo i
// upisuje odgovor samo ako se u medjuvremenu nista nije ponistilo. Bez ovoga
// bi zahtev poslat pre izmene, a vracen posle nje, upisao zastareo podatak -
// tacno ono sto kes ne sme da uradi.
let generacija = 0;

// Kes cuva i vraca kopije. Bez toga bi dva ekrana delila isti niz: kada bi ga
// jedan promenio, drugi bi dobio tudju izmenu. Odgovori su ionako JSON, pa je
// ovo verna kopija.
function kopija(v) {
  if (v === null || typeof v !== 'object') return v;
  return JSON.parse(JSON.stringify(v));
}

function izbaciNajstarije() {
  // Map cuva redosled umetanja, pa je prvi kljuc najranije upisan.
  while (zapisi.size > NAJVISE_KLJUCEVA) {
    const prvi = zapisi.keys().next().value;
    zapisi.delete(prvi);
  }
}

// Vrati zapamceni odgovor ako jos vazi, inace pozovi `donesi` i zapamti ga.
// Zahtevi sa istim kljucem koji se poklope u vremenu dele jedan poziv.
export async function kesiraj(kljuc, donesi, { trajanje = TRAJANJE_MS } = {}) {
  const zapis = zapisi.get(kljuc);
  if (zapis && zapis.istice > Date.now()) {
    return kopija(zapis.vrednost);
  }

  // Istekao zapis se ne cuva - inace bi ostao da zauzima mesto do izbacivanja.
  if (zapis) zapisi.delete(kljuc);

  const uToku = uLetu.get(kljuc);
  if (uToku) return kopija(await uToku.posao);

  const moja = generacija;

  const posao = (async () => {
    const vrednost = await donesi();

    // Upisuje se samo ako se u medjuvremenu nista nije ponistilo.
    if (moja === generacija) {
      // Rok se broji od trenutka kada je odgovor stigao, ne od slanja zahteva.
      zapisi.set(kljuc, { vrednost: kopija(vrednost), istice: Date.now() + trajanje });
      izbaciNajstarije();
    }
    return vrednost;
  })();

  uLetu.set(kljuc, { posao, generacija: moja });

  try {
    // Greska se namerno ne pamti: sledeci poziv mora ponovo da proba.
    return kopija(await posao);
  } finally {
    // Brise se samo ako je jos uvek ovaj posao - u medjuvremenu je mogao da
    // krene nov zahtev za isti kljuc.
    if (uLetu.get(kljuc)?.posao === posao) uLetu.delete(kljuc);
  }
}

// Ponisti zapamceno. Bez argumenta brise sve; sa prefiksom samo kljuceve koji
// njime pocinju.
//
// Zahtevi koji su vec u letu se NE diraju: oni su krenuli pre izmene, pa bi
// njihov odgovor bio stariji od nje. Zato se posle ponistavanja ni njihov
// rezultat ne upisuje.
export function ponisti(prefiks) {
  generacija += 1;

  if (!prefiks) {
    zapisi.clear();
    uLetu.clear();
    return;
  }

  for (const kljuc of [...zapisi.keys()]) {
    if (kljuc.startsWith(prefiks)) zapisi.delete(kljuc);
  }
  for (const kljuc of [...uLetu.keys()]) {
    if (kljuc.startsWith(prefiks)) uLetu.delete(kljuc);
  }
}

// Za testove i proveru.
export function stanje() {
  return { zapisa: zapisi.size, uLetu: uLetu.size };
}
