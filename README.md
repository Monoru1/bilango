# BilanGo

Application Android native (Expo, React Native, TypeScript, Expo Router) de **suivi à distance pour propriétaires de business** : l'équipe sur place envoie un bilan simple en fin de journée, le propriétaire consulte chiffre d'affaires, dépenses et caisse théorique depuis son téléphone. Éditeur : Novadis Digital.

Référence fonctionnelle : [docs/CAHIER_DES_CHARGES.md](docs/CAHIER_DES_CHARGES.md).

> **État : démonstration client sur données fictives.** Tout fonctionne sur un backend simulé en mémoire. Rien n'est envoyé nulle part (ni WhatsApp, ni push, ni paiement) et le mock **n'offre aucune sécurité** : il reproduit les règles de permission pour que l'interface soit écrite contre le bon contrat, il ne protège aucune donnée. Voir [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) pour la suite.
>
> **Non testé sur appareil Android** : la validation automatisée (tests, TypeScript, lint, export du bundle) est faite ; aucun essai sur téléphone ou émulateur n'a encore été réalisé. Suivre la procédure ci-dessous pour le faire.

Produit Android natif : pas de WebView, pas de site emballé ni de version web commerciale. Une cible Web isolée sert uniquement à la recette visuelle locale.

## Tester sur un téléphone Android

1. Installer **Expo Go** depuis le Play Store sur le téléphone.
2. Sur l'ordinateur (Node 22.13+), à la racine du dépôt :
   ```bash
   npm ci
   npm start
   ```
