# Reprise GoBilan — intégration Codex, 19 octobre 2026

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

**NO-GO production** : les adaptateurs réels et leur câblage HTTP sont livrés dans le lot décrit ci-dessous, mais les comptes fournisseurs et leur recette externe ne sont pas validés. Ordonnanceur, restauration isolée et image API sont livrés ; hébergement API/PostgreSQL, secrets gérés, copie de sauvegarde hors hôte et autorisation de lancement restent requis. Appareils physiques et charge réelle non validés.

Performance à traiter avant forte volumétrie : le workspace charge tout l'historique autorisé de tous les business. Préférer des agrégats serveur et un historique paginé, sans réintroduire de troncature dans la caisse/stock. Réapprovisionnement stock non livré. Voir REQUIREMENTS_MATRIX.md et DEPLOYMENT_READINESS.md pour les limites détaillées.

Les hypothèses métier documentées par Claude, notamment D-004/D-014/D-018, ne sont pas des validations client. Les conserver visibles jusqu'à arbitrage.

## Livraison : branche existante PR #7 — intégrations configurées

`PROVIDER_MODE=configured` sélectionne les transports réels Meta OTP, SMTP,
Turnstile, Web Push chiffré et FedaPay REST dans le serveur. Il n'existe aucun
repli sur les doublures si une clé manque. Les variables sont dans
`.env.providers.example` (copier vers `.env.providers`, jamais committer ce
fichier). Pour la recette Docker :

```sh
docker compose -f compose.acceptance.yml -f compose.providers.yml up -d --build
```

Laisser `EXTERNAL_DELIVERY_ENABLED=false` et `EXTERNAL_PAYMENTS_ENABLED=false`.
En recette, une activation ultérieure exige les listes exactes
`TEST_EMAIL_RECIPIENTS`, `TEST_WHATSAPP_RECIPIENTS`, `TEST_PUSH_ENDPOINTS` ; jamais
les coordonnées des clients. WhatsApp utilise un template d'authentification
Meta approuvé (corps OTP et bouton URL OTP). La version Graph doit être celle
approuvée pour le compte, sans valeur supposée par le code. Aucun appel externe
réel n'est attesté par les tests HTTP avec doubles.

La PWA demande la configuration CAPTCHA publique puis affiche Turnstile et
transmet son jeton à l'API. Un échec ne remplace jamais ce jeton par un jeton de
développement. La CSP autorise uniquement le domaine Turnstile nécessaire.
Le bouton FedaPay apparaît uniquement si l'API déclare l'activation explicite ;
il recueille l’e-mail de paiement pour le client FedaPay (nom et téléphone issus de la session authentifiée), sans confirmer aucun abonnement au retour navigateur. La même demande conserve
sa clé en session et réutilise son identifiant fournisseur après panne du token.
Une création ambiguë sans identifiant reste bloquée pour contrôle fournisseur.

Netlify : définir `API_ORIGIN=https://<hôte-API-autorisé>` dans le contexte voulu.
Le build génère un proxy `/v1/*` avant la route SPA. Sans cette origine, les appels
API restent des erreurs JSON 404 explicites ; aucune donnée de démo n'est injectée.
Le déploiement courant de production n'a pas été modifié.

### Sauvegarde opérationnelle de recette

```sh
# Une sauvegarde quotidienne, rétention locale 7 jours ; volume distinct de PostgreSQL.
docker compose -f compose.acceptance.yml --profile backups up -d backups
# Sauvegarde ponctuelle
docker compose -f compose.acceptance.yml run --rm backups backup
# Contrôle de restauration dans une base TEMPORAIRE distincte, supprimée après contrôle
docker compose -f compose.acceptance.yml run --rm backups verify /backups/gobilan-<horodatage>.dump
```

Archives custom PostgreSQL, permissions privées, checksum SHA-256 et validation
du catalogue. Le script refuse toute base autre que `db/gobilan_acceptance`.
Ne pas utiliser `down -v` sur une recette à conserver : cela efface les volumes,
y compris les sauvegardes locales. Ce volume ne remplace pas une copie hors hôte ;
un stockage durable existant doit être choisi avant lancement, sans souscription
payante automatique. La CI exerce sauvegarde et restauration isolées.

### Préconditions de lancement (ne pas activer pendant la recette)

Le démarrage production exige `PRODUCTION_RELEASE_APPROVED=true`,
`PROVIDER_MODE=configured`, PostgreSQL TLS `sslmode=verify-full`,
`SECURE_COOKIES=true` et trois origines HTTPS explicites. Aucune migration ni
création d'administrateur de développement n'est exécutée automatiquement en
production. Appliquer les migrations par la commande dédiée avant démarrage ;
le serveur vérifie la présence des colonnes de reprise. Le mode Live exige en
plus `FEDAPAY_LIVE_APPROVED=true`. Ces portes ne constituent ni une autorisation
actuelle, ni une validation des comptes fournisseurs. Hébergement API/PostgreSQL,
secrets, recettes fournisseur et approbation de lancement restent nécessaires.

