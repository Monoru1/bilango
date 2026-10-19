# GoBilan — monorepo PWA

Trois applications web + un backend partagé (cahier des charges du 19 octobre 2026).

| Package | Rôle |
|---|---|
| `apps/pwa` | GoBilan PWA (propriétaires / employés). **Écrans branchés sur un `DemoApi` en mémoire (DÉMO), pas encore sur l'API réelle.** |
| `apps/partners` | Portail partenaires (API réelle) |
| `apps/admin` | Plateforme admin (API réelle) |
| `apps/api` | Fastify + PostgreSQL (PGlite en dev/test) |
| `packages/domain` | Règles métier pures |
| `packages/contracts` | Schémas Zod |
| `packages/ui` | Tokens, composants, textes légaux |
| `legacy/expo-app` | Ancien prototype Expo (référence, non maintenu) |

## Commandes
```
npm ci
npm run check        # typecheck + lint + tests + build
npm run dev:api | dev:pwa | dev:partners | dev:admin
```
PWA en démo sans installation : `?demo=1`. Documentation : `docs/`.
Aucun paiement, WhatsApp, e-mail ou push réel n'est actif : voir `docs/REQUIREMENTS_MATRIX.md`.
