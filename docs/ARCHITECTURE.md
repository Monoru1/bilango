# Architecture de BilanGo

Application Android native : Expo SDK 57, React Native 0.86, TypeScript strict, Expo Router (routes typées), React Compiler activé. Référence fonctionnelle : [CAHIER_DES_CHARGES.md](CAHIER_DES_CHARGES.md).

## 1. Principe : des couches qui ne remontent jamais

```
src/app        routes (écrans fins)            ─┐
src/features   composants métier                ├─ dépendent de ↓
src/ui         design system                    │
src/state      session, business courant, useQuery
src/services   contrat typé + implémentation mock
src/domain     modèle et règles métier PURES   (aucun import React / Expo)
```

- `domain` ne connaît ni React, ni Expo, ni les services. Toute règle du cahier y vit et y est testée.
- `services/types.ts` est le **contrat** consommé par l'UI. L'implémentation actuelle (`services/mock`) est interchangeable.
- Les écrans n'importent jamais `services/mock` : ils passent par `useServices()`.

## 2. Domaine (`src/domain`)

| Fichier | Contenu |
| --- | --- |
| `types.ts` | `User`, `Business`, `Role`, `Member`, `Invitation`, `Report` (versions), `Subscription`… |
| `permissions.ts` | niveaux, rang hiérarchique, `can`, `canManageMember`, `canGrantLevel`, `canEditReport` (fenêtre de 24 h) |
| `reports.ts` | validation du brouillon, agrégats par jour/période, chiffre principal du dashboard, **caisse théorique**, stock |
| `subscription.ts` | statut (essai / actif / expiré), jours restants, règle de prolongation de 30 jours |
| `dates.ts`, `money.ts` | jours métier à Cotonou (UTC+1), formats FR, FCFA entiers, numéros béninois |

Choix structurants :

