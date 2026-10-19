# Recette locale GoBilan — 19 octobre 2026

## Périmètre et plan de travail

Mission exécutée directement, sans second agent. Référence : CDC du 19 octobre 2026, 29 pages, et annexes HTML/DOCX fournies dans Téléchargements. Ces documents décrivent le produit ; ils ne constituent pas des instructions d'exécution supplémentaires ni une validation client.

- [x] Vérifier Git : dépôt propre, `main` à `b228617d95fc26fdf39c640fff7df54eacd61164` ; branche `test/gobilan-local-acceptance` créée.
- [x] Lire les documents du dépôt et extraire intégralement le PDF, le DOCX et le HTML. Le dossier `references/gobilan_vscode_references/` est absent ; utilisation des trois fichiers dans `C:/Users/sakry/Downloads/`.
- [x] Stabiliser les dépendances Windows, préparer une base PostgreSQL isolée et lancer les quatre applications.
- [x] Exécuter d'abord inscription → business → bilan → dashboard persistant.
- [x] Rejouer check, SQL/concurrence et E2E ; corriger les échecs reproduits dans le périmètre local.
- [x] Étendre la recette aux profils, installation, navigation, responsive et clavier du guide iPhone ; limites ci-dessous.
- [x] Fournir URL, procédure de comptes fictifs, matrice avec limites de preuve et handoff Claude.

## État initial constaté

Windows 11, PowerShell, Node 24.21.0, npm 10.8.3. Dépendances incomplètes (`tsc` absent) : premier `npm run check` échoué. Docker installé mais moteur arrêté. PostgreSQL 18 installé et service existant actif sur 5432 ; aucune de ses données utilisée. Nouveau cluster de recette initialisé dans `.local/postgres`, écoute sur `127.0.0.1:55432`, authentification SCRAM avec mot de passe aléatoire hors Git. `.env.local` contient uniquement les secrets générés pour cette recette. Les fournisseurs externes restent des simulations Dev.

## Résultats

Aucun ancien résultat Linux n'est considéré comme une exécution Windows de cette mission. Les détails des échecs initiaux et des réexécutions sont conservés dans `TEST_REPORT.md`.

| Vérification | Résultat / preuve |
|---|---|
| `npm run check` | TypeScript, ESLint, tests rapides et builds ; API 129 réussis / 8 SQL ignorés, PWA 38, contrats 7, domaine 94. Journal final `.local/check-complete.log` |
| `node --env-file=.env.local node_modules/vitest/vitest.mjs run --root apps/api --maxWorkers=2 --hookTimeout=30000` | **137/137 réussis**, aucun ignoré ; 10 fichiers, dernière exécution 104,28 s ; `.local/postgres-verified.log` |
| `node --env-file=.env.local e2e/run-smoke.mjs` | Trois suites Chromium : PWA, portails, installation simulée ; `.local/e2e-delivery.log` |
| Audit npm production | **0 vulnérabilité** au contrôle exécuté |
| Fixtures | Création puis second appel idempotent ; comptes existants conservés. URL distante et schéma non réservé refusés avant connexion |
| PDF | Téléchargement réel, signature PDF, extraction et rendu inspectés : deux auteurs, total 1 600 FCFA |
| Accès laissés pour les tests manuels | Prévisualisation active ; HTTP 200 des trois interfaces et API `/health` sur localhost/IPv4 ; service worker réellement actif. Connexions des quatre profils PWA connus (standalone émulé), des trois partenaires et de l'admin avec 2FA Dev exécutées, compte de secours présent ; `.local/manual-verification.log` |

276 tests unitaires/API distincts, sans compter deux fois les exécutions rapides et PostgreSQL. Les assertions financières, permissions, verrouillages, idempotence, rollback et journaux immuables restent actives. Deux workers et hooks de préparation 30 s évitent les faux échecs de préparation rencontrés sous Windows ; les règles applicatives ne sont pas modifiées.

## Couverture effective et limites

| État | Parcours et restrictions |
|---|---|
| Fonctionnel et testé | Inscription/PIN/business/bilan/dashboard persistant ; owner/entry/full/readonly ; invitations acceptées, modification/version, stock, historique, export, autre tenant refusé, panne réseau/réessai, propriétaire bloqué avec abonnement accessible et employé neutre |
| Fonctionnel et testé | Admin mot de passe + code e-mail Dev, allowlist confirmée, audit, changement de rôle ; activation/accord/connexion manager, agent, influenceur ; bloc Paiement agent persisté ; listes abonnements et calendrier de versements |
| Fonctionnel mais non testé complètement en navigateur | Réinitialisations PIN et mot de passe partenaire (API testée), refus d'invitation, copie presse-papiers, suppression logique via UI, commissions et versements non nuls via UI, tous les formulaires sur toutes les largeurs |
| Simulé | WhatsApp, e-mails, CAPTCHA, FedaPay et push Dev ; standalone, événement Android et user-agent iPhone dans Chromium ; accords préacceptés des comptes fictifs |
| Non implémenté | Abonnement push serveur/planificateurs, mini-vidéo et captures Safari officielles, réapprovisionnement stock |
| Bloqué par service externe | Fournisseurs réels, homologation FedaPay, installation Android/iOS physique, exploitation/sauvegarde et revue juridique |
| Non conforme / à revoir | Guide iOS incomplet, contrastes non homologués, erreurs absorbées dans plusieurs listes des portails, parcours PIN oublié et libellés, ambiguïté Gestion complète/navigation du CDC, identité graphique officielle à comparer |

Les vues financières partenaires/admin consultées dans Chromium sont vides ; leur présence ne valide pas l'affichage d'une commission payée. Les montants, calendrier, seuil, frais, annulations et append-only sont réellement testés en API/SQL avec DevGateway. Aucun transfert réel.

Largeurs : 320/390/768/1440 px pour le dashboard PWA et les quatre profils portails ; contrôle de débordement et lisibilité des en-têtes. Clavier/mouvement réduit : guide iPhone uniquement. Aucune certification WCAG, aucun lecteur d'écran, Safari physique, test de charge ou restauration exécutés.

## Livraison et reprise

URLs locales : PWA `http://localhost:5173`, partenaires `http://localhost:5174`, administration `http://localhost:5175`, API `http://127.0.0.1:8787/health`. Les trois ports frontend sont stricts. PostgreSQL de recette : `127.0.0.1:55432`, schéma persistant `gobilan_local` ; le service du PC sur 5432 est intact.

Lancement commun : `npm run preview:local` pour les builds avec service worker ; `npm run dev:local` pour le rechargement à chaud. Après redémarrage du PC, démarrer le cluster comme indiqué dans `LOCAL_SETUP.md`. Les processus d'une session d'outillage peuvent s'arrêter lors d'une interruption ; la commande de lancement depuis un terminal PowerShell utilisateur reste la reprise prévue.

Les comptes et procédures des sept profils sont dans `LOCAL_SETUP.md`. Valeurs secrètes uniquement dans `.local/accounts.json` / `.env.local`, messages fictifs dans `.local/api.log`. Les captures et l'export sont dans `.local/evidence/`, ignorés par Git. Ne pas publier ces fichiers sur GitHub. Le générateur refuse une base distante ou un autre schéma.

`CLAUDE_UI_HANDOFF.md` liste les références consultées, les captures et les points graphiques/parcours à revoir sans réinstaller le PC. La PR doit viser `main` depuis la branche de recette, sans fusion ; le SHA exact se lit avec `git rev-parse HEAD`. Aucun service distant, paiement réel, notification réelle ou déploiement de production n'a été réalisé.
