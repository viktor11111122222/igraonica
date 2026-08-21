import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

// Pravila su namerno kratka lista. Ono zbog cega linter ovde uopste postoji su
// `react-hooks` pravila: greske u zavisnostima effect-a i kuke pozvane uslovno
// ne vide se u testu ni u pregledacu dok ne bude kasno.
export default [
  { ignores: ['dist/**', 'coverage/**', 'node_modules/**'] },

  js.configs.recommended,

  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.es2021 },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    settings: { react: { version: 'detect' } },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...react.configs.flat.recommended.rules,
      ...react.configs.flat['jsx-runtime'].rules,
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],

      // Nekoriscena promenljiva je najcesce zaboravljen ostatak refaktora.
      // Izuzetak su namerno preskoceni argumenti i uhvacene greske.
      'no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', caughtErrors: 'none', varsIgnorePattern: '^_' },
      ],

      // Propovi se ne opisuju kroz PropTypes u ovom projektu.
      'react/prop-types': 'off',

      // Dva pravila iz React Compiler skupa ostaju kao upozorenje, ne greska.
      // Oba prijavljuju ispravan kod:
      //
      //   set-state-in-effect  - dovlacenje podataka sa servera u stanje. Bez
      //     biblioteke za podatke (ili Suspense-a) drugog nacina nema; sva
      //     mesta gde je resetovanje stanja moglo u render vec su prebacena.
      //
      //   refs - `save()` u Podesavanjima cita `timers.current`, ali iskljucivo
      //     iz rukovaoca dogadjajem. Pravilo to ne razlikuje od citanja u
      //     renderu, pa prijavljuje osam puta istu bezopasnu liniju.
      //
      // Ostaju vidljiva namerno: ako se pojavi novo mesto, treba ga pogledati.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
    },
  },

  {
    files: ['**/__tests__/**', 'src/test/**'],
    languageOptions: { globals: { ...globals.node } },
  },

  // Vite konfiguracija se izvrsava u Node-u, ne u pregledacu.
  {
    files: ['vite.config*.js', 'eslint.config.js'],
    languageOptions: { globals: { ...globals.node } },
  },

  // Kontekst i njegova kuka zive u istom fajlu namerno - to je jedna celina.
  // Fast refresh na to gundja, ali razdvajanje bi bilo gore za citanje.
  {
    files: ['src/context/**'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
];
