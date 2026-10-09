# Passation immédiate à Claude Code — BilanGo

Checkpoint du 9 octobre 2026. Dépôt `Monoru1/bilango`, branche **`feat/client-ui-feedback`**, créée depuis le dernier état distant validé `feat/android-foundation` : `a2e7d5665993615512af2af3ccd8ba669dd35498`. Fetch effectué ; fondation locale/distante identiques. Aucun merge main, aucune réécriture d'historique. Les changements validés sont sauvegardés dans le commit de checkpoint. Pour son SHA exact : `git log -1 --oneline` et `git rev-parse origin/feat/client-ui-feedback` après fetch.

## Prochain travail exact

1. Lire ce document, AGENTS.md, ARCHITECTURE §11 et le cahier ; vérifier branche, HEAD et état Git. Ne pas recommencer l'audit mission 04.
2. Ouvrir `artifacts/visual-preview/index.html` dans Chrome, ou régénérer avec `npm run preview:visual`. Examiner en priorité les deux accueils et le calendrier face à la **page 3 du PDF client**.
3. Exécuter la recette **Android réelle** de `docs/ANDROID_ACCEPTANCE.md` : calendrier long/une journée/futur/invalide, grandes polices, clavier, retour système, deux profils, puis icônes adaptive et splash sur binaire release. Renseigner les résultats et corriger uniquement les KO observés. Sans appareil disponible, documenter cette limite et poursuivre la revue ciblée de ces composants.

Ne lancer aucune réécriture web ni nouvelle fonctionnalité majeure pendant cette reprise. Priorité : finalisation Android ; ensuite audit de sécurité/tests d'intrusion autorisés, corrections de sécurité/RGPD, version web propre, recette complète et livraison.

## Architecture et fonctionnalités existantes

Expo SDK 57 / React Native 0.86 / React 19.2.3 / TypeScript strict / Expo Router. Android natif, pas de WebView. `src/domain` porte les règles pures ; `src/services/types.ts` les contrats ; `services/mock` leur implémentation mémoire ; `src/state` les providers, session/PIN, business et requêtes ; `src/features` les composants métier ; `src/ui` les primitives/tokens. Les routes sont dans `src/app`.

Existant conservé : OTP de démonstration + PIN/SecureStore, création et sélection multi-business, permissions par business et rôles personnalisés, invitations/acceptation, bilans multi-contributeurs, versions et modification 24 h, caisse dérivée, historique, équipe, stock facultatif, abonnement en lecture seule et aide. Aucun paiement ou lien de paiement dans l'app. Aucun backend, WhatsApp réel, FCM ou paiement réel ajouté. Les mocks n'offrent aucune sécurité.

## Demandes client et travaux terminés

- **Dashboard** : blanc, CA noir dominant et FCFA secondaire, vraie mini-courbe, pastille de variation, caisse/dépenses en rangée, détails en lignes, bouton quasi noir, périodes soulignées.
- **Accueil Saisie seule** : prénom, rôle métier réel, carte sombre de bilan, état non envoyé/envoyé, action selon les droits et la fenêtre 24 h, caisse disponible, trois bilans personnels précédents, Accueil/Historique. Gestion complète et Lecture seule conservent leurs permissions et l'aiguillage existant.
- **Logo** : fichiers client 512/1024 copiés sans recoloration ; en-tête à gauche du business, connexion/menu via le composant commun ; anciens assets remplacés. Couches adaptive/monochrome dérivées du SVG ; splash centré sur blanc. Script Windows reproductible.
- **Calendrier** : mois français + saisie directe JJ/MM/AAAA, début/fin libres, bornes inclusives, journée unique, futures/inversions/dates impossibles rejetées, aucune plage maximale. La saisie du début permet de sauter directement à une année ancienne. Sélection conservée par business pendant les navigations de session.
- **Finance** : service accepte périodes rapides ou intervalle ; agrégats des versions courantes ; solde de caisse à la borne finale avec mouvements antérieurs, sans double comptage. Calcul sans énumérer des années de jours vides. Tendance uniquement sur jours renseignés ; comparaison période précédente de même durée, neutre si non comparable.
- **Captures** : vrais composants Expo Web via Chrome installé/Playwright, 15 PNG 412×915 et galerie HTML locale. Le script attend la disparition des chargements (une capture manager initiale avait montré les spinners, corrigée puis régénérée). Aucun navigateur téléchargé, aucune app web commerciale.

## Fichiers récemment modifiés

| Zone | Fichiers |
| --- | --- |
| Rendu accueil | `src/features/dashboard/Dashboard.tsx`, nouveau `PeriodPicker.tsx`, `src/features/home/ManagerHome.tsx`, `src/app/(app)/(tabs)/_layout.tsx` |
| Domaine / contrat | `src/domain/dates.ts`, `reports.ts`, `src/services/types.ts`, `src/services/mock/index.ts` |
| État / UI | `src/state/business.tsx`, `src/ui/theme.ts`, `primitives.tsx`, `logo.tsx` |
| Assets | `assets/images/logo.png`, `icon.png`, `brand.svg`, couches `android-icon-*.png`, `splash-icon.png`, `app.json`, `scripts/prepare-brand.ps1` |
| Recette PC conservée | `app.config.js`, `src/state/storage.web.ts`, `scripts/visual-preview.mjs`, package/lock, `.gitignore`, `docs/VISUAL_PREVIEW.md` |
| Tests / documentation | tests existants domaine, mock, navigation, contraste/assets ; README, ARCHITECTURE, IMPLEMENTATION_PLAN, BRANDING_ASSETS, HANDOFF et ce document |

