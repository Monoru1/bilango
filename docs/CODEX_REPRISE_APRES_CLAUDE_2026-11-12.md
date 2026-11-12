# REPRISE CODEX APRÈS CLAUDE — GOBILAN V1 COMMERCIALE, LIVRAISON DU 15 NOVEMBRE 2026

Tu es Codex. Tu reprends la responsabilité technique de GoBilan (Novadis Digital ; Bénin, Togo, Côte d'Ivoire)
dans une nouvelle session, sans accès aux conversations précédentes. Ce document contient tout ce qu'il faut.
**Ta mission est de produire du code, des tests, des déploiements de recette autorisés et des preuves, jusqu'à
une V1 réellement utilisable par le client le 15 novembre 2026. Pas d'audit général, pas de reconstruction.**

## C1. Mission

- Échéance impérative : **15 novembre 2026**, livraison finale de la V1 commerciale (ni démo, ni bêta).
- Références contractuelles : `docs/cahiers-des-charges/CDC_GoBilan_2026-10-19.pdf` et
  `Modifications_GoBilan_v1.2_2026-11-01.pdf` (extractions `_EXTRACTION.txt` à côté). La v1.2 porte la mention
  « à valider avant développement » : ses points non arbitrés ne sont pas des décisions acquises.
- État au 12 novembre, 16 h : **NO-GO commercial** (fournisseurs réels absents, v1.2 incomplète, pas de production).
- Lis d'abord `AGENTS.md`, puis ce document, puis commence la tâche C4. Ne lis le reste qu'au besoin.

## C2. État exact de GitHub (vérifié le 12 novembre 2026 à 16 h, heure de Paris)

Dépôt : `Monoru1/bilango` (monorepo npm : `apps/pwa`, `apps/api`, `apps/partners`, `apps/admin`,
`packages/domain`, `packages/contracts`, `packages/ui`, `e2e/`, `netlify/edge-functions/`).

| Branche | HEAD | Rôle |
|---|---|---|
| `fix/gobilan-livraison-15-novembre` | `8a3ad832858b5283812d9eeee525721a902e7b8f` | **Branche de travail ; tout push redéploie Render et la preview Netlify** |
| `main` | `871824c827a3215d5d7df1ef4be9edf9e7ed0289` | En retard ; aucune fusion sans accord explicite du propriétaire |
| `integration/gobilan-15-novembre` | `a2613638141c76abf0761e72dcfe8ccdb531c1f6` | Entièrement fusionnée dans la livraison |
| `infra/render-recette-blueprint` | `ca5a3a8ab22bfae507871943350aa84cebd636a1` | `render.yaml` du Blueprint Render (synchronisation automatique désactivée) |
| `docs/passation-claude-codex-2026-11-12` | branche de ce document | Passation ; contient aussi la PR #20 réconciliée |

PR fusionnées (commits de fusion) :
- #11 OTP de démonstration et garde des migrations → livraison : `c7894fdea20f14819c32c0dca298c693bb50aa8b`
- #21 SEC-48 → branche de #19 : `50845e900342ca18371f30365c1efa27d8a7d408`
- #19 compléments V1 → intégration : `a2613638141c76abf0761e72dcfe8ccdb531c1f6`
- #18 intégration des lots #13 à #17 → livraison : `5ec41272fcd9b25e701302de6e8f01a34ebaf713`
- #22 limiteur de débit → livraison : `164f0cee782928e28bfde4e9375c95d56d883ccc`

Commits directs de Claude sur la livraison après ces fusions : `2730c9db3632d0f8c5ad07d6c100241a72fca8d7`
(preuves) et `8a3ad832858b5283812d9eeee525721a902e7b8f` (test d'installation rendu déterministe).

PR ouvertes :
- #13, #14, #15, #16, #17 : **déjà contenues dans la livraison via #18** ; ne pas les fusionner ni les
  réappliquer ; leur fermeture revient au propriétaire.
- #20 (passation Codex du matin) : en conflit avec la livraison ; **son contenu est repris et réconcilié dans
  la PR de passation qui porte ce document**. Ne pas la fusionner séparément.
- #12 (livraison → `main`, brouillon) : **ne pas fusionner** ; elle sert uniquement à produire la preview Netlify.
- #10, #9, #7, #6, #4 : historiques, ne pas toucher.

Dernier SHA déployé : Render `gobilan-recette-api` sert `8a3ad83` (déploiement « live » vérifié) ; la preview
Netlify #12 est construite sur `8a3ad83` ; les deux portails sont construits sur l'arbre de `164f0ce`
(aucun changement applicatif depuis : `2730c9d` et `8a3ad83` ne touchent que des documents et un test).

CI sur `8a3ad83` : `check`, `postgres`, `acceptance-container`, `browser` Chromium, Firefox et WebKit — tous
verts, trois exécutions chacun.

Historique : Codex a livré les lots #13 (Playwright hébergé), #14 (proxy signé), #15 (politique OTP),
#16 (configuration des portails), #17 (REC-13), #18 (intégration), #19 (filtres et CSV des parrainages,
lanceur sécurisé), #20 (audit de 46 fonctionnalités). Claude a remis l'API en service, ajouté l'OTP de
démonstration et la garde des migrations (#11), SEC-48 (#21), le correctif du limiteur (#22), intégré la
chaîne, configuré le proxy, déployé les portails et exécuté le parcours hébergé.

Fichiers essentiels : `apps/api/src/server.ts`, `runtime-config.ts`, `http/app.ts`, `http/client-ip.ts`,
`recette-demo-otp.ts`, `recette-migration-guard.ts`, `services/*.ts`, `integrations/configured.ts` ;
`netlify/edge-functions/api-client-ip.js`, `scripts/configure-netlify.mjs`, `netlify.toml` (racine et un par
portail) ; `e2e/pwa-smoke.mjs`, `e2e/run-hosted-recette.sh`, `e2e/install-smoke.mjs`, `e2e/portals-smoke.mjs` ;
`docs/recette/matrice-exigences.md` (état par fonctionnalité), `docs/recette/preuves/`.

## C3. Acquis à ne pas redévelopper (avec leurs limites réelles)

| Acquis | Où | Limite |
|---|---|---|
| Recette Render + PostgreSQL 17 (`gobilan-recette`, 37 tables, migrations 001–007) | `render.yaml`, variables Render | Plans gratuits : mise en veille, base expirant le 9 décembre 2026, pas de sauvegarde hors hôte |
| Garde des migrations de recette | `apps/api/src/recette-migration-guard.ts` | Toute nouvelle migration bloque le démarrage tant que `RECETTE_MIGRATION_APPROVED_UP_TO` ne la nomme pas, après sauvegarde |
| OTP de démonstration (liste fermée, échéance) ; aucun code ni e-mail dans les journaux | `apps/api/src/recette-demo-otp.ts` | Temporaire ; échéance 16 novembre 23:00 UTC ; ne remplace pas Meta ; e-mails ni envoyés ni journalisés en recette |
| Proxy signé (IP cliente vérifiée) | `netlify/edge-functions/api-client-ip.js`, `apps/api/src/http/client-ip.ts` | Fenêtre de 60 s sans usage unique (rejeu limité à sa propre IP) ; clé stockée en variable Netlify ordinaire (voir C9) |
| Limiteur de débit réellement appliqué | `apps/api/src/http/app.ts` (`app.after`), `test/rate-limit.test.ts` | 300/min global, 10/min par adresse sur les routes d'authentification : à arbitrer pour les adresses partagées |
| Politique OTP configurable | `GOBILAN_WHATSAPP_OTP_POLICY` (`cdc` par défaut) | Choix 2 ou 5 codes par 24 h non arbitré (REC-14) |
| Parcours PWA authentifié hébergé | `e2e/run-hosted-recette.sh` | Réussi sur Chromium automatisé 390 px uniquement ; ni Firefox/WebKit hébergés, ni appareil physique |
| Portails partenaires et admin en ligne | deux projets Netlify | Pas de redéploiement Git automatique ; aucune connexion authentifiée vérifiée (SMTP requis) |
| REC-13 (liste, recherche, compteurs, CSV des codes) et SEC-48 (désactivation auditée) | `services/admin.ts`, `apps/admin/src/Operations.tsx` | Testés en CI ; non exercés dans l'interface admin déployée |
| Suite de tests | `npm run check` : 406 tests réussis, 11 PostgreSQL réseau ignorés en local ; CI six jobs | Un test vert n'est pas une validation en déployé |

Parcours hébergé validé (19 étapes, commit `164f0ce`, comptes fictifs) : inscription → profil → business ;
heure de fermeture à la création puis modifiée (REC-01) ; premier bilan ; tableau de bord sans débordement ;
rechargement ; session employé réelle ; modification avec version d'origine conservée ; filtrage par
permission ; agrégation propriétaire/employé ; PDF ; coupure réseau puis reprise ; autre business → 404 ;
abonnement d'essai ; déconnexion ; reconnexion par PIN ; cookie httpOnly SameSite ; aucune erreur d'exécution.
Non exercés en déployé : stock, changement de rôle, récupération de PIN, nouvel appareil, blocage d'abonnement.

## C4. Première tâche — métriques administrateur v1.2 §13 calculées sur les données existantes

Réalisable sans fournisseur, sans décision et **sans migration**.

- **Branche de départ** : `fix/gobilan-livraison-15-novembre` (`8a3ad83` ou successeur vérifié) → crée
  `feat/admin-metrics-v12`.
- **Exigence** : v1.2 §13 (familles Acquisition, Activation, Conversion, Revenu), CDC §10 (accès admin).
- **Fichiers** : `packages/domain/src/` (nouveau module de calcul pur, par exemple `metrics.ts`),
  `packages/contracts/src/admin.ts`, `apps/api/src/services/admin.ts` (à côté de `stats()`),
  `apps/api/src/http/app.ts` (routes dans le bloc `app.after`), `apps/admin/src/` (onglet Statistiques),
  tests `apps/api/test/`, `packages/domain/src/__tests__/`.
- **Comportement attendu** : `GET /v1/admin/metrics?from=YYYY-MM-DD&to=YYYY-MM-DD` et
  `GET /v1/admin/metrics.csv` renvoient, à partir des tables existantes : comptes créés ; comptes créés par code
  de parrainage ; business créés ; premier employé invité ; premier bilan envoyé dans les 48 h et taux
  d'activation ; essais démarrés, en cours (jours restants), terminés sans paiement par semaine d'inscription,
  convertis ; délai moyen inscription → premier paiement ; abonnements actifs, en grâce, bloqués ; revenu
  confirmé par pays ; commissions dues et versées. Règles de calcul dans `packages/domain` uniquement.
  Les métriques d'audience (visiteurs, clics « Installer ») sont **hors de cette tâche** : elles exigent une
  migration et l'arbitrage anonymat/APDP (voir C6).
- **Sécurité** : session admin + origine admin + CSRF (`adminSession`) ; agrégats uniquement, aucun numéro,
  nom ou montant individuel ; CSV protégé contre l'injection de formules (réutilise l'export existant des
  codes) ; lecture seule ; ligne `audit_log` pour chaque export.
- **Tests** : calculs du domaine (bornes de dates, fuseau UTC, périodes vides) ; API : 401 sans session, 403
  mauvaise origine, session partenaire refusée, agrégats exacts sur un jeu de données construit, CSV ;
  PostgreSQL réel en CI.
- **Commandes** :
  ```bash
  git fetch origin && git checkout -B feat/admin-metrics-v12 origin/fix/gobilan-livraison-15-novembre
  npm ci --ignore-scripts
  npm run test -w @gobilan/api -- test/http.test.ts test/rate-limit.test.ts test/client-ip.test.ts
  # … implémentation …
  npm run check
  git push -u origin feat/admin-metrics-v12   # puis PR vers fix/gobilan-livraison-15-novembre
  ```
- **Acceptation** : `npm run check` vert ; CI six jobs verts ; aucune migration ajoutée ; PR ouverte vers la
  livraison ; ligne V12-METRICS de la matrice passée à « partiel » avec la liste de ce qui reste (audience).
- **Suite immédiate** : C5 tâche P0-2 (redéploiement automatique des portails), sans attendre de validation.

## C5. Plan P0 — livraison commerciale

Chaque tâche a une alternative réalisable sans identifiants.

| # | Tâche | Avec les accès | Sans les accès (à faire quand même) |
|---|---|---|---|
| P0-1 | SMTP : activation partenaire, réinitialisation, 2FA admin | Configurer `SMTP_*`, créer le premier admin, exécuter `e2e/portals-smoke.mjs` contre les portails déployés | Ajouter au lanceur hébergé un mode portails ; tests de liens d'activation expirés/rejoués |
| P0-2 | Redéploiement automatique des portails | Relier les deux projets Netlify au dépôt (package directory `apps/partners`, `apps/admin`, branche de livraison) | Documenter la procédure exacte ; script de vérification post-déploiement (origines, 401/403, proxy signé) |
| P0-3 | Turnstile | `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` ; vérifier refus d'un jeton invalide en déployé | Tests d'absence de repli silencieux quand `PROVIDER_MODE=configured` |
| P0-4 | FedaPay sandbox : checkout, webhook signé, idempotence, rapprochement, renouvellement, échec | Clés sandbox + secret webhook ; parcours complet en recette | Tests de concurrence paiement/commission ; écran d'historique des paiements |
| P0-5 | Meta WhatsApp OTP | Jeton, identifiant du numéro, template approuvé ; envoi vers `TEST_WHATSAPP_RECIPIENTS` | Récupération de PIN et nouvel appareil exercés en recette avec l'OTP de démonstration |
| P0-6 | Web Push | Clés VAPID ; abonnement, réception, révocation sur appareil | Tests du service worker et de la déduplication |
| P0-7 | Parcours hébergé complet | — | Étendre `e2e/pwa-smoke.mjs` : stock, changement de rôle, blocage d'abonnement ; lancer Firefox et WebKit contre la preview |
| P0-8 | Sauvegarde et restauration de la recette | Sauvegarde hors hôte approuvée | Procédure et script de restauration vérifiée sur base isolée (`scripts/acceptance-backup.sh`, `scripts/test-backup-restore.mjs`) |
| P0-9 | Production commerciale distincte | Budget approuvé par le propriétaire | Dossier chiffré : hébergement API permanent, PostgreSQL durable avec sauvegardes, trois sites, domaines, supervision, retour arrière |
| P0-10 | Limite d'authentification par adresse | Décision du propriétaire | Rendre la limite configurable par variable validée au démarrage, valeur actuelle par défaut |

## C6. Plan P1 — compléments v1.2

| Sujet | Priorité | Fichiers | Code attendu | Tests | Dépendances | Acceptation |
|---|---|---|---|---|---|---|
| Métriques §13 | P1 | voir C4 | voir C4 | voir C4 | aucune | voir C4 |
| Audience et entonnoir §12 | P1 | nouvelle migration, `apps/api`, `apps/pwa/src/screens/Install.tsx`, `apps/admin` | Comptage anonyme sans IP en clair ni cookie ; visites, visiteurs uniques, clics « Installer », installation Android, première ouverture ; sources ; exclusions robots/équipe ; CSV | agrégats, anonymat, isolation admin | **Migration → sauvegarde + approbation ; arbitrage anonymat/APDP** | REC associés documentés |
| Rappels WhatsApp employés §3 | P1 | `packages/domain/src/notifications.ts`, `apps/api/src/services/jobs.ts` | Jours 1 à 7, aucun si bilan envoyé, bascule interne ensuite ; idempotent ; fuseaux IANA | REC-02, 03, 04 | **Décision V1, consentement, templates Meta** | Aucun doublon, aucun montant dans un message |
| Rapport du soir §5 | P1 | idem | Un seul rapport par propriétaire, business à jour uniquement, heure configurable | REC-07 | **Décision V1, Meta** | idem |
| Consentement | P1 | `apps/pwa`, `apps/api` | Recueil et révocation avant tout envoi WhatsApp supplémentaire | API + écran | Décision V1 | Aucun envoi sans consentement |
| Parrainage propriétaire §8 | P1 | `apps/api/src/services/owner-referrals.ts`, `apps/pwa/src/screens/OwnerReferral.tsx` | Variantes sûres pour consommation, cumul, plafond des 30 jours, sans en appliquer une arbitrairement | REC-09 à 13 | **Arbitrage commercial** | Aucun double crédit, aucune commission partenaire créée à tort |
| Quotas OTP §7 | P1 | `GOBILAN_WHATSAPP_OTP_POLICY` | Déjà configurable | REC-14 | **Arbitrage 2 ou 5 par 24 h** | Recette hébergée de la valeur retenue |
| REC-01 à REC-14 | P0 | `docs/recette/matrice-exigences.md` | Tableau `Exigence, Scénario, Attendu, Réel, Environnement, SHA, Preuve, Statut` | — | selon ligne | Chaque REC a un statut prouvé |
| Administration et exports | P1 | `apps/admin`, `services/admin.ts` | Calendrier des versements, incidents, exports CSV restants | `admin*.test.ts`, `portals-smoke.mjs` | SMTP pour l'exercice en déployé | Exercé dans l'interface déployée |

## C7. Plan P2 — exploitation et remise

Déploiement final contrôlé ; supervision (disponibilité `/health`, `/ready`, erreurs) ; sauvegarde hors hôte et
restauration vérifiée ; procédure de retour arrière ; guides propriétaire, employé, partenaire, administrateur ;
guide d'installation Android/iPhone ; validation sur appareils physiques (jamais déduite d'une émulation) ;
rapport de sécurité ; PV de recette REC-01 à REC-14 ; rapport GO/NO-GO avec preuves dans
`docs/recette/livraison-15-novembre.md`.

