# HANDOFF — reprise du travail (mission 03 interrompue)

Branche : `feat/android-foundation` (publiée sur `origin`). Aucun backend réel, aucun paiement, aucun OTP réel : tout reste simulé (voir README). **Rien n'a été testé sur appareil Android ou émulateur** (pas de SDK sur la machine de développement).

Date de la dernière session : 2026-10-09. Documents de référence : `docs/CAHIER_DES_CHARGES.md`, `AGENTS.md`, `docs/ARCHITECTURE.md`, `docs/IMPLEMENTATION_PLAN.md`.

## 1. Travaux terminés (mission 03, partie accessibilité / clavier)

Commit `93ee67b` (« feat(a11y) »), précédé de `2dd63f7` (mission 02, déjà publié).

- **Contraste WCAG AA** : `colors.textMuted` assombri (`#7D8F88` → `#5B6D66`) ; les légendes posées sur le vert principal utilisent `primaryTint` au lieu de `primaryLight` (3:1, insuffisant). Test automatique `src/ui/__tests__/contrast.test.ts` (19 paires texte/fond réellement utilisées ≥ 4,5:1).
- **TalkBack / sémantique** : icônes décoratives masquées ; `title`/`heading` exposés en rôle `header` ; libellés riches (montant + état) pour l'en-tête du dashboard, les lignes d'historique, le détail du jour et les business du menu ; `ListItem` accepte `accessibilityLabel` ; choix (`ChoiceList`) lus avec leur description ; `Switch` interne non dupliqué.
- **Zones tactiles ≥ 48 px** : segments, accordéons de l'aide, « Détailler », boutons compacts (44 px + `hitSlop`). Touches du pavé PIN en `minHeight`.
- **Polices et petits écrans** : `maxFontSizeMultiplier` = 1,8 (constante `MAX_FONT_SCALE` dans `ui/primitives.tsx`) sur `Text` et les champs ; libellés des segments sur une ligne avec réduction automatique.
- **Clavier Android** (doc Expo « Keyboard handling », vérifiée) : `Screen` enveloppé dans `KeyboardAvoidingView` sans `behavior` ; `tabBarHideOnKeyboard: true` sur les onglets ; marge basse `insets.bottom` pour les écrans sans pied de page ; indices d'autofill (`tel`, `sms-otp`, `name`).
- **Barre d'état** : icônes claires sur les en-têtes verts de `(app)`, sombres sur `no-business`.
- **Retour Android** : `useConfirmLeave` (nouveau, `src/features/report/useConfirmLeave.ts`) demande confirmation avant d'abandonner un bilan modifié ; désactivé après envoi réussi.

## 2. Fichiers modifiés ou créés par `93ee67b`

Créés : `src/features/report/useConfirmLeave.ts`, `src/ui/__tests__/contrast.test.ts`.

Modifiés : `src/ui/theme.ts`, `src/ui/primitives.tsx`, `src/ui/forms.tsx`, `src/ui/pinpad.tsx`, `src/features/dashboard/Dashboard.tsx`, `src/features/menu/SideMenu.tsx`, `src/features/report/ReportForm.tsx`, `src/app/(app)/_layout.tsx`, `src/app/(app)/(tabs)/_layout.tsx`, `src/app/(app)/(tabs)/reports.tsx`, `src/app/(app)/day/[day].tsx`, `src/app/(app)/help.tsx`, `src/app/(app)/no-business.tsx`, `src/app/(app)/team/invite.tsx`, `src/app/(auth)/otp.tsx`, `src/app/(auth)/phone.tsx`, `src/app/onboarding.tsx`.

Ce fichier (`docs/HANDOFF.md`) est ajouté dans un commit séparé.

## 3. Tests et validations exécutés (état au commit `93ee67b`)

| Validation | Résultat |
| --- | --- |
| `npm run check` (tsc + ESLint + Jest) | exit 0 |
| Jest | **98 tests, 7 suites, tous réussis** (domaine 27, services mock 22, session 8, brouillon 5, contraste 19, navigation 17) |
| `tsc --noEmit` | propre |
| ESLint | 0 erreur, 0 avertissement (une seule règle désactivée : `react/no-unescaped-entities`, justifiée dans `eslint.config.js`) |
| `npx expo-doctor` | 21/21 |
| `npx expo export --platform android` | OK, bundle Hermes 3,5 Mo |

Non exécuté : toute recette sur téléphone ou émulateur Android.

Commande pour tout rejouer : `npm run check && npx expo-doctor && npm run bundle:android`.

## 4. Travaux incomplets (non commencés, rien de partiel dans le dépôt)

La mission 03 demandait aussi les points suivants, **non réalisés** :

