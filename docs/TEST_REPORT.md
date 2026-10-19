# Rapport de validation — recette Windows du 19 octobre 2026

## Environnement et portée actuels

Branche `test/gobilan-local-acceptance`, base `b228617d95fc26fdf39c640fff7df54eacd61164`. Windows 11, PowerShell, Node 24.21.0, npm 10.8.3, PostgreSQL réseau 18 dans un cluster isolé sur `127.0.0.1:55432`, Playwright 1.64.1 et Chromium 156.0.8078.4 headless. Aucun service distant modifié, aucun paiement/envoi réel. Les versions npm proviennent du lockfile ; Chromium est téléchargé depuis le CDN officiel Playwright.

Les fournisseurs WhatsApp/e-mail/CAPTCHA/paiement/push sont Dev. Les user-agents Android/iPhone et le signal standalone sont **émulés**. Ce rapport ne valide ni des appareils physiques, ni Safari/WebKit, ni un fournisseur externe, ni la production.

## Commandes et preuves de recette

Les résultats définitifs et les commandes de livraison sont également consignés dans `LOCAL_ACCEPTANCE_REPORT.md`. Journaux de cette session hors Git :

| Contrôle | Preuve locale |
|---|---|
| Installation verrouillée depuis npm officiel | `npm ci --registry=https://registry.npmjs.org --cache .local/npm-cache --no-audit --no-fund` : 365 paquets installés |
| TypeScript, lint, tests rapides et builds | `.local/check-complete.log` : commande `npm run check`, code 0 ; API 129 réussis et 8 réservés à PostgreSQL ignorés, PWA 38, contrats 7, domaine 94 |
| PostgreSQL réseau | `.local/postgres-verified.log`, **137/137 réussis**, aucun ignoré, deux workers et hooks SQL 30 s, 104,28 s |
| Chromium | `.local/e2e-delivery.log`, trois suites métier/installation réussies, code 0 |
| Comptes et services laissés à la recette manuelle | `.local/manual-verification.log`, HTTP 200 sur les trois interfaces et `/health` (localhost et IPv4), contrôleur service worker actif dans la prévisualisation, connexions PIN des quatre profils PWA connus (standalone émulé), trois partenaires, admin avec 2FA Dev et secours présent |
| Audit des dépendances de production | `npm audit --omit=dev --audit-level=high --registry=https://registry.npmjs.org --cache .local/npm-cache` : **0 vulnérabilité** au contrôle exécuté |
| Fixtures persistantes | `npm run seed:local` exécuté deux fois : création puis conservation des comptes existants ; URL distante et schéma non réservé refusés avant connexion |

Le check rapide compte 268 tests exécutés, huit ignorés. La validation PostgreSQL complète contient 137 tests API, dont les huit de concurrence/SQL. Le total distinct reste **276** avec les 139 tests PWA/contrats/domaine ; ne pas additionner les réexécutions. Les workspaces admin/partners/UI n'ont pas de tests unitaires propres ; leurs interfaces sont couvertes par les E2E.

## Échecs rencontrés et traitement

- Dépendances initiales incomplètes : `tsc` absent ; premier `npm ci` confiné échoué sur le cache npm. Installation officielle exécutée avec l'approbation technique de l'outil, sans modifier les versions du lockfile.
- Premier E2E : API non prête dans le délai, puis Chromium build 1248 absent. Le démarrage a ensuite été reproduit ; navigateur requis installé officiellement.
- Tests SQL/PGlite : initialisation simultanée de dix schémas/moteurs, puis dépassement ponctuel du hook de dix secondes même à deux workers (136/137). Concurrence limitée à deux workers et délai de préparation porté à trente secondes ; aucune assertion métier ni délai de sécurité applicatif modifié.
- Agent à 320px : code promo long débordant ; en-tête comprimé. Correction des retours à la ligne et grille d'en-tête mobile. Régression mesurée sur les quatre profils portails à 320/390/768/1440px, y compris la hauteur du titre.
- Guide iPhone : test clavier échoué sur focus initial. Correction focus/Tab/Échap/restauration, puis scénario réellement exécuté avec succès dans Chromium.
- Un lancement de contrôle a été interrompu par la reprise de conversation ; il n'est pas compté comme réussi. Les validations de livraison sont relancées et leurs limites consignées.