## C8. Infrastructure de recette

| Élément | Valeur |
|---|---|
| API | https://gobilan-recette-api.onrender.com — `/health`, `/ready` (service Render `srv-dbospsm7bikc73a67l5g`, branche de livraison, déploiement automatique à chaque commit) |
| Base | Render PostgreSQL `gobilan-recette` (accès externe fermé ; `DATABASE_URL` interne injectée par le Blueprint `gobilan-recette`) |
| PWA | https://deploy-preview-12--gobilan-pwa.netlify.app (projet `gobilan-pwa`, preview de la PR #12, reconstruite à chaque commit) |
| Partenaires | https://gobilan-partenaires-recette.netlify.app (projet `gobilan-partenaires-recette`) |
| Administration | https://gobilan-admin-recette.netlify.app (projet `gobilan-admin-recette`) |
| Interdit | `gobilan.com` appartient au client : ne jamais y toucher. `gobilan-pwa.netlify.app` sert encore l'ancien `main`. |

Variables Render (noms uniquement) : `NODE_ENV=recette`, `RENDER_RECETTE=true`, `API_HOST`, `SECURE_COOKIES`,
`DATABASE_URL`, `PWA_ORIGIN` (URL exacte de la preview), `PARTNERS_ORIGIN`, `ADMIN_ORIGIN` (URLs des portails),
`PIN_PEPPER_HEX`, `PAYOUT_KEY_HEX`, `FEDAPAY_WEBHOOK_SECRET`, `GOBILAN_PROXY_KEY_HEX`, `RECETTE_DEMO_PHONES`,
`RECETTE_DEMO_OTP`, `RECETTE_DEMO_OTP_EXPIRES_AT`. Non définies : `PRODUCTION_RELEASE_APPROVED`,
`PROVIDER_MODE`, `GOBILAN_WHATSAPP_OTP_POLICY`, `RECETTE_MIGRATION_APPROVED_UP_TO`. Fournisseurs : voir
`.env.providers.example`. Ne jamais régénérer `PIN_PEPPER_HEX` ni `PAYOUT_KEY_HEX` (données existantes).

