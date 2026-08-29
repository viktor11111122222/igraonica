// Katalog podesavanja - jedan izvor istine za kljuceve, podrazumevane
// vrednosti i to sta je javno.
//
// `public: true` znaci da kljuc sme da procita i neprijavljen korisnik preko
// GET /api/settings/public. Sve sto nije javno vide samo admini.

const CATALOG = [
  // ---- Obracun vremena (cita ga visits.js pri odjavi) ----
  //
  // Boravak se naplacuje u punim satima. Ovaj prag kaze koliko minuta preko
  // punog sata prolazi bez naplate; preko njega se racuna ceo sat.
  {
    key: 'hour_grace_minutes',
    value: '15',
    description: 'Minuti preko punog sata koji se ne naplacuju. Preko toga se racuna ceo sat.',
    public: false,
  },

  // ---- Podaci o igraonici (prikazuje ih mobilna aplikacija) ----
  { key: 'club_name', value: 'Kids club', description: 'Naziv igraonice.', public: true },
  { key: 'club_phone', value: '', description: 'Kontakt telefon.', public: true },
  { key: 'club_email', value: '', description: 'Kontakt email.', public: true },
  { key: 'club_address', value: '', description: 'Adresa.', public: true },
  {
    key: 'working_hours',
    value: '09:00 - 21:00',
    description: 'Radno vreme, kao slobodan tekst.',
    public: true,
  },
  // Koordinate za dugme "Prikazi na mapi" u aplikaciji. Podrazumevane
  // vrednosti su PRIMER (centar Novog Sada) - zameniti pravom lokacijom.
  // Ako je bilo koja prazna, dugme se u aplikaciji ne prikazuje.
  {
    key: 'club_latitude',
    value: '45.267136',
    description: 'Geografska sirina za dugme "Prikazi na mapi". Primer - zameniti pravom.',
    public: true,
  },
  {
    key: 'club_longitude',
    value: '19.833549',
    description: 'Geografska duzina za dugme "Prikazi na mapi". Primer - zameniti pravom.',
    public: true,
  },

  // ---- Ponasanje mobilne aplikacije ----
  {
    key: 'mobile_announcement',
    value: '',
    description: 'Tekst obavestenja u aplikaciji. Prazno znaci da se ne prikazuje nigde.',
    public: true,
  },
  {
    key: 'announcement_tabs',
    value: 'home',
    description:
      'Na kojim ekranima se obavestenje prikazuje, imena razdvojena zarezom: home, package, menu, schedule.',
    public: true,
  },
  {
    key: 'mobile_tab_menu',
    value: 'true',
    description: 'Prikazi tab Jelovnik u mobilnoj aplikaciji.',
    public: true,
  },
  {
    key: 'mobile_tab_schedule',
    value: 'true',
    description: 'Prikazi tab Raspored u mobilnoj aplikaciji.',
    public: true,
  },
  {
    key: 'mobile_tab_gallery',
    value: 'true',
    description: 'Prikazi galeriju fotografija na pocetnom ekranu aplikacije.',
    public: true,
  },
];

// Ekrani na kojima obavestenje moze da se pojavi. Mora da se poklapa sa
// <Announcement screen="..."/> u mobilnoj aplikaciji i sa listom u panelu.
//
// Postoji zato sto se spisak ekrana menjao: stara vrednost je nosila "gallery",
// ekran koji vise ne postoji, pa je vrednost visila u bazi a panel nije imao
// cime da je skine. Nepoznata imena se sada odbacuju pri cuvanju.
const ANNOUNCEMENT_SCREENS = ['home', 'menu', 'schedule', 'package'];

const DEFAULTS = Object.fromEntries(CATALOG.map((s) => [s.key, s.value]));

// Podesavanja koja moraju biti broj, sa granicama. Vrednost van granica ne bi
// bila samo "cudna" - `hour_grace_minutes` kao "abc" daje NaN u racunici pri
// odjavi, a odatle poseta bez trajanja i paket obrisan na nulu.
//
// Granice prate ono sto panel nudi na klizacima.
const NUMERIC_SETTINGS = {
  // Prag ne sme da bude 60 ili vise: tada nijedan zapoceti sat ne bi presao
  // prag, pa bi se svaki boravak naplacivao kao jedan sat.
  hour_grace_minutes: { min: 0, max: 59 },
};

// Ceo broj iz teksta, ili null ako vrednost nije upotrebljiva.
function parseNumericSetting(key, value) {
  const pravila = NUMERIC_SETTINGS[key];
  if (!pravila) return null;

  const tekst = String(value ?? '').trim();
  // `parseInt` bi progutao "15abc" i "1.9"; ovde mora ceo broj i nista vise.
  if (!/^-?\d+$/.test(tekst)) return null;

  const broj = Number(tekst);
  if (broj < pravila.min || broj > pravila.max) return null;
  return broj;
}

// Broj iz podesavanja, sa povratkom na podrazumevanu vrednost kada je zapisano
// neupotrebljivo. Racunica naplate ne sme da zavisi od toga sta je u bazi.
function numericSetting(key, value) {
  const iz = parseNumericSetting(key, value);
  if (iz !== null) return iz;
  return parseNumericSetting(key, DEFAULTS[key]);
}

// Zadrzava samo poznate ekrane, bez duplikata i praznih delova.
function cleanAnnouncementTabs(value) {
  const trazeni = String(value || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  return [...new Set(trazeni)].filter((s) => ANNOUNCEMENT_SCREENS.includes(s)).join(',');
}

const PUBLIC_KEYS = CATALOG.filter((s) => s.public).map((s) => s.key);

module.exports = {
  CATALOG,
  PUBLIC_KEYS,
  DEFAULTS,
  ANNOUNCEMENT_SCREENS,
  NUMERIC_SETTINGS,
  cleanAnnouncementTabs,
  parseNumericSetting,
  numericSetting,
};