La prévisualisation préparée auparavant sur `feat/visual-preview` était non commitée ; elle est conservée dans ce checkpoint. Artefacts temporaires, PDF rendu et outil Python temporaire sont sous `artifacts/visual-preview/`, ignorés par Git. Ne pas les ajouter au commit. Les originaux client restent aussi dans Downloads ; le projet contient tous les assets nécessaires.

## Validation réellement exécutée

| Contrôle | Résultat |
| --- | --- |
| `npm run check` | réussi : TypeScript, ESLint et Jest |
| Jest | **153 tests / 7 suites**, tous réussis, sans filtrage des avertissements act |
| Navigation | 28 tests inclus : navigation 15 + consolidation 13, vrais composants/routes avec modules natifs doublés |
| Domaine / mock | plages longues, limites inclusives, invalides/futures, vide, versions, agrégats, caisse, fuseau Porto-Novo et permissions testés |
| UI | contrastes AA des nouveaux tokens, PNG/configuration, logo contain, plafond texte 1,8 et cibles calendrier 48 px |
| `npx expo-doctor` | **21/21**, réussi avec accès réseau autorisé |
| `npm run bundle:android` | réussi : **1 422 modules**, Hermes ≈3,2 Mo, **29 assets** |
| Export Web / galerie | 891 modules, ≈1,4 Mo ; 15 captures générées, dimensions contrôlées, HTML ouvert localement dans Chrome et images chargées, aucune erreur JavaScript |
| Téléphone / émulateur / EAS | **non exécutés** |

Les échecs intermédiaires ont été corrigés : contraste du badge, attentes de navigation du test et capture pendant chargement. Ne pas confondre tests RN doublés/export avec recette native. Les avertissements NO_COLOR/FORCE_COLOR de Metro ne sont pas des erreurs de compilation.

## Problèmes connus et écarts

- **P0 avant production** : backend/RLS, OTP réel, anti-abus, sessions serveur, webhooks et conformité à réaliser ; PIN mock en clair, métier volatile. Audit de sécurité à organiser après finalisation Android, dans un périmètre explicitement autorisé.
- **P1 immédiat** : fidélité finale sur Android non vérifiée ; grandes polices, clavier, zones système, geste Retour, TalkBack, icônes thématiques et splash release attendent un appareil. Les tests vérifient les propriétés, pas le rendu natif.
- **P1 visuel** : maquette reproduite avec adaptations AA (#9AA09C non utilisé pour texte courant, rouge renforcé), hamburger conservé, données/noms fictifs existants plutôt que chiffres Awa de la maquette. Le calendrier n'a pas de référence graphique dans le PDF.
- **P2** : finitions éventuelles du calendrier sur petit écran/grande police, bouton Appliquer accessible par défilement dans la feuille ; revoir la longueur des libellés de tendance si le futur backend apporte de nombreux points. Les sélections ne persistent pas après fin de session.
- **Hors itération** : PDF de bilan absent, rôles non renommables/supprimables, édition/suppression business et réapprovisionnement stock absents, historique non paginé, push non réels, politique de confidentialité/Play Store non faits.
- Trois questions métier **inchangées** : numéro invité → Invitations ou dashboard, un bilan par auteur/jour, nom à l'inscription. Ne pas les trancher. Expiration abonnement et durée d'essai restent non spécifiées.

Web local : DOM/CSS, absence de barres système et clavier Android, stockage mémoire éphémère ; `Alert.alert` de React Native Web est vide. Aucun parcours de confirmation native n'est présenté comme testé via Chrome. Voir VISUAL_PREVIEW.

## Commandes et références

```powershell
npm ci
npm start                    # Expo Go Android, sur appareil disponible
npm run android             # seulement si appareil/émulateur configuré
npm run check               # TS + lint + tous les tests
npm test -- --runInBand
npx expo-doctor
npm run bundle:android
npm run preview:visual      # Chrome PC, export + captures + galerie
powershell -File scripts/prepare-brand.ps1
```

Node ≥22.13. Toute dépendance via `npx expo install`, documentation SDK 57 avant modifications Expo/RN. Ne pas éditer android/ios à la main. La cible Web est activée uniquement par le script (`BILANGO_VISUAL_PREVIEW=1`, `EXPO_NO_WEB_SETUP=1` pour le contrôle statique du CLI) ; Android reste la configuration par défaut.

PDF source local : `C:/Users/sakry/Downloads/bilango-ameliorations-design.pdf`, page 3 prioritaire. Galerie : `C:/Users/sakry/bilango/artifacts/visual-preview/index.html`, manifeste voisin avec HEAD, branche, état dirty, routes et version Chrome. Les captures sont régénérables, pas publiées dans Git. Ne pas fusionner main sans validation propriétaire.
