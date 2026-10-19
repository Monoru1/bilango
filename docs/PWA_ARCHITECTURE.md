# Architecture
Monorepo npm workspaces. `domain` (pur, sans I/O) ← `contracts` (Zod) ← `api` (Fastify 5, `pg` en prod, PGlite en test/dev) ; `ui` partagé par `pwa`, `partners`, `admin` (React 19, Vite 7, react-router 7).

## Flux
Navigateur → `/v1/*` (cookies par audience : user / partner / admin, en-tête CSRF + contrôle Origin) → services → PostgreSQL (migrations `apps/api/migrations`).
FedaPay → webhook signé HMAC → idempotence → re-vérification auprès de la passerelle → transaction (paiement, prolongation, commissions) → effets (outcome-after-commit).

## Décision clé
Partenaires et admin sur **hôtes distincts** en production (cookies/isolation, CDC §13.4). Le proxy Vite dev redirige `/v1` vers 127.0.0.1:8787.

## PWA et environnement local
La PWA utilise `apps/pwa/src/app/RemoteStore.ts` par défaut : sessions, business, équipe, stock et bilans proviennent de l'API et de PostgreSQL. `?demo=1` active explicitement le store en mémoire ; `?demo=0` revient au mode HTTP. Aucune erreur réseau ne bascule en démo.

Les fournisseurs externes restent des doublures Dev, même en mode HTTP. Le signal standalone est émulé dans les E2E ; une installation physique Android/iOS demande une validation séparée. Voir `LOCAL_SETUP.md` et `LOCAL_ACCEPTANCE_REPORT.md` pour la recette Windows.
