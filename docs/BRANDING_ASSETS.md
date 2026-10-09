# Assets Android — BilanGo

Préparation mission 04, issue du logo existant `src/ui/logo.tsx` et du cahier §7 : œil blanc, iris vert et barres montantes, palette #0F6E56 / #5DCAA5. **Rendu natif et validation visuelle finale non exécutés.**

| Fichier dans `assets/images/` | Format | Usage |
| --- | --- | --- |
| `brand.svg` | Source vectorielle, viewBox 96 × 96, export 1024 × 1024 | Logo complet, géométrie du composant Logo |
| `icon.png` | PNG RGBA 1024 × 1024 | Icône classique, carré arrondi vert |
| `android-icon-foreground.png` | PNG RGBA 1024 × 1024, transparent | Œil et iris, sans carré de fond |
| `android-icon-background.png` | PNG RGBA 1024 × 1024, opaque | Fond uni #0F6E56 |
| `android-icon-monochrome.png` | PNG RGBA 1024 × 1024 | Masque blanc transparent, iris évidé et barres blanches, icônes thématiques |
| `splash-icon.png` | PNG RGBA 1024 × 1024, transparent | Symbole centré ; plugin expo-splash-screen, fond #0F6E56, imageWidth 160, contain |

Les couches foreground, monochrome et splash reprennent la géométrie du SVG avec une échelle de 72 % centrée sur (48,48), sans le rectangle de fond. L'œil tient dans une largeur d'environ 57 % du canevas : il reste dans la zone sûre centrale du masque adaptive. Les pixels anti-aliasés sont conservés. Pour réexporter, utiliser la source vectorielle : fond séparé, même transformation pour les trois couches, dernier rectangle blanc pour le monochrome. Les PNG ont été rasterisés avec System.Drawing sur Windows, sans dépendance ajoutée au projet.

`app.json` référence ces fichiers existants. Le test de `src/ui/__tests__/contrast.test.ts` vérifie les cinq PNG (signature, en-tête, dimensions), les couleurs configurées et la présence de la source SVG. Cela ne valide ni les masques des lanceurs ni le rendu du splash.

Vérifier sur un **binaire release** : masques rond/carré arrondi, icônes thématiques Android, démarrage à froid, fond de splash, absence de rognage et lisibilité des barres. Expo Go ne reproduit pas intégralement le splash natif : [documentation SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/splash-screen/). Configuration adaptive : [app.json SDK 57](https://docs.expo.dev/versions/v57.0.0/config/app/#androidadaptiveicon).

Ne pas modifier les dossiers natifs : ces réglages passent par `app.json` et les config plugins. Aucune build EAS, soumission Play Store ou validation sur appareil n'a été réalisée dans cette mission.