Variables Netlify, sur chacun des trois projets : `API_ORIGIN`, `GOBILAN_EDGE_API_ORIGIN` (origine de l'API),
`GOBILAN_PROXY_KEY_HEX` (identique à Render). Une variable Netlify ne prend effet qu'après un nouveau déploiement.

Proxy signé : la fonction Edge lit l'adresse de connexion fournie par Netlify (`context.ip`), signe
`v1 / horodatage / méthode / chemin / IP` en HMAC-SHA-256 et transmet l'en-tête `x-gobilan-proxy`. L'API vérifie
signature et fraîcheur (60 s, 5 s de dérive). Preuve absente, invalide ou expirée : la requête est comptée dans
un compteur unique « direct » partagé, jamais attribuée à une IP déclarée par le client.

Portails — limitation actuelle : ils ont été déployés par envoi d'un arbre du dépôt dans lequel le
`netlify.toml` du portail remplace celui de la racine, faute de pouvoir régler le « package directory » par
l'outil. Ils ne suivent donc pas les commits. Correction autorisée : relier chaque projet au dépôt dans Netlify
(base = racine, package directory `apps/partners` ou `apps/admin`, branche de livraison), ou refaire le même
envoi après chaque changement applicatif. Procédure : `docs/recette/portails-netlify.md`.

Comptes de recette : numéros fictifs de `RECETTE_DEMO_PHONES` (Bénin `01 99 99 00 01` à `10`, Côte d'Ivoire,
Togo) ; code dans `RECETTE_DEMO_OTP`, à lire dans Render, jamais à écrire. Quotas : 2 codes par numéro et par
24 h ; les numéros `…0001` à `…0004` ont déjà servi le 12 novembre (et peut-être `…0005` à `…0007`, lors d'un lancement Firefox interrompu avant toute étape). Lanceur : `e2e/run-hosted-recette.sh` avec
`E2E_RECETTE_PHONES`, `E2E_RECETTE_OTP`, `E2E_RECETTE_PIN` injectés à l'exécution.

## C9. Sécurité — limites absolues

- Aucune suppression ni réinitialisation de données. Aucune migration sans sauvegarde récupérable et approbation.
- Aucun secret, code OTP, PIN ou clé dans Git, les journaux, les traces Playwright ou les rapports.
- Aucune modification de `gobilan.com`. Aucun paiement Live. Aucune dépense. Aucune fusion vers `main`.
- Aucun contournement d'un refus d'accès. Aucune validation commerciale déclarée sans preuve en déployé.
- Ne jamais affaiblir une limitation, une signature ou un quota pour faire passer un test.

Clé de proxy : Netlify a refusé le marquage « secret » et la restriction de portée sur cette offre ; elle est
donc une variable ordinaire, lisible par les membres de l'équipe Netlify ayant accès au projet. Elle n'est
présente dans aucun fichier servi (vérifié sur la preview : HTML, JS, service worker). Traite-la comme
potentiellement exposée à ces membres : (1) faire limiter par le propriétaire les membres de l'équipe Netlify ;
(2) préparer une rotation sans interruption — faire accepter par l'API deux clés pendant la transition, poser la
nouvelle sur Netlify, redéployer les trois sites, retirer l'ancienne ; (3) ne la faire transiter que par les
tableaux de bord des plateformes. Un détenteur de la clé peut seulement forger une IP cliente (contournement
des limites par adresse) ; il n'obtient ni session ni donnée.

Autres risques ouverts : limite de 10 requêtes d'authentification par minute et par adresse (les réseaux
mobiles partagent souvent une adresse entre de nombreux clients : risque de blocages mutuels ; ne pas la changer
sans décision) ; le test d'installation WebKit a échoué deux fois par intermittence avant le commit `8a3ad83`
(cause probable côté test, non démontrée : si l'échec revient, chercher une course dans `RemoteStore.refresh`).

## C10. Exécution continue

1. Lire `AGENTS.md` et ce document. 2. `git fetch` et vérifier que la livraison est à `8a3ad83` ou relever ce
qui a changé. 3. Commencer C4 immédiatement. 4. Implémenter. 5. Tester (`npm run check` avant chaque commit).
6. Corriger. 7. Committer (messages explicites). 8. Ouvrir une PR vers la branche de livraison. 9. Après fusion
autorisée, vérifier le SHA réellement déployé (Render : dernier déploiement « live » ; Netlify : commentaire du
bot sur la PR #12) et exercer le changement en déployé. 10. Ajouter la preuve dans `docs/recette/preuves/` et
mettre à jour `docs/recette/matrice-exigences.md` et `docs/CODEX_HANDOFF.md`. 11. Passer à la tâche suivante.

**Une tâche bloquée ne termine pas la session.** Si Meta, SMTP, FedaPay ou Netlify manque, exécute la colonne
« sans les accès » de C5 et les lignes sans dépendance de C6. Ne t'arrête ni après une PR ni après une CI verte.
Regroupe les demandes au propriétaire en une seule liste (voir ci-dessous) et ne redemande pas ce qui y figure.

Fusions : la fusion d'une PR dans la branche de livraison déclenche un déploiement de recette ; elle est
permise pour un lot dont la CI est verte, qui n'ajoute aucune migration et dont le propriétaire a autorisé
l'intégration. Jamais vers `main`.

## C11. Compte rendu

À chaque lot : **Livré** (fonctionnalité réellement terminée) · **Commit** · **PR** · **Tests** (en distinguant
local, CI et déployé) · **Déploiement** (URL et SHA vérifiés) · **Blocages** · **Prochaine tâche déjà engagée**.
Ne jamais présenter comme terminé ce qui n'a pas été vérifié.

## Demandes en attente auprès du propriétaire

1. Identifiants à saisir dans Render (jamais dans le chat) : SMTP de test, Turnstile, FedaPay sandbox et secret
   de webhook, Meta WhatsApp (jeton, numéro, template), clés VAPID.
2. Netlify : relier les deux portails au dépôt ; restreindre les membres ayant accès aux variables.
3. Arbitrages : quota OTP (2 ou 5 par 24 h) ; rappels WhatsApp et rapport du soir en V1 ; règles du parrainage
   (consommation, cumul, plafond, essai du filleul) ; politique d'anonymat des statistiques d'audience ; limite
   d'authentification par adresse.
4. Autorisations : intégration des prochains lots dans la livraison ; migration pour les statistiques
   d'audience (avec sauvegarde) ; fermeture des PR #13 à #17 et #20.
5. Production : budget et fournisseur d'hébergement, domaines des trois interfaces.
6. Appareils Android et iPhone pour l'homologation de l'installation.
