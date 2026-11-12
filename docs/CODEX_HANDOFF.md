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

### Suite V1 après l'intégration

La PR d'intégration #18 (`c4877d8`) cible la livraison depuis `13d63a0`.
Le lot suivant ajoute la recherche des codes propriétaires, les compteurs issus
des attributions et crédits existants et un export CSV réservé aux
administrateurs. Les jours crédités sont affichés à partir du journal de
récompenses. Leur application aux abonnements reste soumise à l'arbitrage
commercial. Le lanceur `e2e/run-hosted-recette.sh` permet de saisir les
identifiants de recette sans écho, ou de les injecter à l'exécution.

Les portails attendent un accès permettant de lier leurs deux projets Netlify
au dépôt et de déployer la branche autorisée. Aucun projet vide n'a été créé.
L'API Render reste liée à la branche de livraison. Les variables de signature
Edge et Render devront être vérifiées ensemble après déploiement des builds
correspondants.

## Passation vérifiée du 12 novembre 2026

### Historique et attribution

Le point de départ de la reprise actuelle est `13d63a0`. Claude avait déjà
préparé la garde de recette `c89b615` / `a9f8234`, l’OTP de démonstration
`f408e64`, la fusion #11 `c7894fd`, les preuves HTTP `35a6975`, la
stabilisation Playwright `7b359a0` et la passation `13d63a0`. Le registre
et le crédit propriétaire `d8d1960` / `47b2a97` existaient également.
Les travaux de cette reprise ont utilisé des branches locales séparées.
Git CLI ne disposait pas de session authentifiée. Pour chaque publication,
le connecteur GitHub a créé un commit dont l’arbre était exactement celui du
commit local testé. Les SHA diffèrent du fait de la création du commit.
Aucune PR #13 à #19 n’a été fusionnée. Codex n’a déployé aucun de ces sept lots.
La branche locale de consolidation `gobilan-livraison-lots-locaux` a servi à
vérifier le patch `e37aed9` ; le checkout détaché `d2243f7` a vérifié son
application. Ces deux références ne sont pas des versions déployées.

