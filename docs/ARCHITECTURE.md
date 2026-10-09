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
- **Stock** : quantité de départ par article ; restant = départ − ventes déclarées dans les versions courantes des bilans.

## 3. Services (`src/services`)

`types.ts` définit `AuthService`, `BusinessService`, `ReportService`, `TeamService`, `StockService`, `SubscriptionService`, plus `DataEvents` (notification après écriture) et `ServiceError` (codes `FORBIDDEN`, `VALIDATION`, `EDIT_WINDOW_CLOSED`, `RATE_LIMITED`…) avec messages français.

`services/mock/` implémente le tout en mémoire, avec latence simulée (250 ms) pour exercer les états de chargement. Il applique les mêmes règles que le futur serveur (permissions, hiérarchie, fenêtre de 24 h, validation, stock, rate limiting OTP) pour que l'UI soit écrite contre le bon contrat. Les données de démo (`seed.ts`) sont déterministes et relatives à la date du jour.

> **Le mock n'est pas une sécurité.** Tout s'exécute sur l'appareil : il n'authentifie personne, ne protège aucune donnée et ne remplace ni la vérification des permissions à chaque requête côté serveur (cahier §10), ni l'anti-abus OTP (rate limiting, device/IP, CAPTCHA), ni la vérification de signature des webhooks.

### Brancher un vrai backend

1. Écrire une implémentation de `Services` (HTTP, Supabase…) qui lève des `ServiceError` aux mêmes codes.
2. La retourner dans `src/state/composition.ts` (`createAppServices`), seul point de choix.
3. Faire émettre `events.subscribe` après les écritures (ou remplacer `useQuery` par TanStack Query en gardant sa signature).
4. Rejouer `npm test` : `services/mock/__tests__` décrit le comportement attendu et peut servir de suite de contrat.

## 4. État (`src/state`)

- `session-controller.ts` : machine d'états `booting → signedOut | locked | onboarding | ready`, indépendante de React et testée. Persistance du jeton et du PIN dans `expo-secure-store`. Déconnexion volontaire = verrouillage (le PIN suffit) ; PIN oublié ou 5 erreurs = appareil oublié, nouvel OTP requis.
- `business.tsx` : liste des business du compte, business courant mémorisé, état du menu latéral.
- `services.tsx` : `ServicesProvider`, `useServices`, `useQuery(key, fetcher)` — états chargement/erreur, rechargement automatique après écriture, jamais de données d'une autre clé.

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

## 6. Design system (`src/ui`)

`theme.ts` : palette officielle (#0F6E56, #085041, #5DCAA5), espacements, typographie, cible tactile minimale 48 px. Composants : `Screen`, `Text`, `Button`, `Card`, `ListItem`, `Badge`, `Avatar`, `TextField`, `AmountField` (milliers, clavier numérique), `Segmented`, `ChoiceList`, `SwitchRow`, `BottomSheet`, `PinPad`, `Logo` (SVG), états `LoadingState` / `ErrorState` / `EmptyState` / `Banner` / `AsyncBoundary`. Un seul chiffre fort par écran (`BigAmount`).

## 7. Décisions et interprétations (à valider avec le client)

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
- `src/__tests__/navigation.test.tsx` : **vrai arbre de routes** rendu avec `expo-router/testing-library` (connexion OTP + PIN, gardes, menu, saisie d'un bilan, invitations, validation). Modules natifs doublés dans `jest.setup.ts`.

Ces tests ne remplacent pas un essai sur appareil ou émulateur (rendu, clavier, gestes) : aucun n'a été exécuté dans cet environnement faute de SDK Android.
