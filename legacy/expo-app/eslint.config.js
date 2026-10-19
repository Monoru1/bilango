const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', '.expo/*'],
  },
  {
    rules: {
      // Désactivée volontairement : l'interface est en français et le texte JSX contient des
      // apostrophes (« l'activité », « n'est »). En React Native le texte est rendu tel quel
      // dans <Text> : il n'existe pas d'analyse HTML à protéger, et échapper chaque apostrophe
      // en &apos; dégraderait la lisibilité et les relectures de texte. Toutes les autres
      // règles de la config Expo restent actives.
      'react/no-unescaped-entities': 'off',
    },
  },
]);
