# GoBilan — reprise Claude Fable 5.2

> **Document historique — ne pas exécuter.** Cet état est dépassé : les PR #21, #19, #18 et #22 sont fusionnées dans
> `fix/gobilan-livraison-15-novembre` (`8a3ad83`), SEC-48 et le correctif du limiteur de débit sont en place.
> Reprise à suivre : [`CODEX_REPRISE_APRES_CLAUDE_2026-11-12.md`](CODEX_REPRISE_APRES_CLAUDE_2026-11-12.md).

Tu prends la responsabilité technique de la livraison de la V1 commerciale de GoBilan au client le **15 novembre 2026**. La démo constitue une preuve intermédiaire. Le verdict actuel est **NO-GO commercial**. Reprends les tâches ci-dessous, code et teste. Évite de recommencer un audit général.

## Point de reprise GitHub

Dépôt `Monoru1/bilango`. Dernier état vérifié le 12 novembre 2026. Fais un `git fetch`, vérifie les refs et préserve tout travail arrivé depuis.

| Branche | HEAD vérifié | État |
|---|---|---|
| `main` | `871824c827a3215d5d7df1ef4be9edf9e7ed0289` | Branche principale |
| `fix/gobilan-livraison-15-novembre` | `13d63a0e2084e3e4c7d5d858b8f520112a5584c8` | Branche de recette déployée |
| `fix/gobilan-pwa-recette` | `b571b4def4406ffc77c940c1c9020e4bd0169afb` | #13, parcours PWA |
| `fix/gobilan-proxy-security` | `23e2bcba148f182b9b78dbd7f752a95e3c64fd97` | #14, proxy IP |
| `feat/gobilan-otp-policy` | `b5996d723ef8de750fc28f2dcbe2e1454db661c4` | #15, politique OTP, descend de #14 |
| `feat/gobilan-portails-recette` | `342031bd4b131eba32cacd9d63c18ae2b2806083` | #16, portails, descend de #14 |
| `feat/gobilan-admin-referral-codes` | `10e8ff4f9b388c733c75be186702643d996d1ef4` | #17, REC-13 |
| `integration/gobilan-15-novembre` | `c4877d85deedd175bcf3f2cadeec384a54d34045` | #18, combine #14, #15, #16, #17, #13 une seule fois |
| `feat/gobilan-v1-recette-admin` | `e529b61f454b69111edab136682d43c4732a40f2` | #19, descend de #18. **Base de travail à reprendre** |
| `infra/render-recette-blueprint` | `ca5a3a8ab22bfae507871943350aa84cebd636a1` | Blueprint de recette |

Les PR #13 à #19 sont ouvertes et non fusionnées. #13 à #18 ciblent la livraison, #19 cible l’intégration. Après autorisation explicite, intégrer #19 vers la branche temporaire, vérifier sa CI, puis intégrer #18 vers la livraison. Les cinq changements sont déjà repris par #18. La PR de documentation s’applique séparément et peut nécessiter de conserver les deux versions des notes.

## Acquis et preuves

Claude avait livré le mode recette Render isolé, l’OTP fictif à liste fermée et expiration, la garde des migrations, la preview PWA, les premières preuves HTTP et une correction de concurrence dans la lecture des e-mails simulés Playwright. Voir `c7894fd`, `35a6975`, `7b359a0`, `13d63a0`.

Codex a ajouté le proxy Edge HMAC et les quotas directs séparés, la politique OTP paramétrable, le mode Playwright hébergé et son lanceur masqué, les deux configurations Netlify, REC-13 et l’export CSV filtré avec protection contre les formules. Préserve ces acquis. La #18 a 397 tests de check et 229 PostgreSQL réussis, six jobs verts. La #19 a les mêmes totaux et six jobs verts. Les trois navigateurs, le conteneur, la concurrence et la restauration ont tourné avec des données de test isolées. Voir [CI #18](https://github.com/Monoru1/bilango/actions/runs/43207568980) et [CI #19](https://github.com/Monoru1/bilango/actions/runs/43208081346). Le détail par SHA figure dans `docs/CODEX_HANDOFF.md` sur la branche de passation.

## Ordre d’exécution

