# Reprise GoBilan — intégration Codex, 19 octobre 2026

## Reprise après recette Windows

La branche `test/gobilan-local-acceptance` part du merge `b228617d95fc26fdf39c640fff7df54eacd61164`. La livraison de recette et les accès locaux sont décrits dans `LOCAL_SETUP.md`, `LOCAL_ACCEPTANCE_REPORT.md` et `CLAUDE_UI_HANDOFF.md`. Les commandes `npm run preview:local`, `npm run dev:local` et `npm run seed:local` utilisent les secrets locaux ignorés par Git. Consulter `TEST_REPORT.md` pour distinguer les nouvelles exécutions Windows de l'historique Linux ci-dessous. Pas de merge ni de déploiement.

## Branche et point de départ

- Dépôt : https://github.com/Monoru1/bilango
- Base Claude : feat/gobilan-pwa-foundation, d68acd112f28e4edf8c59a5598f464b4967acd8a.
- Branche dédiée : feat/gobilan-codex-integration ; obtenir le SHA final avec git rev-parse HEAD.
- Premier lot : b2b830a (PWA/API, workspace, sécurité, administration, PostgreSQL/E2E).
- Lot suivant : 87ba8f8 (cycle de vie des rôles, obligations partenaires et tests de concurrence). Voir git log --oneline pour les SHA exacts.
- Aucun merge, force push ou déploiement ; aucun vrai paiement ni message externe.

## Fonctionnel et persistant

La PWA utilise RemoteStore par défaut : profil, business, rôles, invitations, stock, bilans, versions et abonnements proviennent du serveur. Les mutations attendent la réponse avant navigation. Les écrans existants et le design sont conservés. DemoStore est explicite via ?demo=1 ; ?demo=0 restaure le mode HTTP ; aucune bascule automatique si l'API échoue.

Un workspace serveur filtre les données selon le rôle. La caisse et le stock ne sont plus calculés sur les 60 derniers bilans seulement. Le propriétaire bloqué conserve l'accès à son abonnement ; l'employé reçoit un message neutre. Les données chargées sont purgées après expiration de session ou erreur de chargement.

Le propriétaire peut renommer/modifier les permissions d'un rôle et archiver un rôle inutilisé. Les rôles encore attribués ou proposés ne sont pas archivables. Retrait d'un membre toujours logique ; bilans et auteurs préservés.

Administration : liste des abonnements paginée, exclusion des parrainages, correction chiffrée des coordonnées, allowlist avec confirmation e-mail, minimum deux admins au retrait, audit avant/après. Un changement de rôle partenaire sans obligations coupe les sessions et force le nouvel accord. Un compte portant une équipe, des attributions de code, des parrainages ou des commissions doit être conservé ; créer un compte distinct pour le nouveau rôle.

## Corrections de sécurité principales

- Proxy non fiable par défaut : pas d'IP client choisie par X-Forwarded-For.
- Quotas OTP et essais gratuits sérialisés sur les clés partagées.
- Second facteur admin lié au challenge précis.
- Webhook lié à l'identité exacte de la transaction persistée.
- Comptes et données isolés ; permissions revérifiées serveur ; propriétaire bloqué sans fuite via les endpoints de bilans.
- Coordonnées et audit atomiques, champs personnels chiffrés.
- Rôles et rattachements concurrents verrouillés ; écritures de stock refusées après blocage.
- jsPDF 4.2.1 ; audit production à zéro vulnérabilité au contrôle local.

## Validation

Consulter TEST_REPORT.md : check complet, 137 tests API sur PostgreSQL réseau, 139 autres tests, deux suites Chromium. Les fournisseurs Dev ne sont pas des intégrations externes validées. La CI dispose de jobs check, postgres et browser.

## Lancer et tester

README.md contient les commandes PowerShell, les variables et les quatre ports. Pour une base persistante, garder DATABASE_URL et les mêmes secrets hors git. Sans DATABASE_URL, PGlite est éphémère.

- npm ci && npm run check
- TEST_DATABASE_URL=… npm run test:postgres -w @gobilan/api
- npx playwright install chromium
- E2E_DATABASE_URL=… npm run test:e2e

Les tests SQL/E2E créent des schémas de test aléatoires et ne suppriment que ceux-ci. L'API de développement applique les nouvelles migrations à la base indiquée. Ne pas pointer ces commandes sur une production.

## Carte du code

- packages/contracts/src/workspace.ts : état métier et réponse du workspace.
- apps/pwa/src/app/RemoteStore.ts : mutations HTTP, réhydratation, erreurs et idempotence d'envoi.
- apps/pwa/src/app/StoreView.ts : sélecteurs partagés, sans données seedées.
- apps/api/src/services/workspace.ts : données autorisées pour chaque business.
- apps/api/src/services/{auth,business,reports,subscriptions,partners,admin}.ts : permissions, transactions, financière et administration.
- apps/api/migrations/002_admin_allowlist.sql et 003_role_lifecycle.sql : confirmations et archivage/accords.
- apps/api/test/{workspace,concurrency,admin-allowlist,roles}.test.ts : régressions nouvelles.
- e2e/run-smoke.mjs : lancement isolé des quatre applications et des suites navigateur.

## Bloqué / non livré

**NO-GO production**, maintenu volontairement dans server.ts. Fournisseurs WhatsApp, CAPTCHA, SMTP, FedaPay et push réels non branchés. Rappels et rapprochement périodique non planifiés. Checkout réel indisponible en mode HTTP. Captures/vidéo iOS, installation sur appareils physiques, tests de charge, restauration, infrastructure, domaines, secrets gérés et revue juridique absents.

Performance à traiter avant forte volumétrie : le workspace charge tout l'historique autorisé de tous les business. Préférer des agrégats serveur et un historique paginé, sans réintroduire de troncature dans la caisse/stock. Réapprovisionnement stock non livré. Voir REQUIREMENTS_MATRIX.md et DEPLOYMENT_READINESS.md pour les limites détaillées.

Les hypothèses métier documentées par Claude, notamment D-004/D-014/D-018, ne sont pas des validations client. Les conserver visibles jusqu'à arbitrage.
