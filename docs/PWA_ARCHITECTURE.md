# Architecture
Monorepo npm workspaces. `domain` (pur, sans I/O) ← `contracts` (Zod) ← `api` (Fastify 5, `pg` en prod, PGlite en test/dev) ; `ui` partagé par `pwa`, `partners`, `admin` (React 19, Vite 7, react-router 7).

## Flux
Navigateur → `/v1/*` (cookies par audience : user / partner / admin, en-tête CSRF + contrôle Origin) → services → PostgreSQL (migrations `apps/api/migrations`).
FedaPay → webhook signé HMAC → idempotence → re-vérification auprès de la passerelle → transaction (paiement, prolongation, commissions) → effets (outcome-after-commit).

## Décision clé
Partenaires et admin sur **hôtes distincts** en production (cookies/isolation, CDC §13.4). Le proxy Vite dev redirige `/v1` vers 127.0.0.1:8787.

## Écart important
La PWA utilise `apps/pwa/src/demo/store.ts` (DemoApi en mémoire, réutilise `@gobilan/domain`). Le client HTTP vers l'API réelle reste à brancher (priorité 1 de Codex).
