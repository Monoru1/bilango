# REPRISE CODEX — GOBILAN, LIVRAISON FINALE DU 15 NOVEMBRE 2026

Tu es Codex. Tu reprends GoBilan (SaaS de Novadis Digital : Bénin, Togo, Côte d'Ivoire) là où
Claude s'est arrêté le 12 novembre 2026. **Ta mission est de produire du code, de terminer les
fonctionnalités V1 et de préparer la livraison — pas de refaire un audit ni de rendre un rapport.**

Lis ce document en entier, puis `AGENTS.md`, puis commence la tâche T1.

## A. Contexte exact

**Objectif** : V1 complète, fonctionnelle et sécurisée livrée au client le **15 novembre 2026**
(date contractuelle confirmée par le propriétaire le 12 novembre ; le 1er décembre n'est plus la cible).

**Références contractuelles** (elles priment sur tout autre document) :
- `docs/cahiers-des-charges/CDC_GoBilan_2026-10-19.pdf` (29 pages) et son `_EXTRACTION.txt`.
- `docs/cahiers-des-charges/Modifications_GoBilan_v1.2_2026-11-01.pdf` (5 pages, mention « à valider
  avant développement ») et son `_EXTRACTION.txt`.
- Issue #8 ; `docs/recette/matrice-exigences.md` ; `docs/decisions/contradictions-cdc.md`.

**Architecture** (monorepo npm workspaces, TypeScript) :
- `apps/pwa` : PWA propriétaire/employés (React, Vite). `apps/partners`, `apps/admin` : portails.
- `apps/api` : Fastify 5 + PostgreSQL (`pg`), PGlite pour les tests. Migrations `apps/api/migrations/001…007`.
- `packages/domain` (règles métier, seul endroit autorisé), `packages/contracts` (zod), `packages/ui`.
- Tests : vitest par workspace ; E2E Playwright (`e2e/*.mjs`, trois moteurs en CI) ; CI `.github/workflows/ci.yml`
  (jobs `check`, `postgres`, `acceptance-container`, `browser` ×3).

**Branches et PR**
| Élément | État |
|---|---|
| `main` | `871824c`, en retard ; ne rien y fusionner sans accord explicite du propriétaire |
| `fix/gobilan-livraison-15-novembre` | **branche de travail et de déploiement Render** ; contient PR #9, #10, #11 |
| PR #9 (`fix/p0-demo-november` → `main`) | brouillon, ouverte |
| PR #10 (livraison → `fix/p0-demo-november`) | brouillon, ouverte |
| PR #11 (OTP de démonstration + garde des migrations) | **fusionnée** dans la branche de livraison (`c7894fd`) |
| PR #12 (livraison → `main`) | brouillon, **ne pas fusionner** ; sert uniquement à produire la preview Netlify |
| `infra/render-recette-blueprint` | contient `render.yaml` (Blueprint Render, synchronisation automatique désactivée) |

Tout push sur `fix/gobilan-livraison-15-novembre` redéploie l'API de recette (Render) **et** reconstruit la
preview Netlify. Travaille sur des branches `feat/…` ou `fix/…` et ouvre des PR vers la branche de livraison.

**Infrastructure de recette (plans gratuits, aucune dépense autorisée)**
- API : https://gobilan-recette-api.onrender.com (service Render `gobilan-recette-api`, Francfort). `/health`, `/ready`.
  S'endort après inactivité : premier appel lent.
- Base : Render PostgreSQL 17 `gobilan-recette` (expire le **9 décembre 2026**), accès externe fermé,
  `DATABASE_URL` interne injectée par le Blueprint. 37 tables, migrations 001–007 appliquées.
- PWA : https://deploy-preview-12--gobilan-pwa.netlify.app (projet Netlify `gobilan-pwa`, variable de build
  `API_ORIGIN` = URL de l'API ; `scripts/configure-netlify.mjs` génère le proxy `/v1/*`).
  `gobilan-pwa.netlify.app` sert encore l'ancien build de `main`.
- `gobilan.com` appartient au client : **ne jamais y toucher**.
- Mode d'exécution : `NODE_ENV=recette`, `RENDER_RECETTE=true`, fournisseurs **simulés**
  (`PROVIDER_MODE` non défini). `PWA_ORIGIN` = URL exacte de la preview. `PARTNERS_ORIGIN` et `ADMIN_ORIGIN`
  sont des valeurs de réserve en `.invalid` (portails non déployés) — à remplacer, voir T5.
- OTP de démonstration : 20 numéros fictifs, code dans la variable Render `RECETTE_DEMO_OTP` (jamais dans Git
  ni dans un rapport), échéance `RECETTE_DEMO_OTP_EXPIRES_AT` = 16 novembre 2026 23:00 UTC.
  Détail : `docs/recette/otp-demo-recette.md`.

**Documentation à lire** : `docs/CODEX_HANDOFF.md` (section « État au 12 novembre »),
`docs/recette/otp-demo-recette.md`, `docs/recette/preuves/2026-11-12-recette-render.md`,
`docs/SECURITY_MODEL.md`, `docs/DEPLOYMENT_READINESS.md`.

## B. État des travaux

Légende : **V** terminé et vérifié sur l'environnement déployé · **I** implémenté, tests automatisés verts,
non validé en déployé · **P** partiel · **M** manquant · **B** bloqué par un fournisseur ou une décision.

| Fonctionnalité | État | Fichiers | Tests / preuves |
|---|---|---|---|
| Démarrage API recette, PostgreSQL persistant, `/health`, `/ready` | V | `apps/api/src/server.ts`, `runtime-config.ts`, `render-recette-target.ts` | preuves du 12 nov. |
| Garde des migrations de recette | V | `apps/api/src/recette-migration-guard.ts` | `recette-migration-guard.test.ts` ; journal `decision=initialize` puis `up_to_date` |
| OTP de démonstration, aucun code dans les journaux | V | `apps/api/src/recette-demo-otp.ts`, `services/auth.ts` | `recette-demo-otp.test.ts` ; journaux Render vérifiés |
| Inscription, PIN, profil, reconnexion par PIN, déconnexion (appels HTTP) | V | `services/auth.ts`, `http/app.ts` | preuves du 12 nov. |
| Création de business, essai 7 jours, bilan, caisse théorique (appels HTTP) | V | `services/business.ts`, `reports.ts`, `subscriptions.ts`, `packages/domain` | preuves du 12 nov. |
| Proxy Netlify `/v1/*` → API, refus d'une origine non déclarée | V | `netlify.toml`, `scripts/configure-netlify.mjs` | preuves du 12 nov. |
| Parcours PWA **dans l'interface** sur la preview (navigateur) | **M (non exécuté)** | `apps/pwa/src/screens/*`, `e2e/pwa-smoke.mjs` | E2E CI en local seulement |
| Invitations, acceptation, rôles, permissions, isolation | I | `services/business.ts`, `workspace.ts` | `tenant`, `roles`, `workspace`, `concurrency` tests |
| Bilans multi-auteurs, édition 24 h, versions, recalcul, stock | I | `services/reports.ts`, `packages/domain` | `reports.test.ts`, `pwa-smoke.mjs` |
| Historique, tableaux de bord, export PDF, aide, pages légales | I | `screens/Reports.tsx`, `Home.tsx`, `lib/pdf.ts`, `Legal.tsx` | tests PWA ; PDF non vérifié en déployé |
| Installation Android / iPhone, navigateurs intégrés | I | `screens/Install.tsx`, `lib/env.ts` | `install-smoke.mjs` ; **aucun appareil physique** |
| Limitation par IP derrière Render (`trustProxy: false`) | **P — défaut ouvert** | `apps/api/src/http/app.ts` l.46, 65, 125, 137 | voir T1 |
| OTP WhatsApp Meta, CAPTCHA Turnstile | B | `integrations/configured.ts` | doubles HTTP uniquement ; comptes non fournis |
| Abonnement 2 000 FCFA / 30 j, grâce 3 j, blocage J4 | I | `packages/domain/src/subscription.ts`, `services/subscriptions.ts` | `subscription.test.ts` |
| Paiement FedaPay, webhook signé, idempotence, rapprochement | I / B | `integrations/configured.ts`, `services/subscriptions.ts`, migration 005 | doubles HTTP ; sandbox non testé |
| Notifications internes, heure de fermeture, fuseaux IANA | I | `packages/domain/src/notifications.ts`, `services/jobs.ts`, `push.ts` | `v12-closing-notifications.test.ts` (REC-01, 05, 06) |
| Web Push réel (VAPID) | B | `integrations/configured.ts`, `apps/pwa/public/sw.js` | clés VAPID absentes |
| Rappels WhatsApp employés (v1.2 §3), rapport du soir (v1.2 §5) | M / B | à créer dans `domain`, `services/jobs.ts` | REC-02, 03, 04, 07 ; décision V1 et templates Meta requis |
| Parrainage propriétaire | P | migrations 006, 007, `services/owner-referrals.ts`, `screens/OwnerReferral.tsx` | `owner-referrals.test.ts` ; REC-09 à 13 ouverts ; règles commerciales non tranchées |
| Portail partenaires (agent, manager, influenceur) | I, **non déployé** | `apps/partners`, `services/partners.ts` | `partners.test.ts`, `portals-smoke.mjs` |
| Administration (allowlist, 2FA e-mail, versements, audit) | I, **non déployée** | `apps/admin`, `services/admin.ts` | `admin-allowlist.test.ts`, `portals-smoke.mjs` |
| Statistiques d'acquisition, entonnoir, exports CSV (v1.2 §12/13) | M | à créer | — |
| Quotas OTP v1.2 (5 / 24 h, cadence 2 min) | B | `packages/domain/src/security.ts` (`OTP_MAX_ISSUES_PER_24H = 2`) | REC-14 ; contradiction CDC / v1.2 |
| SMTP transactionnel | B | `integrations/acceptance.ts`, `configured.ts` | compte non fourni ; en recette les e-mails ne sont ni envoyés ni journalisés |
| Production séparée, sauvegardes, restauration, surveillance | M / B | `docs/DEPLOYMENT_READINESS.md`, `scripts/acceptance-backup.sh` | dépense à faire approuver |

Les états **I** reposent sur la suite automatisée et sur `docs/recette/matrice-exigences.md` ; Claude ne les a pas
re-vérifiés un par un. Ne les présente pas comme validés avant de les avoir exercés sur l'environnement déployé.

## C. Travail accompli par Claude (12 novembre 2026)

- **Panne Render résolue** : `NODE_ENV=production` par défaut sur Render alors que le mode recette exige l'inverse,
  puis `DATABASE_URL` absente. Corrigé par configuration et Blueprint, sans `PRODUCTION_RELEASE_APPROVED`.
- **Commits** sur la branche de livraison :
  - `f408e64` OTP de démonstration à liste fermée et durée limitée ; plus aucun code, numéro ni corps d'e-mail
    dans les journaux de recette ; bandeau « DÉMO — WhatsApp simulé » (`App.tsx`, `RemoteStore.ts`).
  - `a9f8234` garde des migrations (inspection en lecture seule avant toute migration).
  - `c7894fd` fusion de la PR #11. `35a6975` passation et preuves. `7b359a0` correction d'une course dans
    `e2e/portals-smoke.mjs` (lecture unique du journal de l'API → attente bornée).
  - `ca5a3a8` (branche `infra/render-recette-blueprint`) : `render.yaml`.
- **Tests exécutés** : `npm run check` → 392 tests réussis, 11 tests PostgreSQL réseau ignorés en local
  (exécutés en CI) ; CI verte sur `7b359a0` (six jobs).
- **Déploiements vérifiés** : API live, base initialisée, parcours HTTP réel (voir preuves), persistance après
  redémarrage, preview Netlify raccordée.
- **Code de démonstration** : remplacé le 12 novembre après avoir été communiqué une première fois ; la valeur
  courante se lit uniquement dans la variable Render `RECETTE_DEMO_OTP`.
- **Risques résiduels** : tout ce qui est marqué P, M ou B ci-dessus ; plan gratuit Render (mise en veille,
  expiration de la base) ; quota OTP de 2 par numéro et par 24 h, qui gêne les répétitions de recette.

## D. Tâches à exécuter, dans cet ordre

### T1 — P0 — Adresse IP réelle derrière Render et Netlify
- **Exigence** : CDC §4.4, §13 (quotas par numéro, appareil, IP ; limitation des requêtes).
- **Fichiers** : `apps/api/src/http/app.ts` (`Fastify({ trustProxy: false })`, `rateLimit` global 300/min,
  `authLimit` 10/min, `req.ip` passé à `requestOtp`), `apps/api/src/runtime-config.ts`, `netlify.toml`,
  `scripts/configure-netlify.mjs`, `docs/SECURITY_MODEL.md`.
- **Problème** : `req.ip` est l'adresse du proxy. Tous les visiteurs partagent donc le quota OTP par IP
  (10 / 24 h) **et** les limites de débit (10 demandes d'authentification par minute au total).
- **Attendu** : IP cliente dérivée de `X-Forwarded-For` en ne faisant confiance qu'aux sauts ajoutés par
  l'infrastructure. La chaîne est navigateur → Netlify (proxy `/v1/*`) → Render → API, mais l'API est aussi
  joignable directement : le nombre de sauts diffère. Mesure la chaîne réelle (compte d'entrées, sans journaliser
  d'adresse), rends la confiance configurable (`TRUSTED_PROXY_HOPS`, 0 par défaut, validé au démarrage), et
  n'accorde le saut Netlify que si la requête porte une preuve vérifiable (redirection Netlify signée, en-tête
  `x-nf-sign` JWT HS256 avec secret partagé côté serveur). Sans preuve, retombe sur le saut Render seul.
- **Sécurité** : une entrée `X-Forwarded-For` fournie par le client ne doit jamais être retenue ; ne désactive
  aucune limitation ; aucun secret ni adresse IP dans les journaux.
- **Tests** : unitaires sur la sélection de l'IP (en-tête forgé à gauche, absence d'en-tête, signature absente
  ou invalide) ; `http.test.ts` ; quotas par numéro, appareil et IP avec plusieurs comptes ; demandes concurrentes
  (`concurrency.test.ts`).
- **Acceptation** : deux clients distincts ne partagent plus de compteur ; un client ne peut pas changer son IP
  apparente ; vérifié sur la recette déployée.

### T2 — P0 — Parcours complets de la PWA sur la preview déployée
- **Exigence** : CDC §3 à §8 ; critères REC.
- **Fichiers** : `e2e/pwa-smoke.mjs`, `e2e/run-smoke.mjs` (ajoute un mode ciblant une URL distante),
  `apps/pwa/src/screens/*`.
- **Attendu** : Playwright (Chromium, Firefox, WebKit ; 320, 390, 768 px) contre
  `https://deploy-preview-12--gobilan-pwa.netlify.app` : première ouverture, inscription, PIN, business, heure de
  fermeture, invitation et acceptation d'un employé, permissions, bilans multi-contributeurs, caisse, stock,
  modification sous 24 h et recalcul, historique, export PDF, abonnement, déconnexion, reconnexion, session expirée.
  La PWA n'ouvre les écrans métier qu'en mode installé (`currentEnv().standalone`) : émule `display-mode: standalone`.
- **Contraintes** : numéros de `RECETTE_DEMO_PHONES` uniquement ; code lu dans une variable d'environnement du
  lanceur, jamais écrit dans le dépôt ni dans les journaux ; respecte les quotas (2 codes par numéro et par 24 h).
- **Acceptation** : chaque défaut reproduit est corrigé avec un test de régression ; preuves dans
  `docs/recette/preuves/` ; une émulation n'est jamais présentée comme un test sur appareil physique.

### T3 — P0 — Jeu de données de démonstration et cloisonnement
- Script idempotent (API uniquement, pas d'accès SQL direct) créant un propriétaire, deux business, plusieurs
  employés à rôles différents, des bilans historiques, un stock. Vérifie qu'un compte ne lit aucune donnée d'un
  autre business. Documente dans `docs/recette/demo-15-novembre.md`.

### T4 — P1 — Fournisseurs réels (dès réception des identifiants)
- **Fichiers** : `apps/api/src/integrations/configured.ts`, `acceptance.ts`, `.env.providers.example`.
- Pour Meta WhatsApp, SMTP, Turnstile, FedaPay (sandbox d'abord), VAPID : configure, exécute un test réel
  autorisé vers les listes `TEST_*_RECIPIENTS`, consigne pour chacun : code terminé / configuration disponible /
  sandbox réussi / test réel effectué / validation production. Aucun paiement Live sans accord écrit.
- **Acceptation** : aucune intégration déclarée opérationnelle sur la seule foi d'un double HTTP.

### T5 — P1 — Déployer les portails partenaires et admin
- Deux projets Netlify gratuits distincts (aucune dépense), proxy `/v1/*` identique, puis remplace
  `PARTNERS_ORIGIN` et `ADMIN_ORIGIN` de la recette par leurs origines réelles. Exécute `e2e/portals-smoke.mjs`
  contre les URLs déployées. Dépend d'un SMTP de test pour l'activation et la double authentification.

### T6 — P1 — Fonctions v1.2 restantes et arbitrages
- Quotas OTP configurables (2 ou 5 par 24 h, cadence 2 min) sans trancher à la place du propriétaire.
- Parrainage propriétaire : REC-09 à 13, administration, audit ; règles de consommation et de cumul des 30 jours
  à faire arbitrer.
- Rappels WhatsApp employés et rapport du soir : uniquement si validés pour la V1 ; consentement, idempotence,
  fuseaux `Africa/Porto-Novo`, `Africa/Lome`, `Africa/Abidjan`, aucune donnée financière dans un message.
- Statistiques d'acquisition, entonnoir d'installation, exports CSV réservés aux administrateurs.

### T7 — P1 — Sécurité, exploitation, livraison
- Vérifications ciblées avec tests de non-régression : accès horizontal, élévation de privilèges, sessions
  révoquées, CSRF, XSS, exports, webhooks, paiements et commissions concurrents, `npm audit`.
- Vérifie qu'aucune variable `RECETTE_DEMO_*` ne peut exister en production (déjà bloquant au démarrage : garde-le).
- Plan de production séparée (hébergement, sauvegardes hors hôte, restauration vérifiée, surveillance, retour
  arrière) avec **prix exacts soumis au propriétaire avant tout engagement**.
- Documents : `docs/recette/livraison-15-novembre.md` (à créer), rapport REC-01 à
  REC-14, guide d'exploitation, guide de prise en main client, rapport de sécurité, rapport GO / NO-GO.

## E. Règles d'exécution

1. Commence par ce document, `AGENTS.md` et `docs/CODEX_HANDOFF.md`. Ne refais pas d'audit général.
2. Pars de `fix/gobilan-livraison-15-novembre` à jour ; conserve toutes les modifications de Claude.
3. Un lot = une branche, des commits explicites, une PR vers la branche de livraison, `npm run check` avant
   chaque commit, CI verte avant fusion dans la branche de livraison.
4. Après chaque lot : vérifie le résultat **déployé**, ajoute la preuve dans `docs/recette/preuves/`, mets à jour
   `docs/recette/matrice-exigences.md` et la section d'état de `docs/CODEX_HANDOFF.md`.
5. Données : aucune suppression ni réinitialisation. Toute nouvelle migration sur `gobilan-recette` exige une
   sauvegarde récupérable puis `RECETTE_MIGRATION_APPROVED_UP_TO=<fichier>` ; ne contourne jamais cette garde.
6. Interdits sans accord explicite du propriétaire : fusion vers `main`, dépense, opération destructive, paiement
   Live, envoi externe hors listes de test, modification de `gobilan.com`, bascule commerciale.
7. Aucun secret, code OTP ou mot de passe dans Git, les journaux ou les rapports.
8. Une simulation n'est jamais présentée comme une intégration réelle. Un test automatisé vert n'est pas une
   validation en déployé. Une émulation n'est pas un test sur appareil.
9. Si un fournisseur ou une décision bloque, continue les tâches indépendantes et regroupe les demandes en une seule.
10. Ne termine jamais une session sur une proposition quand une implémentation est possible.

## F. Livrables attendus

PWA complète ; API opérationnelle ; portail partenaires et administration déployés sur des origines réelles ;
fournisseurs configurés et vérifiés ; sécurité validée ; tests de recette REC-01 à REC-14 documentés ;
documentation d'exploitation ; guide de prise en main client ; rapport final **GO / NO-GO avec preuves** ;
liste des dépendances externes empêchant la livraison.

**État au 12 novembre : NO-GO.** Causes exactes : fournisseurs réels non configurés (Meta, SMTP, Turnstile,
FedaPay, VAPID), portails non déployés, limitation par IP à corriger, parcours d'interface non validés en
déployé, arbitrages v1.2 en attente, aucune infrastructure de production. Ne déclare GO que critère par critère,
preuve à l'appui.

## Demande groupée au propriétaire (à relancer tant qu'elle n'est pas satisfaite)

1. Compte Meta WhatsApp Business vérifié : identifiant du numéro, jeton, template d'authentification approuvé,
   version de l'API Graph.
2. SMTP transactionnel : hôte, port, identifiants, adresse d'expédition.
3. Cloudflare Turnstile : clé de site et clé secrète.
4. FedaPay : clés sandbox, secret de webhook ; puis accord écrit avant tout passage en Live.
5. Paire de clés VAPID (peut être générée par Codex sur accord) et adresse de contact.
6. Décisions : quota OTP (2 ou 5 par 24 h) ; rappels WhatsApp et rapport du soir en V1 ou non ; règles du
   parrainage (consommation, cumul, plafond, essai du filleul) ; règle de réaffichage du guide iPhone.
7. Hébergement de production : budget et fournisseur approuvés ; domaines et DNS pour les trois interfaces.
8. Appareils physiques Android et iPhone pour l'homologation de l'installation.