## Parcours navigateur de cette recette

- PWA : OTP Dev → PIN → profil → business → article de stock → bilan → rechargement et dashboard persistant. Deux auteurs, modification employé de 400 à 600, version originale conservée et total 1 600 FCFA.
- Permissions : saisie seule filtrée serveur, gestion complète avec historique autorisé, lecture seule sans envoi, autre compte 404, cookie httpOnly/SameSite, panne API interceptée puis réessai, abonnement expiré injecté uniquement dans le schéma E2E (propriétaire/ employé).
- Export : PDF réellement téléchargé, signature `%PDF-`, texte extrait et rendu visuel inspecté ; une page avec deux auteurs, total 1 600 FCFA, sans stockage serveur.
- Partenaires : manager créé par admin, accord/activation et lien non rejouable, agent créé par manager puis activé/reconnecté, influenceur créé par admin puis activé/reconnecté ; bloc Paiement agent enregistré et relu sans OTP.
- Administration : mot de passe puis code e-mail Dev, ajout allowlist après confirmation et audit, transition de rôle auditée, abonnements persistants et calendrier de versements consultés ; cookie partenaire refusé sur API admin.
- Installation : inscription masquée hors standalone, lien légal public, événement Android simulé, guide iPhone à quatre étapes, mouvement réduit, focus contenu et restauré, fermeture Échap, navigateur intégré bloqué.

## Limites et inspection manuelle

Captures/PDF conservés uniquement dans `.local/evidence/`, détaillés dans `CLAUDE_UI_HANDOFF.md`. Les références HTML ont été comparées visuellement au dashboard et aux captures des portails ; aucune conformité pixel par pixel ni validation client revendiquée.

Les tableaux de commissions/versements non nuls ne sont pas exercés en navigateur : logique financière, frais, seuil, calendrier, idempotence, append-only et annulations sont testés en API/SQL avec DevGateway. Installation physique, vrais push/OTP/e-mails, FedaPay externe, restauration, charge, lecteur d'écran et audit WCAG complet non exécutés. Réinitialisations PIN/partenaire couvertes en API mais parcours navigateur complet encore à revoir. Les erreurs silencieuses de plusieurs lectures des portails et les ambiguïtés de navigation restent ouvertes dans le handoff.

Le résultat distant GitHub Actions doit être consulté sur la PR ; il n'est pas déduit des résultats locaux. Aucun merge ni déploiement.

---

# Historique antérieur — validation Linux de l'intégration

Les résultats ci-dessous sont conservés comme historique ; ils ne décrivent pas l'environnement Windows de cette livraison.

## Référence et environnement

Base Claude : d68acd112f28e4edf8c59a5598f464b4967acd8a, branche feat/gobilan-pwa-foundation. Intégration : feat/gobilan-codex-integration. Aucune validation client ni production déduite de ces résultats.

Exécution locale sous Linux, Node 24.19.0. PostgreSQL **réseau natif 18.4**, via le pilote pg et un pool de dix connexions, avec schémas isolés par test. Le conteneur ne mappe que l'UID 0 : le lancement local du binaire PostgreSQL a nécessité un shim d'identité OS réservé à ce conteneur ; aucun comportement SQL n'a été remplacé ou simulé. Les jobs CI utilisent PostgreSQL 17 standard, sans ce shim. PGlite sert séparément aux tests rapides.

Chromium 153 headless ; viewport mobile 390×844 et portails 1100×900. Le signal standalone est émulé : cela ne prouve pas une installation Android/iPhone physique. Les fournisseurs WhatsApp/e-mail/CAPTCHA/paiement/push sont Dev ; aucun envoi ou mouvement d'argent externe.

## Commandes exécutées

| Vérification | Résultat |
|---|---|
| npm ci sur la fondation | réussi |
| npm run check sur la fondation | réussi : API 110, PWA 32, contrats 7, domaine 94 |
| npm run check après intégration | réussi : TypeScript, ESLint, tests et builds des quatre applications |
| Tests API rapides | **129 réussis, 8 réservés à PostgreSQL ignorés** |
| Tests PWA | **38 réussis** |
| Tests contrats | **7 réussis** |
| Tests domaine | **94 réussis** |
| TEST_DATABASE_URL=… npm run test:postgres -w @gobilan/api | **137 réussis**, aucun ignoré |
| E2E_DATABASE_URL=… npm run test:e2e | deux suites navigateur réussies : PWA + partenaires/admin |
| npm audit --omit=dev --audit-level=high | réussi, **0 vulnérabilité** au contrôle local |
| git diff --check | réussi |

