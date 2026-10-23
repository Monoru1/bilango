# Reprise — branche feat/gobilan-claude-v1

Départ : `b228617d95fc26fdf39c640fff7df54eacd61164` (main). Source fonctionnelle : CDC GoBilan (PWA) du 19 octobre 2026.

## Fait (Lot 3, volet notifications)
- Migration additive `apps/api/migrations/004_push_delivery.sql` (colonnes de livraison, `notification_log` à clé de déduplication unique).
- API : `PushService` (enregistrement / retrait, prise en main d'un abonnement seulement si les clés sont identiques, plafond de 10), `DbPushSender` (révocation 404/410, 5 échecs, ne lève jamais), `ScheduledJobs` + `startScheduler` (rappels, expirations, rapprochement horaire). Routes `GET /v1/push/config`, `POST /v1/push/subscriptions`, `POST /v1/push/unsubscribe`.
- Notifications envoyées APRÈS commit (bilan envoyé/modifié, paiement confirmé), alerte nouvel appareil vers l'ancien appareil.
- PWA : `lib/push.ts`, `RemoteStore.enablePush/resyncPush/disablePush`, invite Android après création du PIN, bouton du profil, mention DÉMO limitée au mode démo.

## Validé (exécuté)
`npm run check` : exit 0 (API 151 + 8 ignorés, PWA 45, contrats 7, domaine 94). Suite API sur PostgreSQL 16 : 159/159, aucun schéma résiduel. Détails : docs/TEST_REPORT.md.

## Reste à faire
Voir docs/REMAINING_BLOCKERS.md et la liste « Travail local restant » de docs/DEPLOYMENT_READINESS.md. Non vérifiés à ce jour : E2E Playwright après ces changements, cartes sources en production (§13.1), révocation de sessions au changement de mot de passe partenaire (§13.3), alertes e-mail admin (§13.4), pagination du workspace, réapprovisionnement du stock, audit d'accessibilité.

## Pièges
- Ne pas lire `${PIPESTATUS[0]}` après un sous-shell : rediriger vers un fichier puis `echo $?`.
- Les tests PostgreSQL exigent `TEST_DATABASE_URL` ; chaque test crée puis supprime son schéma.
