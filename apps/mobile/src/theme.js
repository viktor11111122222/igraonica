// Design tokens za Kids club.
// Jedan izvor istine za boje, razmake i animacije.

export const colors = {
  // Glavna - amber sa ekrana za prijavu
  primary: '#f1b754',
  primaryDark: '#e09a2f',
  primaryDarker: '#9a6410',
  primarySoft: '#fef4e3',
  primaryTint: '#fffaf1',

  // Sporedna - prasnjavo plava
  accent: '#7c9fc9',
  accentDark: '#5d82b0',
  accentText: '#3f6289',
  accentSoft: '#eaf1f8',

  // Belo na amber ima kontrast ~1.9:1 i pada WCAG, ali tamno pismo na ovoj
  // podlozi izgleda tvrdo, pa je izbor namerno beo - isto kao na ekranu za
  // prijavu, gde predlozak takodje ima belo pismo na amber podlozi.
  textOnPrimary: '#ffffff',
  textOnAccent: '#ffffff',

  // Providni slojevi preko glavne boje: podnaslov u baneru i okrugla dugmad
  // u njemu.
  onPrimaryMuted: '#ffffff',
  // Koprena ide na tamnu, ne na belu: bela na amber podlozi je svetlija od
  // nje, pa bi belo dugme na beloj koprenici nestalo.
  onPrimaryVeil: 'rgba(61,42,8,0.2)',

  // Datumi u traci stoje na providnom oblaku, dakle na glavnoj boji
  // razblazenoj belim. To daje vrlo svetlu podlogu (#f4c47b) na kojoj belo
  // pismo ima kontrast ~1.6:1 i prosto se ne vidi - zato idu tamno, i to na
  // oblaku, ne na goloj zutoj.
  dayText: '#5a3d0a',
  dayTextMuted: 'rgba(90,61,10,0.85)',

  // Prozirnost bele sare u baneru. Sa prilozene slike izmereno je 0.70, ali
  // tamo preko sare nije stajao tekst - a ovde stoji, pa se belo pismo na
  // punoj sari gubi.
  bannerDoodle: 0.5,

  // Neutralne
  bg: '#f7f9fb',
  surface: '#ffffff',
  border: '#e6ecf2',

  text: '#1f2a37',
  textMuted: '#6b7a8d',
  textFaint: '#9aa8b8',

  // Semanticke
  danger: '#d9534f',
  dangerSoft: '#fdeaea',
  success: '#4a9c6d',
  successSoft: '#e8f5ee',

  // Prijava ide po prilozenom predlosku i ima svoje tonove: amber podloga,
  // belo pismo i plavo dugme.
  authBg: '#f1b754',
  authField: '#f5f5f7',
  authAction: '#7396c2',
  textOnAuth: '#ffffff',
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 18,
  xl: 24,
  pill: 999,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 40,
};

// Montserrat. Imena moraju da se poklapaju sa kljucevima u useFonts (App.js).
// Na RN se tezina bira preko fontFamily, ne preko fontWeight.
export const font = {
  medium: 'Montserrat_500Medium',
  semibold: 'Montserrat_600SemiBold',
  bold: 'Montserrat_700Bold',
};

// `includeFontPadding: false` je Android-only i iOS ga ne vidi. Android inace
// dodaje razmak iznad i ispod svakog reda po metrici fonta, pa je isti tekst
// tamo visi nego na iOS-u - brojevi u krugovima i natpisi u plocicama bi sedeli
// nize, a polja za unos bila par piksela visa. Ovako oba sistema mere tekst na
// isti nacin.
const androidRazmak = { includeFontPadding: false };

export const type = {
  display: { fontSize: 44, fontFamily: font.bold, ...androidRazmak },
  title: { fontSize: 24, fontFamily: font.bold, ...androidRazmak },
  heading: { fontSize: 18, fontFamily: font.semibold, ...androidRazmak },
  body: { fontSize: 15, fontFamily: font.medium, ...androidRazmak },
  label: { fontSize: 13, fontFamily: font.semibold, ...androidRazmak },
  caption: { fontSize: 12, fontFamily: font.medium, ...androidRazmak },
};

// Trajanja - nista preko 300ms za UI.
export const motion = {
  press: 140,
  enter: 220,
  exit: 160,
  stagger: 40,
};

// boxShadow radi na iOS-u, Androidu (9+) i webu, pa zamenjuje i stare
// shadow* props (samo iOS) i elevation (samo Android).
// Pazi na blur: RN racuna shadowRadius = blurRadius / 2, pa je blur ovde
// dupla vrednost starog shadowRadius-a da bi senka ostala ista.
// Providnost ide u samu boju, posto boxShadow nema shadowOpacity.
export const shadow = {
  card: {
    boxShadow: '0px 2px 20px rgba(31, 42, 55, 0.06)',
  },
  raised: {
    boxShadow: '0px 6px 28px rgba(31, 42, 55, 0.14)',
  },
};

// Visina trake se namerno ne drzi ovde: nav sam sebi racuna visinu (traka +
// kupola nad QR dugmetom + sigurna zona), a navigator je izmeri i za toliko
// odvoji sadrzaj ekrana. Konstanta sa fiksnim brojem bi se razisla sa stvarnom
// visinom cim se oblik promeni.

export default { colors, radius, spacing, type, font, motion, shadow };
