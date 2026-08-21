const expo = require('eslint-config-expo/flat');

// Expo-ov skup pravila vec nosi react, react-hooks i react-native pravila
// podesena za ovu verziju SDK-a, pa se ovde samo dopunjuje.
module.exports = [
  { ignores: ['dist/**', 'coverage/**', 'ios/**', 'android/**', '.expo/**', 'node_modules/**'] },

  ...expo,

  {
    rules: {
      // Nekoriscena promenljiva je najcesce zaboravljen ostatak refaktora.
      'no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', caughtErrors: 'none', varsIgnorePattern: '^_' },
      ],

      // Pravilo iz React Compiler skupa. Prijavljuje ispravan kod: dovlacenje
      // podataka sa servera u stanje, u kontekstima i na QR ekranu. Bez
      // biblioteke za podatke (ili Suspense-a) drugog nacina nema, a sva mesta
      // gde je resetovanje stanja moglo u render vec su prebacena. Ostaje kao
      // upozorenje, da se novo mesto primeti.
      'react-hooks/set-state-in-effect': 'warn',
    },
  },

  {
    files: ['**/__tests__/**', 'jest.setup.js'],
    languageOptions: {
      globals: { jest: 'readonly', describe: 'readonly', test: 'readonly', expect: 'readonly', beforeEach: 'readonly', afterEach: 'readonly', beforeAll: 'readonly', afterAll: 'readonly' },
    },
  },
];