| Priorité | Action, fichiers et preuve attendue |
|---|---|
| P0 · immédiatement | Récupère #19, vérifie `git rev-parse HEAD`, ouvre `apps/api/test/client-ip.test.ts`. Lance `npm ci` puis `npm run test -w @gobilan/api -- test/client-ip.test.ts test/auth.test.ts test/http.test.ts test/tenant.test.ts`. Attendu : 60 tests verts sur ce SHA, IP vérifiée exclusivement via la preuve, quota distinct sans preuve, isolation inter-business et admin. Corrige uniquement un défaut démontré dans `netlify/edge-functions/api-client-ip.js`, `apps/api/src/http/{client-ip,app}.ts` ou le service concerné. |
| P0 · après autorisation d’intégration | Vérifie les références déployées puis configure la signature ensemble sur Edge et Render. Contrôle les réponses et quotas sur la recette autorisée, avec journal expurgé et sans données client. Vérifie la garde des migrations, les origines exactes et le retour au dernier SHA connu. Fichiers : `docs/SECURITY_MODEL.md`, `apps/api/src/runtime-config.ts`, `apps/api/src/recette-migration-guard.ts`. |
| P0 · identifiants et portails | Raccorde deux sites Netlify distincts selon `docs/recette/portails-netlify.md` et `apps/{admin,partners}/netlify.toml`. Configure les origines exactes. Lance `bash e2e/run-hosted-recette.sh` avec trois comptes fictifs, puis consigne OTP/PIN, business, invitation, rôles, bilan, caisse, stock, historique, édition, PDF, abonnement et reconnexion. Vérifie sur les deux portails l’activation et la 2FA SMTP, les refus sans session et le cloisonnement des audiences. |
| P0 · fournisseurs et données | Vérifie Meta OTP, SMTP, Turnstile, FedaPay sandbox et Web Push en recette avec destinataires autorisés. Utilise `apps/api/src/integrations/{configured,acceptance}.ts`, `services/{subscriptions,push,jobs}.ts` et les tests associés. Exige une preuve fournisseur de livraison et du paiement sandbox confirmé par webhook, avec renouvellement et idempotence. Teste une restauration hors hôte isolée avant mise en service. |
| P1 · indépendante, à faire pendant les attentes P0 | Implémente la désactivation auditée SEC-48 dans `apps/api/src/services/admin.ts`, `http/app.ts`, `apps/admin/src/Operations.tsx`. Session admin, CSRF, motif obligatoire, transaction atomique, ancienne attribution préservée et aucune nouvelle attribution sur code inactif. Tests `http.test.ts`, `owner-referrals.test.ts` et `e2e/portals-smoke.mjs`, avec concurrence et journal vérifiés. |
| P1 · après arbitrages | Applique la décision sur les 30 jours sans double récompense ou commission. Complète les rappels et le rapport du soir avec consentement, fuseau IANA et idempotence selon la v1.2. Termine statistiques d’audience et exports avec données autorisées et sans toucher à `gobilan.com`. Utilise `services/{owner-referrals,subscriptions,admin,jobs}.ts` et les interfaces correspondantes. Vérifie REC-01 à REC-14, dont REC-14 selon la politique approuvée. |
| P2 · remise | Mets à jour `docs/recette/{matrice-exigences,livraison-15-novembre}.md` et `docs/CODEX_HANDOFF.md`. Ajoute guides, contrôle sur Android et iPhone physiques, supervision, sauvegarde hors hôte, procédure de retour arrière et preuves par SHA, environnement, scénario et résultat. Le GO exige la validation réelle des flux commerciaux applicables. |

## Déploiement et configuration

Render gratuit `gobilan-recette-api`, service `srv-dbospsm7bikc73a67l5g`, suit la branche de livraison. Dernier déploiement live vérifié `dep-dbqos559el5s73f63pv0` sur `13d63a0`. API `https://gobilan-recette-api.onrender.com`. Base privée `gobilan-recette`, PostgreSQL 17 gratuit à Francfort, expiration le 9 décembre 2026. Les preuves historiques montrent les migrations 001–007 et une relecture après redémarrage. Recontrôle la version du schéma en lecture seule avant changement. Netlify `gobilan-pwa`, preview `https://deploy-preview-12--gobilan-pwa.netlify.app`, déploiement `6af58e17c8071a67fd1deded` sur `13d63a0`. Le site Netlify public `https://gobilan-pwa.netlify.app` sert `871824c` (`main`). Le projet admin et le projet partenaires restent à raccorder. WhatsApp OTP simulé, paiements désactivés et proxy HMAC absent du SHA déployé.

Noms de variables uniquement. Render : `DATABASE_URL`, `NODE_ENV`, `RENDER_RECETTE`, `SECURE_COOKIES`, `PWA_ORIGIN`, `PARTNERS_ORIGIN`, `ADMIN_ORIGIN`, `PROVIDER_MODE`, `GOBILAN_PROXY_KEY_HEX`, `GOBILAN_WHATSAPP_OTP_POLICY`, `RECETTE_MIGRATION_APPROVED_UP_TO`. Netlify : `API_ORIGIN`, `GOBILAN_EDGE_API_ORIGIN`, `GOBILAN_PROXY_KEY_HEX` côté Edge. Recette hébergée : `E2E_RECETTE_URL`, `E2E_RECETTE_PHONES`, `E2E_RECETTE_OTP`, `E2E_RECETTE_PIN`. Fournisseurs : noms et garde-fous dans `.env.providers.example`. Les OTP fictifs historiques sont limités dans le temps.

## Autorisations et décisions

Aucune suppression de données, migration sans sauvegarde restaurable et autorisation, fuite de secret, paiement réel, dépense, fusion vers `main`, modification de `gobilan.com` ou contournement de contrôle d’accès. Fusion vers la recette, déploiement contrôlé, fournisseurs Live et budget nécessitent chacun l’accord applicable. Les tests de sécurité restent défensifs et utilisent une recette autorisée ou des fixtures isolées.

Regroupe en une demande les accès Meta, SMTP, Turnstile, FedaPay sandbox et VAPID, la session Netlify, les domaines et origines, les secrets à injecter hors Git, les arbitrages v1.2, le devis exact d’hébergement et les appareils physiques. Le CDC du 19 octobre, la v1.2 du 1er novembre, l’issue #8 et `docs/decisions/contradictions-cdc.md` sont les références. L’issue #8 affiche encore l’ancien calendrier. L’instruction actuelle fixe la V1 finale au 15 novembre. Les arbitrages non écrits restent ouverts.

Commence par le P0 local, puis poursuis SEC-48 et tout lot indépendant si un accès manque. Fais des commits ciblés et des PR, teste chaque SHA, vérifie les déploiements autorisés et laisse une preuve exploitable à chaque étape.