1. **`docs/ANDROID_ACCEPTANCE.md`** : checklist de recette sur téléphone — non créée. Doit couvrir : installation Expo Go, comptes de démo (README), parcours par rôle, TalkBack (activer, parcourir connexion / dashboard / bilan), police agrandie (Réglages → Affichage → taille de police maximale), petit écran (≈ 320 dp), clavier (numérique, masquage des onglets, champ visible au-dessus du clavier dans le formulaire de bilan), bouton retour système (menu latéral, feuille modale, confirmation d'abandon du bilan, sortie de l'app), rotation/état de veille, verrouillage par PIN, états vides et erreurs, barre de navigation système (marges basses), et un tableau Résultat / Date / Appareil / Version Android / Remarques.
2. **Avertissements `act(...)` dans les tests** : 30 occurrences (15 `RootNavigator`) restantes, dues aux mises à jour d'état asynchrones du contrôleur de session après un `fireEvent`. Piste correcte (ne pas masquer) : dans `src/test-utils/flows.ts`, remplacer les `fireEvent.press`/`changeText` suivis d'un traitement asynchrone par `await act(async () => { fireEvent.press(el); })` afin de vider les micro-tâches dans `act`, puis l'utiliser dans les tests de navigation.
3. **Scénario de démonstration automatisé complet** (création du business → invitation → bilan manager → caisse → consultation propriétaire, en changeant de compte dans une même session de services). Plan : un seul `renderRouter` dans `src/__tests__/demo-scenario.test.tsx` ; comme `ServicesProvider` conserve la même base mock, se déconnecter via menu → « Se déconnecter » → « PIN oublié ou autre numéro », puis se reconnecter avec un autre numéro. Séquence : 99 (crée « Kiosque du Port », secteur Boutique) invite 06 (rôle Vendeur) → 06 se connecte, nomme son profil, accepte l'invitation la plus récente (`getAllByLabelText('Accepter')[0]`), envoie un bilan avec caisse de départ 15 000, CA 40 000, dépenses 5 000 → 99 se reconnecte et voit CA 40 000 et caisse théorique 50 000. Le scénario manuel existe déjà dans le README.
4. **Préparation icônes et splash BilanGo** : non faite. À produire sans inventer d'identité : `docs/BRANDING_ASSETS.md` listant les fichiers attendus et leurs formats (icône 1024×1024, `android-icon-foreground/background/monochrome.png` 1024×1024 avec zone de sécurité centrale, `splash-icon.png`, fond `#0F6E56`), des sources SVG fidèles à la description du cahier §7 (carré arrondi vert `#0F6E56`, œil blanc, barres montantes dans l'iris — géométrie déjà dans `src/ui/logo.tsx`), et un test qui lit `app.json` et vérifie que les fichiers existent, sont carrés et aux bonnes dimensions (lecture de l'en-tête PNG). Les images actuelles dans `assets/images/` sont des placeholders Expo ; ne pas les considérer comme l'identité finale.
5. **Documentation** : README, `docs/ARCHITECTURE.md` et `docs/IMPLEMENTATION_PLAN.md` ne mentionnent pas encore les changements d'accessibilité de `93ee67b` (contraste testé, `MAX_FONT_SCALE`, `useConfirmLeave`, comportement clavier). À ajouter brièvement (ARCHITECTURE §6 et §9, README « Limites connues »).
6. **Points à auditer encore** (non vérifiés, ne rien affirmer sans test) : comportement exact de `KeyboardAvoidingView` sans `behavior` en edge-to-edge Android 15 avec le formulaire de bilan long ; marge basse en doublon sous les onglets (probablement ~24 dp en trop, inoffensif) ; contraste du texte sur les cartes `tone="primary"` avec `Badge` ; rendu des grandes polices sur les lignes `ListItem` avec badges à droite.

## 5. Blocages

Aucun blocage technique. Limites d'environnement : pas de SDK Android, de Java ni d'`adb` sur la machine ; aucune validation native possible ici. Trois questions fonctionnelles restent à trancher par le client (voir `docs/ARCHITECTURE.md` §7 et `docs/IMPLEMENTATION_PLAN.md`) : numéro déjà invité (écran Invitations vs accès direct), un bilan par auteur et par jour, nom demandé à la première connexion. **Ne pas modifier ces règles sans validation.**

## 6. Instructions pour Codex (reprise)

1. `git fetch origin && git status -sb` ; vérifier que `HEAD` = `origin/feat/android-foundation`. Ne rien réinitialiser. Ne pas fusionner dans `main` sans autorisation du propriétaire du dépôt. Travailler sur cette branche.
2. `npm install` puis `npm run check` : doit afficher 7 suites / 98 tests réussis. Si ce n'est pas le cas, corriger avant tout.
3. Lire `AGENTS.md` (règles non négociables : aucun parcours de paiement dans l'app, mocks ≠ sécurité, permissions via `domain/permissions.ts`, caisse dérivée, `npx expo install` pour toute dépendance).
4. Traiter les travaux de la section 4 dans cet ordre : (4.2) avertissements `act`, (4.3) test de scénario de démonstration, (4.1) `docs/ANDROID_ACCEPTANCE.md`, (4.4) préparation des assets de marque, (4.5) documentation. Un commit cohérent par point.
5. Après chaque point : `npm run check && npx expo-doctor && npm run bundle:android`, puis commit. Pousser avec `git push origin feat/android-foundation` seulement si ces validations passent.
6. Ne pas écrire « testé sur Android » tant qu'une recette sur appareil ou émulateur n'a pas été faite et consignée dans `docs/ANDROID_ACCEPTANCE.md`.
7. Pas de backend réel, de paiement ni d'OTP réel dans cette phase. Ne pas ajouter de dépendance lourde (la gestion avancée du clavier via `react-native-keyboard-controller` exigerait un development build : seulement si la recette montre un défaut réel).
