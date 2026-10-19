# Rapport de tests (réellement exécutés)
Commande : `npm run check` → **EXIT=0** (typecheck, lint, tests, build).
| Suite | Résultat |
|---|---|
| domain | 94 passés / 6 fichiers |
| contracts | 7 passés |
| api | 110 passés / 6 fichiers |
| pwa | 32 passés / 4 fichiers |
| admin / partners | aucun test unitaire |
| e2e/portals-smoke.mjs (Playwright) | exécuté contre l'API dev lors de la session ; non rejoué dans la CI |
Non testé : Postgres réel (concurrence), FedaPay réel, WhatsApp, e-mail, push, iOS/Android réels, accessibilité, charge.
