# BilanGo

Application Android native (Expo, React Native, TypeScript, Expo Router) de **suivi à distance pour propriétaires de business** : l'équipe sur place envoie un bilan simple en fin de journée, le propriétaire consulte chiffre d'affaires, dépenses et caisse théorique depuis son téléphone. Éditeur : Novadis Digital.

Référence fonctionnelle : [docs/CAHIER_DES_CHARGES.md](docs/CAHIER_DES_CHARGES.md).

> **État : fondation démontrable avec données fictives.** Tout fonctionne sur un backend simulé en mémoire. Rien n'est envoyé nulle part (ni WhatsApp, ni push, ni paiement) et le mock **n'offre aucune sécurité** : les permissions sont appliquées pour reproduire le contrat, pas pour protéger des données. Voir [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) pour ce qui reste.

## Démarrer

Prérequis : Node 20+, un téléphone Android avec **Expo Go**, ou un émulateur Android (SDK + AVD).

```bash
npm install
npm start          # puis scanner le QR code avec Expo Go, ou appuyer sur « a » pour l'émulateur
```

Android uniquement : pas de WebView, pas de site emballé, pas de cible web ni iOS.

### Comptes de démonstration

Écran de saisie du numéro → touchez un compte pour pré-remplir. **Code OTP : `123456`**, PIN au choix à la première connexion.

| Numéro | Profil |
| --- | --- |
| 01 97 00 00 01 | Koffi : propriétaire de *Chez Maman Bar* (stock activé) et *Boutique Étoile*, et livreur chez *E-Shop Cotonou* |
| 01 97 00 00 02 | Rodrigue : caissier (Saisie seule) chez Chez Maman Bar, avec une invitation en attente |
| 01 97 00 00 03 | Fatou : gérante (Gestion complète) |
| 01 97 00 00 04 | Yacine : comptable (Lecture seule) |
| 01 97 00 00 06 | Nouveau numéro déjà invité (arrive sur l'invitation) |
| 01 97 00 00 99 | Nouveau numéro sans business (arrive sur « Créer mon business ») |

Les données sont régénérées à chaque lancement, relatives à la date du jour. Seuls la session et le PIN sont conservés sur l'appareil (SecureStore).

## Commandes

| Commande | Rôle |
| --- | --- |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (config Expo) |
| `npm test` | Jest : règles métier, services mock, session, brouillon de bilan, parcours de navigation sur le vrai arbre de routes |
| `npm run check` | les trois ci-dessus |
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
docs/         cahier des charges, architecture, plan d'implémentation
```

Détails dans [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Consignes pour les agents/contributeurs dans [AGENTS.md](AGENTS.md).