276 scénarios unitaires/API distincts (137 API + 139 autres), dont 268 dans le check rapide et 8 validations de concurrence/SQL réservées au PostgreSQL réseau. L'exécution PostgreSQL rejoue aussi les tests API rapides : il ne faut pas compter deux fois ces scénarios.

## Parcours navigateur effectivement exécutés

1. Inscription par code Dev → création PIN → nom → business avec stock → premier bilan enregistré dans PostgreSQL.
2. Rechargement navigateur : session et dashboard restaurés depuis l'API, sans persona ni données de démo.
3. Création et renommage d'un rôle → invitation → inscription de l'employé → acceptation → saisie autorisée.
4. Modification du bilan employé → version originale conservée en SQL → dashboard propriétaire agrégé (1000 + 600 = 1600 FCFA).
5. Vérification du payload employé : son bilan seulement, aucune équipe complète ni historique financier du propriétaire.
6. Export PDF téléchargé : signature PDF, extraction texte et rendu visuel contrôlés ; auteurs et total 1600 FCFA présents.
7. Coupure des requêtes API dans Chromium → disparition de l'écran financier → Réessayer → chargement rétabli.
8. Autre utilisateur → workspace du business visé → 404.
9. Expiration injectée sur la base de test → propriétaire bloqué mais abonnement accessible ; employé en pause avec texte neutre et aucun bouton paiement.
10. Connexion admin mot de passe + code e-mail Dev → création manager → activation partenaire et accord → création agent ; lien d'activation non réutilisable.
11. Session partenaire refusée sur l'API admin ; aucun téléphone de commerçant visible dans le portail.
12. Ajout d'un administrateur de secours après confirmation e-mail, action visible dans l'audit.
13. Changement d'un partenaire sans obligations vers influenceur, action visible dans l'audit.
14. Aucune erreur JavaScript dans les pages des deux suites.

## PostgreSQL, sécurité et concurrence effectivement exécutés

- Toutes les suites API utilisent de vrais schémas SQL migrés sur PostgreSQL, nettoyés après chaque test. Migrations idempotentes.
- Bilans idempotents, versions immuables, stock limité ; deux ventes concurrentes du dernier article n'en enregistrent qu'une.
- Échec forcé de l'insertion de version : rollback du bilan et de la caisse initiale ensemble.
- Une seule période d'essai sur créations concurrentes d'un compte.
- Quotas OTP communs à un appareil ou une IP sur plusieurs numéros concurrents ; blocage PIN serveur.
- Signature webhook, identité exacte transaction, montant/mode/business, relecture passerelle, rejeux et confirmations concurrentes.
- Commissions, seuil, calendrier, annulations, journal append-only et interdiction des doubles versements.
- Admin : code lié au challenge, confirmation liée au demandeur, usage unique, minimum deux adresses, révocation immédiate.
- Coordonnées Mobile Money : correction et audit atomiques ; absence de données personnelles en clair dans l'audit.
- Édition/archivage des rôles, refus d'archiver un rôle affecté/invité, et concurrence archivage/invitation.
- Changement rôle partenaire : sessions coupées, accord requis, obligations existantes conservées ; concurrence avec enregistrement d'un agent.
- X-Forwarded-For client non cru, CSRF/Origin et séparation des audiences.
- Après blocage, les écritures de stock sont aussi refusées.

## Limites de preuve

Paiement confirmé, commission et versement sont exécutés au niveau API/SQL avec DevGateway et messages Dev, pas via un compte FedaPay sandbox externe. Aucun checkout fournisseur réel dans le navigateur. Ni iOS Safari physique, ni installation Android réelle, ni réception de notification, ni délivrabilité SMTP/WhatsApp testées. Aucun test de charge, pentest ou restauration de sauvegarde effectué. Les trois jobs GitHub Actions sont configurés ; leur résultat distant doit être lu sur la PR, sans l'inférer des résultats locaux.
