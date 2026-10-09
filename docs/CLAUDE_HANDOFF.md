# Passation immédiate à Claude Code — BilanGo

> **Mise à jour — reprise Claude Code, mission 04 (9 octobre 2026).** Cette section remplace « Prochain travail exact » et le tableau de validation plus bas, conservés pour l'historique du checkpoint `24369ec`.


## Build APK EAS (démonstration privée) — 9 octobre 2026

| Élément | Valeur |
| --- | --- |
| Statut | **Réussi** (FINISHED, ≈ 21 min dont file d'attente) |
| Profil | `preview` — APK, distribution interne, serveurs EAS Build |
| Commit compilé | `53b37ab3796740f87424f9738eb3d74674cb8bcf` (branche `feat/client-ui-feedback`) |
| Build Expo | https://expo.dev/accounts/monoru1s-team/projects/bilango/builds/20c1fd86-5afa-46b2-bae4-218e9dc89960 |
| APK | https://expo.dev/artifacts/eas/o1F3j-LRGA3PZqXux1jO3WPYztviWlRi7UoZeiLVzvk.apk (HTTP 200, ≈ 103 Mo) |
| Projet / compte | `@monoru1s-team/bilango`, ID `14f789f6-e58c-464e-a128-1e64f57d8eab` |
| Package / version | `bj.novadis.bilango`, 0.1.0, versionCode 1 |
| Signature | keystore généré et conservé par EAS (gestion officielle) — ne pas le perdre si l'app est un jour publiée |

Installation : ouvrir le lien APK sur le téléphone Android, autoriser « Installer des applications inconnues » pour le navigateur utilisé, installer, ouvrir BilanGo. Connexion : numéro de la liste du README, code OTP `123456`.

Limites : build de démonstration privé avec données fictives et authentification simulée ; **non testé sur un appareil** (aucun téléphone ni émulateur disponible) — la recette `docs/ANDROID_ACCEPTANCE.md` reste à exécuter ; APK multi-architectures volumineux (un `.aab` ou des splits réduiraient la taille, hors périmètre) ; le lien d'artefact peut expirer, le retrouver depuis la page du build ; aucun Play Store, backend, paiement ni OTP réel.

Pour rebuilder : `npx eas-cli@latest build --platform android --profile preview` (session `eas login` requise ; incrémenter `android.versionCode` pour une nouvelle version installable par-dessus).
## État actuel

Branche `feat/client-ui-feedback` (publiée sur `origin`). Commits de la reprise : `59a2e95` (correctifs Android) et `55d5d31` (documentation) sur `24369ec` ; le commit de passation les suit (`git log --oneline -5`). Rien fusionné dans `main`.

**Retours client (PDF « Direction visuelle finale »)** — vérifiés dans le code et les captures Chrome, puis complétés : dashboard blanc avec CA noir + FCFA atténué, sparkline, pastille de variation, onglets de période soulignés, caisse/dépenses en rangée, détail en lignes, bouton quasi noir ; accueil Saisie seule avec prénom, badge de rôle, carte sombre, caisse disponible, trois bilans précédents, deux onglets ; logo client ; période personnalisée (calendrier + saisie, bornes inclusives, une journée, années multiples, futures/inversées refusées, calculs sans énumérer les jours). **Corrigés dans cette reprise** : en-têtes blancs sur tous les écrans (barre d'état lisible), onglets à point actif sans icônes, saisie des dates au pavé numérique avec masque `JJ/MM/AAAA`, clavier des feuilles modales, `allowBackup=false`, permissions Android réduites à `INTERNET` + `VIBRATE`.

## Validation exécutée (HEAD `55d5d31`)

| Contrôle | Résultat |
| --- | --- |
| `npm run check` | exit 0 |
| Jest | **157 tests / 7 suites** réussis, **0 avertissement `act`** |
| TypeScript, ESLint | propres, 0 avertissement |
| `npx expo-doctor` | 21/21 |
| `npm run bundle:android` | OK : 1 423 modules, Hermes 3,2 Mo |
| `expo prebuild --platform android` | manifeste contrôlé (permissions, backup, edge-to-edge, schéma) puis dossier ignoré supprimé |
| `npm run preview:visual` | 15 captures régénérées et relues (en-têtes, onglets, calendrier) |
| `npm audit` | 61 avis, tous transitifs de l'outillage de build/test (voir ARCHITECTURE §12) |
| Téléphone / émulateur / EAS | **non exécutés** (pas de SDK Android, ni d'appareil) |

## Problèmes restants

- Aucune recette native : suivre `docs/ANDROID_ACCEPTANCE.md` (D, P, A1–A16). À observer en priorité : clavier dans le calendrier et les formulaires en edge-to-edge (A5, A14), grandes polices, geste Retour, TalkBack, icône adaptive et splash sur binaire release.
- Sécurité : P0/P1 listés dans `docs/ARCHITECTURE.md` §12 (mock sans authentification, mode démo en dur, PIN en clair, validations côté client uniquement).
- Logo : fond #25D366 (proche de WhatsApp) différent de la palette du cahier (#0F6E56) — à faire confirmer par le client.
- Questions métier toujours ouvertes (numéro invité, un bilan par auteur et par jour, nom à l'inscription, expiration d'abonnement, durée d'essai) : ne pas trancher sans le client.
- Hors itération : PDF du bilan, push réels, backend, paiement, confidentialité/Play Store, pagination de l'historique, édition de rôles/business.

## Commandes

`npm ci` · `npm start` (Expo Go) · `npm run check` · `npx expo-doctor` · `npm run bundle:android` · `npm run preview:visual` (Chrome + Playwright). Ne jamais lancer `expo prebuild` sans restaurer `package.json` (il réécrit le script `android`) ni laisser `android/` dans le dépôt.

## Prochaines missions

1. **Recette Android** sur un vrai téléphone (docs/ANDROID_ACCEPTANCE.md), correction des KO, build EAS `preview` (APK) pour le client.
2. **Sécurité approfondie** : backend de test + comptes autorisés, RLS, OTP/anti-abus, sessions, journaux ; tests d'intrusion limités à cet environnement ; mode démo retiré du binaire de production.
3. **Conformité** : confidentialité, suppression de compte/données, fiche Play Store, test fermé.
4. **Version web** : prérequis détaillés dans `docs/ARCHITECTURE.md` §13 (le cœur `domain`/`services` n'a aucune dépendance Android).

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
