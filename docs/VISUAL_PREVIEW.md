# Prévisualisation locale BilanGo

Outillage préparé sur `feat/visual-preview`, conservé pour la mission 05 sur `feat/client-ui-feedback`, à partir de `feat/android-foundation` (`a2e7d56`).
Elle rend les **vrais écrans React Native** avec Expo Web / React Native Web, sur les services mock existants. Aucun écran n'est réécrit. La galerie est un document local de recette, pas une application web commerciale.

## Ouvrir la galerie

Ouvrir directement `artifacts/visual-preview/index.html` dans Chrome, depuis l'Explorateur Windows. Les PNG sont voisins du HTML ; conserver le dossier ensemble. Cliquer sur une image ouvre sa version originale.

15 captures : accueil, connexion WhatsApp, OTP, PIN, dashboard propriétaire, menu latéral, historique, équipe, accueil manager, formulaire de bilan et suite du formulaire (stock/note), périodes 7/30 jours, calendrier et plage de plusieurs années. Les deux accueils et le calendrier figurent en tête de galerie. Résolution : 412 × 915 pixels. Les comptes fictifs Koffi et Rodrigue passent réellement par OTP `123456` et création du PIN. Les valeurs saisies dans le formulaire ne sont pas envoyées.

## Régénérer

```powershell
npm ci
npm run preview:visual
```

Chrome doit être installé à `C:/Program Files/Google/Chrome/Application/chrome.exe`. Pour un autre emplacement :

```powershell
$env:BILANGO_CHROME_PATH = 'C:/autre/emplacement/chrome.exe'
npm run preview:visual
```

Le script exporte Web, sert cet export sur une adresse de boucle locale et un port temporaire, lance Chrome sans fenêtre via Playwright, navigue dans les composants réels, puis ferme Chrome et le serveur. Il ne télécharge aucun navigateur. Les trois dépendances de développement ajoutées sont `react-dom`, `react-native-web` et `playwright-core`.

Chaque capture attend son contenu et ses polices. Le script contrôle le format PNG et ses dimensions, échoue sur les erreurs JavaScript, puis ouvre **le fichier HTML local** dans Chrome et vérifie le chargement des 15 images. `manifest.json` conserve les routes, la version de Chrome, l'heure et le HEAD source. Les sorties générées sont ignorées par Git.

`node scripts/visual-preview.mjs --reuse-export` permet de refaire les captures d'un export déjà produit. Après une modification de code, utiliser la commande complète pour éviter des captures périmées.

## Isolation Android

- `app.json` conserve `platforms: ["android"]`. `app.config.js` active Web uniquement avec `BILANGO_VISUAL_PREVIEW=1`, transmis par le script au processus d'export.
- Le CLI SDK 57 contrôle d'abord la liste statique des plateformes. `EXPO_NO_WEB_SETUP=1` évite ce contrôle pour ce seul export ; les adaptateurs sont explicitement installés et l'export réel vérifie leur résolution.
- `storage.web.ts` remplace SecureStore **uniquement lors de la résolution Web**. Session et PIN sont éphémères : recharger la page repart d'une session vierge. Le stockage natif n'est pas modifié.
- Aucun ajout manuel à `android/` ou `ios/`, aucune modification des règles métier, des services mock ou des écrans. Android continue à utiliser le même bundle natif et SecureStore.

## Différences de rendu et limites

| Web dans Chrome | Android à vérifier sur appareil |
| --- | --- |
| DOM/CSS React Native Web, polices et métriques Chrome | Vues natives, métriques de texte et antialiasing Android |
| Viewport fixe sans barre système, encoche ni zone gestuelle | Insets réels, barre de statut/navigation, découpes |
| Souris, molette et clavier PC | Toucher, gestes, clavier logiciel et redimensionnement |
| Navigation React Navigation adaptée au navigateur | Pile native, bouton Retour Android et transitions natives |
| Modales rendues dans le DOM | Modales/fenêtres et accessibilité TalkBack natives |
| `Alert.alert` est une fonction vide dans React Native Web 0.21 | Confirmations natives : suppression, abandon, envoi selon le parcours |
| Stockage en mémoire ; aucun verrouillage matériel | SecureStore, cycle arrière-plan, PIN et reprise Android |
| Pas de splash ou d'icône de lanceur natifs | Splash Expo, adaptive icon et monochrome à tester sur binaire |

Les captures ne valident donc pas les confirmations `Alert`, les gestes, TalkBack, le clavier Android, les icônes/splash ou le cycle de vie natif. Elles constituent une inspection du contenu et du rendu Web des composants, sans essai sur téléphone ni émulateur. La recette Android reste décrite dans [ANDROID_ACCEPTANCE.md](ANDROID_ACCEPTANCE.md).

Documentation utilisée : [Expo Web](https://docs.expo.dev/workflow/web/), [SDK 57](https://docs.expo.dev/versions/v57.0.0/), [index Expo](https://docs.expo.dev/llms.txt). Le comportement d'Alert est contrôlé dans le paquet React Native Web installé.

## Validation de cette branche

- Galerie : 15 PNG produits et chargés depuis le HTML local dans Chrome, sans erreur JavaScript.
- `npm run check` : TypeScript, ESLint et 153 tests / 7 suites réussis.
- `npx expo-doctor` : 21/21 contrôles réussis.
- Export Web : 891 modules, bundle 1,4 MB.
- `npm run bundle:android` : 1 422 modules, bundle 3,2 MB, 29 assets.
- Configuration Expo hors prévisualisation : Android uniquement.
- Aucun test sur appareil/émulateur ; aucun push ni fusion.