`Dockerfile.api` prépare l’image de lancement avec `NODE_ENV=production` ; la CI vérifie qu’elle refuse le démarrage sans approbation. `Dockerfile.acceptance` reste réservé à la recette. Aucune image n’a été déployée sur une infrastructure production.

## État au 12 novembre 2026 — recette Render opérationnelle (P0.1 et P0.2)

- Branche déployée : `fix/gobilan-livraison-15-novembre`, commit de fusion de la PR #11 `c7894fd`.
- Cause de l'échec du 9 novembre : `NODE_ENV=production` (défaut Render) alors que le mode
  `RENDER_RECETTE` exige l'inverse, puis `DATABASE_URL` absente. Corrigé par configuration, sans
  `PRODUCTION_RELEASE_APPROVED`.
- API : https://gobilan-recette-api.onrender.com — `/health` et `/ready` répondent 200.
- Base `gobilan-recette` : inspectée en lecture seule au démarrage (0 table), puis initialisée
  avec les migrations 001 à 007. Toute migration future sur cette base non vide exige une
  sauvegarde puis `RECETTE_MIGRATION_APPROVED_UP_TO` (voir `docs/recette/otp-demo-recette.md`).
- `DATABASE_URL` est injectée par le Blueprint Render `gobilan-recette` (fichier `render.yaml`
  de la branche `infra/render-recette-blueprint`, synchronisation automatique désactivée) :
  le mot de passe ne transite ni par Git ni par un poste.
- PWA de recette : https://deploy-preview-12--gobilan-pwa.netlify.app (PR #12, brouillon, à ne
  pas fusionner). `API_ORIGIN` est définie sur Netlify ; `PWA_ORIGIN` côté API vaut cette URL
  exacte. `gobilan-pwa.netlify.app` sert encore l'ancien build de `main`. `gobilan.com`
  appartient au client et ne doit pas être modifié.
- Portails partenaires et admin : non déployés ; leurs origines côté API sont des valeurs de
  réserve en `.invalid`.
- OTP de démonstration actif jusqu'au 16 novembre 2026 23:00 UTC pour 20 numéros fictifs
  (variables `RECETTE_DEMO_*` du service Render ; le code n'est écrit dans aucun fichier).
- Preuves : `docs/recette/preuves/2026-11-12-recette-render.md`.
- Échéance : livraison finale V1 le 15 novembre 2026. Reprise détaillée et tâches ordonnées :
  `docs/CODEX_REPRISE_LIVRAISON_FINALE_15_NOV_2026.md` (commencer par T1, IP derrière le proxy).
- Code de démonstration remplacé le 12 novembre ; valeur lisible uniquement dans Render.
- Prochaine tâche : parcours P0.4 dans la PWA installée (invitation et acceptation d'un employé,
  stock, modification d'un bilan, historique), puis jeu de données de démonstration P0.5.

## 12 novembre — correctif de quotas réseau

Branche `fix/gobilan-proxy-security` depuis `13d63a0`. Le correctif utilise une preuve
HMAC produite à partir de l’adresse de connexion Netlify et maintient un quota commun
pour le trafic direct sans preuve. Pas de migration supplémentaire. Tests locaux et
état de la validation hébergée dans `docs/recette/preuves/2026-11-12-proxy-client-ip.md`.
La configuration et la séquence d’activation sont dans `docs/SECURITY_MODEL.md`.

## 12 novembre — parcours PWA de recette

Branche `fix/gobilan-pwa-recette` depuis `13d63a0`. Le mode hébergé de `e2e/pwa-smoke.mjs`
cible exclusivement la preview #12. Il exige les comptes fictifs réservés et le code de
recette avant de lancer un navigateur, et vérifie les données via l’API. Le mode local
conserve le test du blocage après expiration sur PostgreSQL isolé. L’accueil, les
instructions d’installation Chrome et les mentions légales ont été vérifiés sur la
preview actuelle. Le parcours authentifié reste à exécuter selon
`docs/recette/preuves/2026-11-12-pwa-hebergee.md`.

## Intégration des cinq PR du 12 novembre

Branche `integration/gobilan-15-novembre`, partie du HEAD de livraison `13d63a0`.
Ordre appliqué : #14, #15, #16, #17, #13. #15 et #16 descendent de #14 ; seuls
leurs commits propres sont appliqués. Le conflit de passation a été résolu en
conservant les notes proxy et PWA. L'API, l'authentification, les tests et les
configurations Netlify ont été intégrés sans conflit textuel.

Les routes admin restent réservées à la session admin serveur. Les secrets du
proxy sont des variables d'exécution côté Edge et Render. N'activer la signature
en recette que lorsque les deux versions correspondantes sont déployées.
Le service de recette existant et sa base sont à préserver. L'intégration
dans la branche déployée, l'activation fournisseurs et toute dépense exigent
une décision séparée. Voir `docs/recette/livraison-15-novembre.md` pour les critères.
