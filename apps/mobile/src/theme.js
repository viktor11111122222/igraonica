// Design tokens za Igraonica.
// Jedan izvor istine za boje, razmake i animacije.

export const colors = {
  // Primarna - prasnjavo plava
  primary: '#7c9fc9',
  primaryDark: '#5d82b0',
  primaryDarker: '#3f6289',
  primarySoft: '#eaf1f8',
  primaryTint: '#f4f8fb',

  // Akcenat - topla amber
  // Pazi: #f8b653 na beloj ima kontrast ~1.9:1 i pada WCAG za tekst.
  // Koristi se kao povrsina/ispuna. Za amber tekst koristi accentText.
  accent: '#f8b653',
  accentDark: '#e09a2f',
  accentText: '#9a6410',
  accentSoft: '#fef4e3',

  // Neutralne
  bg: '#f7f9fb',
  surface: '#ffffff',
  border: '#e6ecf2',

  text: '#1f2a37',
  textMuted: '#6b7a8d',
  textFaint: '#9aa8b8',
  textOnPrimary: '#ffffff',
  textOnAccent: '#3d2a08',

  // Semanticke
  danger: '#d9534f',
  dangerSoft: '#fdeaea',
  success: '#4a9c6d',
  successSoft: '#e8f5ee',
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

export const shadow = {
  card: {
    shadowColor: '#1f2a37',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  raised: {
    shadowColor: '#1f2a37',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 14,
    elevation: 8,
  },
};

export const TAB_BAR_HEIGHT = 70;

export default { colors, radius, spacing, type, font, motion, shadow, TAB_BAR_HEIGHT };
