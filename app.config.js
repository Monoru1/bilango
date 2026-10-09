// Le mode Web est réservé à la recette visuelle locale ; Android reste la cible par défaut.
module.exports = ({ config }) => process.env.BILANGO_VISUAL_PREVIEW === '1'
  ? { ...config, platforms: ['android', 'web'], web: { bundler: 'metro', output: 'single' } }
  : config;