- **Le rôle est une propriété de la relation compte ↔ business** (`Member.roleId`, `null` = propriétaire). Un compte peut être propriétaire ici et manager là-bas.
- **Un bilan porte ses versions** (`Report.versions[]`, la première est l'original). La version courante est la dernière ; aucune donnée n'est écrasée.
- **La caisse théorique est dérivée, jamais stockée** : `cashTimeline()` rejoue les bilans courants depuis la caisse de départ. Une modification se répercute donc automatiquement sur tous les jours suivants (cahier §5.5), sans état à synchroniser. Aucun écart ni alerte n'est calculé (§5.3).
- **Soft delete** : un membre retiré passe à `status: 'removed'` ; ses bilans restent, avec `authorName` figé.
- **Montants** : entiers FCFA sûrs, y compris lignes détaillées et caisse initiale ; ventes validées par article du business, sans doublon.
- **Stock** : quantité de départ par article ; restant = départ − ventes déclarées dans les versions courantes des bilans.

## 3. Services (`src/services`)

`types.ts` définit `AuthService`, `BusinessService`, `ReportService`, `TeamService`, `StockService`, `SubscriptionService`, plus `DataEvents` (notification après écriture) et `ServiceError` (codes `FORBIDDEN`, `VALIDATION`, `EDIT_WINDOW_CLOSED`, `RATE_LIMITED`…) avec messages français.

`services/mock/` implémente le tout en mémoire, avec latence simulée (250 ms) pour exercer les états de chargement. Il applique les mêmes règles que le futur serveur (permissions, hiérarchie, fenêtre de 24 h, validation, stock, rate limiting OTP) pour que l'UI soit écrite contre le bon contrat. Les données de démo (`seed.ts`) sont déterministes et relatives à la date du jour.

> **Le mock n'est pas une sécurité.** Tout s'exécute sur l'appareil : il n'authentifie personne, ne protège aucune donnée et ne remplace ni la vérification des permissions à chaque requête côté serveur (cahier §10), ni l'anti-abus OTP (rate limiting, device/IP, CAPTCHA), ni la vérification de signature des webhooks.

L'UI ne dépend plus des constantes du mock : `AuthService.demo` expose facultativement les comptes/code de démonstration ; le délai de renvoi OTP vient de `requestOtp`. `ManagerHome.cash` ne contient que le solde, et `DayView.cash` est absent pour Saisie seule : pas de mouvements globaux exposés à ce niveau.

### Brancher un vrai backend

1. Écrire une implémentation de `Services` (HTTP, Supabase…) qui lève des `ServiceError` aux mêmes codes.
2. La retourner dans `src/state/composition.ts` (`createAppServices`), seul point de choix.
3. Faire émettre `events.subscribe` après les écritures (ou remplacer `useQuery` par TanStack Query en gardant sa signature).
4. Rejouer `npm test` : `services/mock/__tests__` décrit le comportement attendu et peut servir de suite de contrat.

## 4. État (`src/state`)

- `session-controller.ts` : machine d'états `booting → signedOut | locked | onboarding | ready`, indépendante de React et testée. Persistance du jeton et du PIN dans `expo-secure-store`. Déconnexion volontaire = verrouillage (le PIN suffit) ; PIN oublié ou 5 erreurs = appareil oublié, nouvel OTP requis.
- `services.tsx` : `useDeadlineClock` réévalue la fenêtre de modification à la prochaine échéance et au retour de veille, sans polling ; utilisé par accueil manager, historique, détail et édition.
- `business.tsx` : liste des business du compte, business courant mémorisé, état du menu latéral ; période du dashboard conservée en mémoire par business pendant la session.
- `services.tsx` : `ServicesProvider`, `useServices`, `useQuery(key, fetcher)` — états chargement/erreur, rechargement automatique après écriture, au minuit Cotonou et à la reprise, jamais de données d'une autre clé.

## 5. Navigation (`src/app`)

```
_layout                         providers + Stack.Protected selon l'état de session
  index                         aiguillage (Redirect)
  (auth)/welcome|phone|otp      session = signedOut
  unlock                        session = locked        (PIN)
  onboarding                    session = onboarding    (nom, création du PIN)
  (app)/                        session = ready         BusinessProvider + menu latéral
    (tabs)/home|reports|team|stock
    report/new, report/[id], report/[id]/edit, day/[day]
    invitations, subscription, help, business/new, no-business
    team/invite, team/role-new, stock/new
```

Les onglets se masquent selon les droits (`href: null`) : Équipe pour propriétaire/gestion complète, Stock si le module est activé et visible. L'accueil bascule entre **tableau de bord** (propriétaire, gestion complète, lecture seule) et **accueil manager** (saisie seule). Le menu latéral (hamburger) liste les business avec le CA du jour, marque le courant, donne « Faire le bilan du jour », les jours d'abonnement restants et « + Ajouter un business ».

Les routes de saisie, d'invitation, de rôle, d'abonnement et d'ajout de stock sont protégées par `Stack.Protected` et `can`, y compris les liens directs ; les routes dépendant d'un business ne montent pas sans business courant. Le mock revérifie les droits à chaque écriture. `canViewReport` et `canEditReport` vérifient aussi l'identifiant du business.

## 6. Design system (`src/ui`)

`theme.ts` : palette officielle (#0F6E56, #085041, #5DCAA5), espacements, typographie, cible tactile minimale 48 px. Composants : `Screen`, `Text`, `Button`, `Card`, `ListItem`, `Badge`, `Avatar`, `TextField`, `AmountField` (milliers, clavier numérique), `Segmented`, `ChoiceList`, `SwitchRow`, `BottomSheet`, `PinPad`, `Logo` (SVG), états `LoadingState` / `ErrorState` / `EmptyState` / `Banner` / `AsyncBoundary`. Un seul chiffre fort par écran (`BigAmount`).

Accessibilité mission 03 : contraste texte/fond ≥ 4,5:1 testé, icônes décoratives masquées, titres sémantiques, libellés TalkBack et cibles tactiles ≥ 48 px. `MAX_FONT_SCALE = 1.8` sur textes/champs ; `KeyboardAvoidingView`, masquage des onglets au clavier et marges système. `useConfirmLeave` confirme l'abandon d'un brouillon et se désactive après envoi réussi. Ces adaptations attendent une recette native, notamment le clavier edge-to-edge et les lignes avec badges à grande police.

Les PNG d'icône/adaptive/monochrome/splash reprennent le logo SVG : [BRANDING_ASSETS.md](BRANDING_ASSETS.md). Aucun dossier natif modifié.

## 7. Décisions et interprétations (à valider avec le client)

> **Ce ne sont pas des décisions définitives.** Ce sont des interprétations de travail, retenues pour pouvoir démontrer l'application. Les lignes 1 (numéro invité), 2 (nom à l'inscription) et 3 (un bilan par auteur et par jour) sont des **questions ouvertes à soumettre au client** ; elles sont reprises dans [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md).

| # | Point du cahier | Choix retenu |
| --- | --- | --- |
| 1 | §3.3 « numéro déjà invité → dashboard directement » vs §4.2bis « accès après acceptation » | Un compte sans business mais avec invitation(s) arrive sur l'écran **Invitations** ; le dashboard s'ouvre après acceptation. |
| 2 | §3.1 inscription par téléphone seul vs noms visibles sur les bilans | Un écran demande le **nom** à la première connexion. |
| 3 | §5.2 plusieurs bilans par jour | Plusieurs **contributeurs** par jour ; un même auteur ne peut envoyer qu'un bilan par jour (il utilise « Modifier », 24 h). |
| 4 | Jour d'un bilan | Dérivé de l'heure d'envoi (jour de Cotonou) ; pas d'antidatage. |
| 5 | §5.3 caisse de départ « une seule fois » | Demandée dans le formulaire du premier bilan du business ; vaut solde avant les mouvements de ce jour. |
| 6 | §4.2 création de rôles | Réservée au propriétaire ; « Gestion complète » invite seulement aux niveaux inférieurs. |
| 7 | §4.3 rang | owner > gestion complète > saisie seule = lecture seule (aucun des deux derniers ne gère l'autre). |
| 8 | §9.5 | Aucun parcours de paiement : l'écran « Mon abonnement » est en lecture seule. |
| 9 | Comportement d'un abonnement expiré | Non spécifié : l'app l'affiche mais ne bloque rien (voir plan). |
| 10 | Rappel et push | Heure configurable et affichée ; aucune notification n'est envoyée dans cette version. |

## 8. Tests

`npm test` (Jest, `jest-expo`) :

- `domain/__tests__` : règles pures (permissions, 24 h, caisse en cascade, dashboard, stock, abonnement).
- `services/mock/__tests__` : contrat de bout en bout (OTP, multi-business, invitations, soft delete, bilans, stock).
- `state/__tests__` : session persistante, PIN, verrouillage.
- `features/report/__tests__` : brouillon du formulaire.
- `src/__tests__/navigation.test.tsx` et `consolidation.test.tsx` : **vrai arbre de routes** rendu avec `expo-router/testing-library` (connexion OTP + PIN, gardes de session, menu multi-business, saisie / modification de bilan, caisse après premier bilan, création de business, invitations, abonnement sans parcours de paiement, permissions par rôle, scénario complet avec changement de comptes, expiration automatique 24 h et routes directes interdites). Modules natifs doublés dans `jest.setup.ts`, helpers dans `src/test-utils/flows.ts`.

Ces tests ne remplacent pas un essai sur appareil ou émulateur (rendu, clavier, gestes) : aucun n'a été exécuté faute de SDK Android sur la machine de développement. Procédure et journal : [ANDROID_ACCEPTANCE.md](ANDROID_ACCEPTANCE.md). Les gestes asynchrones sont attendus dans `act` ; aucun diagnostic React n’est filtré. Les cinq PNG/configurations sont contrôlés dans les tests UI.

## 9. Choix d'outillage

- **ESLint** : config Expo complète, avec une seule règle désactivée, `react/no-unescaped-entities`. Raison : l'interface est en français, le texte JSX est plein d'apostrophes ; en React Native le texte est rendu tel quel dans `<Text>` (pas d'analyse HTML), et les échapper (`&apos;`) dégraderait la relecture des textes. Justification également en commentaire dans `eslint.config.js`.
- **Produit Android** : `app.json` déclare `platforms: ["android"]`. `react-native-web`, `react-dom` et `playwright-core` sont des dépendances de développement pour la recette locale ; `app.config.js` active Web seulement avec `BILANGO_VISUAL_PREVIEW=1`. Aucun produit web commercial.
- **Icônes** : import ciblé `@expo/vector-icons/Ionicons` ; `expo-symbols` (iOS) n'est pas utilisé.

## 10. Audit fonctionnel — mission 04 (2026-10-09)

Audit du code et des contrats automatisés, comparés au cahier intégral ; aucune recette Android. Gravités : **critique** = bloque une mise en production sûre, **majeur** = permissions ou exigence fonctionnelle non respectée, **modéré** = fonctionnalité partielle/ergonomie, **mineur** = maintenance/poids. Les limites du mock restent des limites de démonstration, jamais des garanties serveur.

### Défauts corrigés

| Gravité | Écart observé | Correction / preuve |
| --- | --- | --- |
| Majeur | Aide et abonnement mentionnaient le lien de paiement WhatsApp (§9.5) | Texte orientant vers le paiement externe retiré ; tests des deux écrans, aucun bouton/lien de paiement |
| Majeur | Saisie seule recevait les mouvements globaux dans la carte de caisse et `dayView` (§5.4) | `ManagerHome` expose seulement `closing`, `dayView.cash = null` à ce niveau ; historique personnel conservé, tests de contrat |
| Majeur | Helpers de lecture/édition ne vérifiaient pas le business du bilan | `canViewReport` / `canEditReport` comparent les IDs ; test d'un bilan étranger malgré un rôle courant autorisé |
| Majeur | Liens directs vers formulaires interdits ou sans business (§4.3) | Gardes `Stack.Protected` par capacité ; tests Lecture seule et compte sans business, service vérifiant toujours les écritures |
| Majeur | Montants décimaux, caisse initiale infinie et lignes non entières acceptés par la validation métier | Entiers sûrs sur totals/lignes/caisse, contrôle de débordement du total détaillé ; tests paramétrés |
| Majeur | Articles étrangers/inconnus, doublons de ventes et ventes avec stock désactivé acceptés | Contrôle par ID du business, unicité et restant ; aucune écriture si invalide, tests domaine/services |
| Modéré | Bouton/badge « Modifier » restaient affichés après 24 h tant que l'écran ne se rerendait pas (§5.5) | Horloge à échéance et retour de veille ; tests du détail et de l'historique sans geste à l'expiration |
| Modéré | Dashboard/abonnement restaient datés de la veille sans écriture ni rechargement | `useQuery` se recharge au prochain minuit Cotonou et au retour actif ; test de passage Aujourd’hui → Hier avec attente du bilan |
| Modéré | Mises à jour de session hors `act` dans les tests | Gestes attendus dans `act(async …)` ; aucune interception/suppression de `console.error`, 122 tests sans avertissement React |
| Mineur | Écrans auth importaient les constantes du mock | Informations de démo via `AuthService.demo`, délai OTP transmis depuis le résultat du service ; aucun import mock dans l'UI |
| Mineur | Import groupé de toutes les familles d'icônes | Imports ciblés Ionicons ; export passe de 46 à 28 assets et bundle Hermes d'environ 3,5 à 3,2 Mo ; MaterialSymbols reste une dépendance interne Expo Router |

### Contrôles fonctionnels conservés

| Point | Résultat et preuve |
| --- | --- |
| Permissions par business | `accessOf` exige un membre actif dans le business ; capacités/hiérarchie centralisées ; lecture étrangère interdite, rôle étranger non attribuable |
| Invitations | En attente sans accès ; seul le numéro destinataire répond ; refus/rejeu sans accès ; acceptation/réinvitation sans doublon de membre ni perte des bilans, tests mock et scénario UI |
| Multi-contributeurs | Somme des versions courantes de tous les auteurs du jour ; horodatage/nom conservés ; tests domaine, service et recette documentée |
| Caisse | Départ une seule fois ; veille + CA + ajouts − dépenses ; recalcul en cascade des jours suivants, aucun stockage du solde ni alerte d'écart ; tests domaine/services |
| Modification 24 h | Auteur seulement, limite basée sur envoi initial, aucune prolongation par édition ; version originale et courante horodatées ; tests limite et refus serveur simulé |
| Rôles personnalisés | Noms libres, niveaux fixes, création propriétaire et attribution aux rangs inférieurs ; modification du rôle d'un membre protégée ; édition des définitions de rôles encore absente |
| Abonnement | Statut/jours/paiements affichés ; historique réservé au propriétaire ; prolongation de 30 jours testée en domaine, jamais initiée par l'app |
| Paiement dans l'app | Aucun parcours, URL externe ou mention de lien de paiement dans les écrans ; aide et abonnement testés |

### Écarts restants et limites

| Gravité | Écart | Suite |
| --- | --- | --- |
| Critique pour production, hors mission | Backend/RLS, OTP WhatsApp réel, anti-abus device/IP/CAPTCHA, session serveur, Fedapay/webhooks et anti-fraude essai absents (§3.2, §9, §10) | Lot serveur ; mock sans sécurité, PIN local non haché, données métier volatiles |
| Majeur pour lancement, hors mission | Push nouveau/modifié/rappel et expiration absents (§5.5, §5.7, §8) | FCM + orchestration serveur ; heure seulement configurée dans la démo |
| Majeur | PDF « Télécharger le bilan » absent (§6.2) | Lot PDF texte pur au clic, sans stockage serveur ; manque connu non réécrit dans cette mission |
| Majeur | Rôles suggérés non renommables/supprimables ; suppression du business absente (§4.1, §4.3) | Compléter les contrats et écrans après la recette ; respecter confirmation et conservation des données |
| Majeur avant diffusion | Politique de confidentialité et préparation Play Store non réalisées (§9.6) | Livraison de publication séparée ; aucune soumission effectuée |
| Modéré | Stock limité à ajout/vente/correction, sans réapprovisionnement/édition | Lot réglages ; interprétation de « gérer le stock » à préciser avant extension |
| Modéré | Rendu clavier Android 15+, TalkBack, grossissement, retour système et performance non mesurés | Exécuter ANDROID_ACCEPTANCE ; les tests de contraste ne remplacent pas une recette |
| Modéré | Assets préparés, aucun rendu des masques/splash sur release validé | Vérifier selon BRANDING_ASSETS ; ne pas déclarer l'identité finale validée |
| Mineur pour démo | Historique chargé intégralement | Pagination au lot suivant |

**Questions ouvertes inchangées** : numéro invité → Invitations ou dashboard ; un bilan par auteur/jour ; nom demandé à l'inscription. Aucune alternative n'a été choisie dans cette mission. Expiration de l'abonnement et durée exacte d'essai restent non spécifiées : aucune restriction nouvelle ; l'essai de création à 7 jours demeure une valeur fictive de démonstration.

## 11. Retours client — mission 05 et checkpoint Claude

Branche `feat/client-ui-feedback`, base `a2e7d56`. Référence visuelle : page 3 du PDF client `bilango-ameliorations-design.pdf`. Les deux accueils utilisent des tokens dédiés `homeColors` : blanc, quasi noir, séparateurs fins, accents sobres. Les autres écrans conservent leur composition ; le composant Logo commun affiche désormais le PNG officiel. Le logo loupe fourni dans la mission remplace l'identité œil de la fondation, sans changer la palette métier générale.

- Propriétaire / profils autorisés au dashboard : CA noir avec unité secondaire, tendance issue des versions courantes, variation atténuée, caisse/dépenses compactes, détail en lignes et bouton sombre. Le repli vers le dernier bilan daté est conservé pour Aujourd'hui.
- Saisie seule : salutation, nom de rôle personnalisé, carte sombre de saisie/modification/consultation selon l'état et les 24 h, solde seul, trois bilans personnels précédents. Navigation Accueil/Historique. Les droits Gestion complète et Lecture seule restent ceux du domaine ; aucun rôle « Boss » n'est créé.
- `DashboardPeriod` = 1 / 7 / 30 ou `{from,to}` ; le service valide des dates civiles ISO, l'ordre et l'absence de futur dans le fuseau Porto-Novo. Bornes inclusives, une seule journée possible, aucune durée maximale. `PeriodPicker` est un calendrier React Native français avec saisie directe JJ/MM/AAAA pour sauter à une année ancienne, sans dépendance supplémentaire.
- `totalsInRange` parcourt les bilans plutôt que tous les jours. La caisse est le solde dérivé à la fin sélectionnée, incluant les mouvements antérieurs au début ; jamais une somme de soldes. `theoreticalCash` conserve les règles existantes avec un calcul direct équivalent.
- Tendance : seuls les jours ayant un bilan sont des points, positions selon leurs dates réelles. Aujourd'hui montre le contexte des sept jours jusqu'au jour affiché. Les autres périodes utilisent leur intervalle exact ; comparaison avec l'intervalle précédent de même durée, sur données renseignées. Absence de bilans comparables / référence zéro : pastille neutre, aucun pourcentage inventé.
- Sélection conservée par business entre onglets, détails et changement de business pendant la session. Pas de persistance après déconnexion/redémarrage promise.

Écarts volontaires avec la référence : textes #9AA09C remplacés par des tons lisibles AA ; rouge renforcé ; menu hamburger conservé ; valeurs, noms et dates issus du mock existant ; calendrier ajouté hors aperçu PDF. Aucun test natif de polices, clavier, retour système, icônes ou splash. Validation et prochain travail : [CLAUDE_HANDOFF.md](CLAUDE_HANDOFF.md). Galerie locale : [VISUAL_PREVIEW.md](VISUAL_PREVIEW.md).