3. Téléphone et ordinateur sur le **même réseau Wi-Fi** ; scanner le QR code affiché avec Expo Go. Si le réseau bloque la connexion (Wi-Fi d'entreprise, pare-feu Windows), autoriser Node dans le pare-feu ou lancer `npx expo start --tunnel`.
4. Alternative : émulateur Android (Android Studio + AVD), puis touche `a` dans le terminal.

Les données sont régénérées à chaque lancement, relatives à la date du jour. Seuls la session et le PIN sont conservés sur l'appareil (SecureStore). Pour repartir de zéro : « Se déconnecter » puis « PIN oublié ou autre numéro », ou vider les données d'Expo Go.

### Comptes de démonstration

Écran de saisie du numéro → touchez un compte pour pré-remplir. **Code OTP : `123456`**, PIN de 4 chiffres au choix à la première connexion.

| Numéro | Profil |
| --- | --- |
| 01 97 00 00 01 | **Koffi** : propriétaire de *Boutique Étoile* et de *Chez Maman Bar* (stock activé), et livreur chez *E-Shop Cotonou* (multi-business) |
| 01 97 00 00 02 | **Rodrigue** : caissier (Saisie seule) chez Chez Maman Bar, avec une invitation en attente de *Boutique Étoile* |
| 01 97 00 00 03 | **Fatou** : gérante (Gestion complète) |
| 01 97 00 00 04 | **Yacine** : comptable (Lecture seule) |
| 01 97 00 00 06 | Nouveau numéro **déjà invité** (demande son nom, puis arrive sur l'invitation) |
| 01 97 00 00 99 | Nouveau numéro **sans business** (arrive sur « Créer mon business ») |

### Scénario de démonstration conseillé (10 minutes)

1. **Koffi** : connexion OTP + création du PIN → dashboard de *Boutique Étoile* (bilan du jour déjà reçu, modifiable 24 h). Menu latéral : trois business, CA du jour de chacun, jours d'abonnement.
2. Passer à *Chez Maman Bar* : pas de bilan aujourd'hui → dernier bilan daté + badge « En attente du bilan ». Toucher le CA : détail par contributeur, décomposition de la caisse théorique. Onglet Bilans : un bilan marqué « Modifié » avec ses deux versions.
3. Onglet Équipe : membres, rôles, invitation en attente, ancien membre retiré (ses bilans sont conservés). Inviter un numéro ; créer un rôle.
4. **Rodrigue** (changer de numéro via « Se déconnecter » → « PIN oublié ou autre numéro ») : accueil manager, caisse théorique en évidence, « Faire le bilan du jour » avec détail optionnel et stock ; envoyer, puis « Modifier » (heure limite affichée). Menu → Invitations → accepter.
5. **Yacine** (lecture seule) et **Fatou** (gestion complète) : mêmes données, droits différents.
6. **Numéro 99** : « Créer mon business » → état vide rassurant → premier bilan avec déclaration de la caisse de départ.

Le scénario automatisé dans `src/__tests__/consolidation.test.tsx` conserve une seule base fictive : nouveau propriétaire → business → invitation → acceptation par le manager → bilan de 40 000 FCFA avec caisse initiale 15 000 et dépenses 5 000 → consultation propriétaire, caisse **50 000 FCFA**.

Procédure détaillée et journal de résultats : [ANDROID_ACCEPTANCE.md](docs/ANDROID_ACCEPTANCE.md). Audit fonctionnel et gravités : [ARCHITECTURE.md §10](docs/ARCHITECTURE.md#10-audit-fonctionnel--mission-04-2026-10-09).

## Écrans fonctionnels

| Zone | Écrans |
| --- | --- |
| Connexion | Accueil, saisie du numéro (démo : comptes pré-remplis), code OTP (renvoi après 30 s), nom (première connexion), création du PIN, verrouillage par PIN (5 essais) |
| Propriétaire / gestion / lecture | Tableau de bord (Aujourd'hui / 7 j / 30 j, comparaison avec la veille, caisse théorique, état vide), détail du jour, historique groupé par jour, détail d'un bilan avec versions |
| Manager (Saisie seule) | Accueil (caisse, bilan du jour, modification 24 h), formulaire de bilan (CA, dépenses, ajout à la caisse, détail optionnel, stock, note, caisse de départ au premier bilan), mes bilans |
| Multi-business | Menu latéral, ajout d'un business (secteur, stock, rappel), compte sans business |
| Équipe | Membres, rôles personnalisés, invitations (envoyées / reçues), changement de rôle, retrait (soft delete), heure de rappel |
| Autres | Stock facultatif (liste, ajout d'article), abonnement en lecture seule (propriétaire), aide par rôle |

## Simulations (ce qui n'est PAS réel)

| Fonction | Simulation actuelle |
| --- | --- |
| OTP WhatsApp | Code fixe `123456` ; le rate limiting (30 s, 5/24 h) est simulé en mémoire |
| Données et permissions | Mock en mémoire, régénéré à chaque lancement ; aucune sécurité |
| PIN et session | Stockés dans le SecureStore de l'appareil ; le PIN n'est pas haché dans cette version |
| Notifications push | Aucune ; l'heure de rappel est seulement enregistrée et affichée |
| Abonnement | État fictif en lecture seule ; aucun paiement, aucun lien de paiement |
| PDF « Télécharger le bilan » | Non implémenté |

## Limites connues

- Aucun essai sur appareil Android réel ni émulateur à ce jour.
- Icône, adaptive, monochrome et splash : assets BilanGo préparés ; rendu à vérifier sur un binaire release. Voir [BRANDING_ASSETS.md](docs/BRANDING_ASSETS.md).
- L'historique charge tous les bilans (pas de pagination) ; adapté à la démonstration.
- Les trois interprétations du cahier à valider (numéro invité, bilan unique par auteur et par jour, nom demandé à l'inscription) sont listées dans [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) §7 et [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md).
- Contrastes contrôlés automatiquement, libellés TalkBack, police plafonnée à 1,8, confirmation avant abandon du bilan et adaptation clavier préparés ; recette native encore nécessaire.
- Les nouveaux comptes de démo et leurs business disparaissent au rechargement de la base en mémoire ; seul le stockage local de session/PIN persiste.

## Commandes

Prévisualisation visuelle sur PC, sans appareil Android : [procédure et limites Web/Android](docs/VISUAL_PREVIEW.md). `npm run preview:visual` génère la galerie locale `artifacts/visual-preview/index.html` à partir des composants existants, avec Chrome et Playwright.

| Commande | Rôle |
| --- | --- |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (config Expo) |
| `npm test` | Jest : règles métier, services mock, session, brouillon de bilan, parcours de navigation sur le vrai arbre de routes |
| `npm run check` | les trois ci-dessus |
| `npx expo-doctor` | Compatibilité et configuration Expo |
| `npm run bundle:android` | `expo export` : vérifie que tout le bundle Android compile |

## Structure

```
src/
  app/        routes Expo Router (auth, unlock, onboarding, (app)/(tabs)…)
  domain/     modèle et règles métier pures (permissions, caisse, bilans, abonnement)
  services/   contrat typé des services + implémentation mock (remplaçable)
  state/      session/PIN, business courant, injection des services, hook useQuery
  features/   composants métier (dashboard, formulaire de bilan, menu latéral…)
  ui/         design system (tokens, composants, logo, pavé PIN)
  test-utils/ helpers des tests de navigation
docs/         cahier des charges, architecture, plan d'implémentation
```

Détails dans [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Consignes pour les agents et contributeurs dans [AGENTS.md](AGENTS.md).
