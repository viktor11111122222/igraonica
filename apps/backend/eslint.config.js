const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  {
    ignores: [
      'node_modules/**',
      'coverage/**',
      // Prisma generise ovaj kod; nije nas da ga ispravljamo.
      'src/generated/**',
      'uploads/**',
    ],
  },

  js.configs.recommended,

  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: { ...globals.node },
    },
    rules: {
      // Nekoriscena promenljiva je najcesce zaboravljen ostatak refaktora.
      //
      // Tri izuzetka: Express-ov rukovalac greskama mora da ima cetiri
      // argumenta (poslednji `next` se ne koristi); `const { password, ...rest }`
      // je idiom za izostavljanje polja; i imena sa `_` su namerno preskocena.
      'no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_|^next$',
          caughtErrors: 'none',
          varsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
    },
  },

  {
    files: ['tests/**'],
    languageOptions: {
      globals: { ...globals.node, ...globals.jest },
    },
  },
];