| PR et branche | SHA local / GitHub testé | Problème, solution et fichiers principaux | Tests et limites |
| --- | --- | --- | --- |
| [#13](https://github.com/Monoru1/bilango/pull/13) `fix/gobilan-pwa-recette` | `864d25a` / `b571b4d` | Parcours hébergé absent. `e2e/pwa-smoke.mjs` accepte la preview explicite, trois comptes autorisés et un OTP injecté. Dossier recette enrichi. | Trois moteurs CI en base isolée. Recette hébergée bloquée avant demande d’OTP faute de variables injectées. |
| [#14](https://github.com/Monoru1/bilango/pull/14) `fix/gobilan-proxy-security` | `807ad8a` / `23e2bcb` | Le socket derrière proxy ne représente pas le client. Edge signe l’adresse fournie par Netlify avec méthode, URL et heure. `http/client-ip.ts` vérifie et normalise, `http/app.ts` sépare le quota direct. `netlify.toml`, `runtime-config.ts`, `server.ts` et `services/auth.ts` raccordent. | `client-ip.test.ts` : invalides, expirées, absentes, IPv4/IPv6, en-têtes et concurrence. Signature réelle Edge–Render non vérifiée. |
| [#15](https://github.com/Monoru1/bilango/pull/15) `feat/gobilan-otp-policy` | `ce76777` / `b5996d7` | Divergence contractuelle. `packages/domain/src/security.ts`, `deps.ts`, `runtime-config.ts`, `server.ts`, `services/auth.ts` permettent CDC par défaut ou politique v1.2 après décision. | `auth.test.ts`, `runtime-config.test.ts`. REC-14 non recetté sur Netlify/Render. Descend de #14. |
| [#16](https://github.com/Monoru1/bilango/pull/16) `feat/gobilan-portails-recette` | `6b93df8` / `342031b` | Deux sites distincts attendus. `apps/{admin,partners}/netlify.toml`, `scripts/configure-netlify.mjs` et guide : build, proxy API, origine distincte et erreur JSON. | Builds et routage vérifiés. Projets Netlify à rattacher. Descend de #14. |
| [#17](https://github.com/Monoru1/bilango/pull/17) `feat/gobilan-admin-referral-codes` | `7da73a6` / `10e8ff4` | Liste REC-13 absente. `apps/admin/src/{App,Operations}.tsx`, `http/app.ts`, `services/admin.ts` ajoutent lecture paginée, code, propriétaire et statut. | `http.test.ts` et `portals-smoke.mjs` : lecture et refus hors admin. Déploiement restant. |
| [#18](https://github.com/Monoru1/bilango/pull/18) `integration/gobilan-15-novembre` | `acacc84` / `c4877d8` | Combine #14, #15, #16, #17, #13 sur `13d63a0`. Proxy appliqué une fois. Seul conflit textuel dans cette passation, notes proxy et PWA conservées. | CI combinée. Marqueur de clé factice absent de trois bundles publics. Intégration vers la livraison en attente d’autorisation. |
| [#19](https://github.com/Monoru1/bilango/pull/19) `feat/gobilan-v1-recette-admin` | `172cd47` / `e529b61` | `Operations.tsx`, `admin.ts` et `http/app.ts` ajoutent recherche, compteurs, date, export filtré et neutralisation de formules. `e2e/run-hosted-recette.sh` masque la saisie et coupe les traces. | `http.test.ts` : 401, filtres, pagination, récompense et CSV. Lanceur syntaxiquement vérifié et refus sans identifiants. Désactivation auditée et exécution hébergée restantes. |

### Tests par SHA

Sur chaque ligne, le check exécute TypeScript, ESLint, Vitest et les builds API,
PWA, partenaires et administration. Le second total correspond à la suite API
sur PostgreSQL réseau dans le job `postgres`. Les tests de concurrence et
d’isolation tournent avec les suites API. Les six jobs sont `check`,
`postgres`, `acceptance-container` et les trois navigateurs Chromium 320,
Firefox 390 et WebKit 768. Chaque job PostgreSQL a aussi exécuté
`pg_dump/pg_restore` vers une base isolée avec vérification de l’utilisateur,
de la caisse, de l’historique et des triggers. La CI exerce des données de test.

| SHA GitHub | npm run check, réussis et ignorés localement | PostgreSQL, réussis | Run CI vérifié |
| --- | --- | --- | --- |
| `b571b4d` | 392 et 11 | 224/224 | [43201702895](https://github.com/Monoru1/bilango/actions/runs/43201702895) 6/6 |
| `23e2bcb` | 395 et 11 | 227/227 | [43201709593](https://github.com/Monoru1/bilango/actions/runs/43201709593) 6/6 |
| `b5996d7` | 397 et 11 | 229/229 | [43201730385](https://github.com/Monoru1/bilango/actions/runs/43201730385) 6/6 |
| `342031b` | 395 et 11 | 227/227 | [43202497418](https://github.com/Monoru1/bilango/actions/runs/43202497418) 6/6 |
| `10e8ff4` | 392 et 11 | 224/224 | [43203072937](https://github.com/Monoru1/bilango/actions/runs/43203072937) 6/6 |
| `c4877d8` | 397 et 11 | 229/229 | [43207568980](https://github.com/Monoru1/bilango/actions/runs/43207568980) 6/6 |
| `e529b61` | 397 et 11 | 229/229 | [43208081346](https://github.com/Monoru1/bilango/actions/runs/43208081346) 6/6 |

Le contrôle de reprise sur le checkout local `172cd47` (arbre de `e529b61`)
a exécuté `client-ip.test.ts`, `auth.test.ts`, `http.test.ts` et `tenant.test.ts` :
60 tests réussis sur 60.

Le job `check` de #18 affiche zéro vulnérabilité dans l’audit des dépendances
production. Cette mesure correspond au SHA et à l’instant du job. Les tests
authentifiés en CI passent dans un environnement isolé, avec transports de test.
La démo HTTP historique sur `c7894fd` est documentée dans
`docs/recette/preuves/2026-11-12-recette-render.md`.

### Infrastructure constatée

- Render `gobilan-recette-api` : dernier déploiement `dep-dbqos559el5s73f63pv0`,
  live sur `13d63a0`, fin de déploiement le 12 novembre à 11:00:47 heure de
  Paris. `/health` et `/ready` répondent 200 lors de l’audit.
- Netlify `gobilan-pwa` : preview #12 `6af58e17c8071a67fd1deded` sur le même
  SHA. Accueil 200, `/v1/me` sans session 401, `/v1/auth/config` indique
  WhatsApp simulé, CAPTCHA de développement et paiements désactivés.
  Le site public Netlify `https://gobilan-pwa.netlify.app` est distinct :
  déploiement `6aec7a24c48e85be35716365` sur `871824c` (`main`).
- Le connecteur Netlify a retourné uniquement `gobilan-pwa` pour GoBilan.
  Aucun déploiement des deux portails n’a été identifié. Le proxy HMAC ne
  fait pas partie de la version servie. Les valeurs des variables sensibles
  et l’état des fournisseurs non exposés restent non vérifiés.
- PostgreSQL : le connecteur indique `gobilan-recette` disponible en version 17,
  plan gratuit à Francfort, expiration le 9 décembre 2026. `/ready` confirme une requête de disponibilité. La preuve
  héritée documente 001 à 007 et la persistance après redémarrage. Aucun
  inventaire SQL distant ni restauration distante n’a été lancé pendant
  cet audit.

Suite exécutable : [prompt Claude](CLAUDE_REPRISE_LIVRAISON_FINALE_15_NOV_2026.md),
[matrice](recette/matrice-exigences.md) et [bilan de livraison](recette/livraison-15-novembre.md).
