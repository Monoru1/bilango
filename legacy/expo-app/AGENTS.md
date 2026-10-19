# BilanGo — consignes pour agents et contributeurs

Application Android native pour Novadis Digital : Expo (SDK 57), React Native, TypeScript strict, Expo Router. **Android-first. Pas de WebView, pas de site web emballé.** Le back-office web est un projet séparé.

## Source de vérité

`docs/CAHIER_DES_CHARGES.md` est la référence fonctionnelle. Le lire avant toute modification de comportement. En cas d'ambiguïté, appliquer la règle du cahier, noter l'interprétation dans `docs/ARCHITECTURE.md` (section « Décisions et interprétations ») et ne pas la présenter comme validée.

## Expo change souvent — ne pas se fier à la mémoire

Avant d'écrire du code touchant Expo, EAS ou React Native : lire la version majeure de `expo` dans `package.json`, puis la doc versionnée `https://docs.expo.dev/versions/v<major>.0.0/` et `https://docs.expo.dev/llms.txt`.

## Commandes

```bash
npx expo install <paquet>   # TOUJOURS à la place de npm install : versions compatibles SDK
npm run check               # typecheck + lint + tests — obligatoire avant de déclarer une tâche terminée
npm run bundle:android      # vérifie que le bundle Android compile
```

## Architecture (voir docs/ARCHITECTURE.md)

- `src/domain` : logique métier **pure** (aucun import React/Expo). Toute règle du cahier vit ici et a un test.
- `src/services` : l'UI ne dépend que des interfaces de `services/types.ts`. L'implémentation actuelle est `services/mock`. Ne jamais importer le mock depuis un écran : passer par `useServices()`.
- `src/state` : session/PIN (`session-controller.ts`, testable sans React), business courant, `useQuery`.
- `src/features` / `src/ui` : composants. Écrans fins dans `src/app` ; rien de non-route dans `src/app`.

## Règles non négociables

- **Aucun parcours de paiement dans l'app** : pas de bouton, lien ni mention redirigeant vers un paiement externe (Google Play, cahier §9.5). L'abonnement est affiché en lecture seule.
- Les **mocks ne sont pas de la sécurité** : ne jamais les décrire comme une intégration de production (OTP WhatsApp, push FCM, Fedapay, anti-abus, RLS Supabase restent à faire côté serveur).
- Permissions : toujours via `domain/permissions.ts` (`can`, `canManageMember`, `canGrantLevel`, `canEditReport`). Ne pas dupliquer la logique dans les écrans.
- Soft delete des membres : ne jamais supprimer en cascade les bilans d'un compte retiré.
- La caisse théorique est **dérivée** des bilans courants (jamais stockée) ; aucune alerte d'écart.
- Interface en français, design system dans `src/ui/theme.ts` (palette officielle #0F6E56 / #085041 / #5DCAA5, pas de jaune/orange). Cibles tactiles ≥ 48 px, un seul chiffre fort par écran.
- Montants : entiers FCFA. Jours métier : fuseau de Cotonou (UTC+1), voir `domain/dates.ts`.
- Application légère : pas de dépendance lourde ni de multimédia superflu.

## Divers

- Ne pas créer ni éditer `android/` ou `ios/` à la main (Continuous Native Generation) : tout passe par `app.json` et les config plugins.
- Ne pas pousser ni fusionner sans autorisation explicite du propriétaire du dépôt.
- Build/soumission : EAS (`npx eas-cli@latest build`), format `.aab` obligatoire pour le Play Store.
