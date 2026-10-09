const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: [
      'dist/*',
      '.expo/*',
      // Reliquats du template Expo par défaut, non utilisés par BilanGo (à supprimer).
      'src/components/*',
      'src/constants/*',
      'src/hooks/*',
      'src/app/explore.tsx',
    ],
  },
  {
    rules: {
      // L'interface est en français : les apostrophes sont partout dans le texte JSX.
      // En React Native, ces caractères n'ont pas besoin d'être échappés.
      'react/no-unescaped-entities': 'off',
    },
  },
]);
