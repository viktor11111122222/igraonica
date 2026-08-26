// Design tokens za Kids club.
// Jedan izvor istine za boje, razmake i animacije.

// Uloge boja se menjaju sa varijantom: u plavoj je glavna prasnjavo plava a
// sporedna amber, u zutoj je obrnuto. Neutralne i semanticke su zajednicke,
// pa stoje samo jednom. Ekrani boje uzimaju iz konteksta (useTheme), ne
// odavde, da bi promena varijante odmah presla preko celog rasporeda.
const shared = {
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

  // Prijava ide po prilozenom predlosku i namerno ne prati varijantu - taj
  // ekran ima svoju amber podlogu i belo pismo bez obzira na temu.
  authBg: '#f1b754',
  authField: '#f5f5f7',
  authAction: '#7396c2',
  textOnAuth: '#ffffff',
};

const blue = {
  // Glavna - prasnjavo plava
  primary: '#7c9fc9',
  primaryDark: '#5d82b0',
  primaryDarker: '#3f6289',
  primarySoft: '#eaf1f8',
  primaryTint: '#f4f8fb',

  // Sporedna - topla amber
  // Pazi: #f8b653 na beloj ima kontrast ~1.9:1 i pada WCAG za tekst.
  // Koristi se kao povrsina/ispuna. Za amber tekst koristi accentText.
  accent: '#f8b653',
  accentDark: '#e09a2f',
  accentText: '#9a6410',
  accentSoft: '#fef4e3',

  textOnPrimary: '#ffffff',
  textOnAccent: '#3d2a08',

  // Providni slojevi preko glavne boje: podnaslov u baneru i okruglo dugme
  // u njemu. Idu uz textOnPrimary, pa se menjaju zajedno sa njim.
  onPrimaryMuted: 'rgba(255,255,255,0.85)',
  onPrimaryVeil: 'rgba(255,255,255,0.22)',

  // Datumi u traci stoje na providnom oblaku, dakle na glavnoj boji razblazenoj
  // belom. Na plavoj je to i dalje dovoljno tamno za belo pismo.
  dayText: '#ffffff',
  dayTextMuted: 'rgba(255,255,255,0.9)',

  // Prozirnost bele sare u baneru. Izmerena je sa prilozenih slika: ista
  // sara stoji na 0.34 nad plavom, a na 0.70 nad zutom.
  bannerDoodle: 0.34,
};

const amber = {
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

  onPrimaryMuted: '#ffffff',
  // Koprena ide na tamnu, ne na belu kao u plavoj: bela na amber podlozi je
  // svetlija od nje, pa bi belo dugme na beloj koprenici nestalo.
  onPrimaryVeil: 'rgba(61,42,8,0.2)',

  // Amber razblazen belim oblakom daje vrlo svetlu podlogu (#f4c47b): belo
  // pismo na njoj ima kontrast ~1.6:1 i prosto se ne vidi. Zato datumi ovde
  // idu tamno - i to na oblaku, ne na goloj zutoj.
  dayText: '#5a3d0a',
  dayTextMuted: 'rgba(90,61,10,0.85)',

  // Slabija nego na prilozenoj slici (0.70). Tamo preko sare nije stajao
  // tekst, a ovde stoji: belo pismo na beloj sari se gubi.
  bannerDoodle: 0.5,
};

export const themes = {
  blue: { ...shared, ...blue },
  amber: { ...shared, ...amber },
};

export const VARIANTS = ['amber', 'blue'];
export const DEFAULT_VARIANT = 'amber';

// Zatecena imena i dalje rade. Sve sto nije prebaceno na useTheme uvozi
// `colors` i dobija podrazumevanu varijantu, bez pracenja prekidaca.
export const colors = themes[DEFAULT_VARIANT];

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

export const type = {
  display: { fontSize: 44, fontFamily: font.bold },
  title: { fontSize: 24, fontFamily: font.bold },
  heading: { fontSize: 18, fontFamily: font.semibold },
  body: { fontSize: 15, fontFamily: font.medium },
  label: { fontSize: 13, fontFamily: font.semibold },
  caption: { fontSize: 12, fontFamily: font.medium },
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

export default { colors, themes, radius, spacing, type, font, motion, shadow };
