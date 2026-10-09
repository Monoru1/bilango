# Assets Android — BilanGo

Identité client mission 05 : loupe blanche et graphique vert foncé sur carré arrondi `#25D366`. Les PNG fournis sont conservés sans recoloration ni déformation. Le vert du logo ne remplace pas la palette générale de l'app.

| Fichier dans `assets/images/` | Usage |
| --- | --- |
| `logo.png` | PNG client 512 × 512, composant Logo (accueils, connexion et menu), contain |
| `icon.png` | PNG client 1024 × 1024, icône classique, identique au fichier fourni |
| `brand.svg` | SVG original fourni dans la demande : géométrie de référence |
| `android-icon-foreground.png` | Symbole loupe/barres sur transparence, 1024 × 1024 |
| `android-icon-background.png` | Couleur unie #25D366, 1024 × 1024 |
| `android-icon-monochrome.png` | Masque blanc sur transparence pour icônes thématiques, 1024 × 1024 |
| `splash-icon.png` | Composition centrée à 75 % du PNG client, transparente, 1024 × 1024 |

Les couches adaptive sont dérivées du SVG : loupe et barres, sans carré de fond, transformées avec un facteur 1,35 puis translation (166,4 ; 166,4) dans le canevas 1024. Le dessin reste dans la zone sûre centrale. Le monochrome est un masque système, pas une recoloration du logo affiché dans l'interface. Les couches se régénèrent sous Windows avec `powershell -File scripts/prepare-brand.ps1` (System.Drawing, aucune dépendance ajoutée).

`app.json` utilise le fond adaptive #25D366 et le splash sur fond blanc, largeur configurée 160, contain. Aucun dossier natif modifié. Tests : signature/dimensions des cinq PNG Android, palette configurée et présence du SVG. Les captures Web confirment le rendu du logo officiel sur blanc, mais ne montrent pas le lanceur ni le splash natifs.

Reste à vérifier sur **binaire release** : masques ronds/carrés, icônes thématiques, démarrage à froid, centrage du splash et absence de rognage. Aucun essai téléphone/émulateur, aucune build EAS ni soumission Play Store. Documentation : [splash SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/splash-screen/), [adaptive icon SDK 57](https://docs.expo.dev/versions/v57.0.0/config/app/#androidadaptiveicon).
