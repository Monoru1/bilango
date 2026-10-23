# Rapport de validation — 19 octobre 2026

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


## Complément — notifications Web Push et ordonnanceur (23 octobre 2026, branche feat/gobilan-claude-v1)

Node 22.22.0, PostgreSQL 16 local (127.0.0.1:55432). Transport push et passerelle de paiement : Dev uniquement, aucun envoi réel.

| Vérification | Résultat |
|---|---|
| npm run check (code de sortie lu directement) | **0** : API 155 réussis + 8 ignorés (dernier run complet de l’API), PWA 45, contrats 7, domaine 94 ; builds des quatre applications |
| TEST_DATABASE_URL=… npm run test:postgres -w @gobilan/api | **159/159**, 0 schéma résiduel |
| Nouveaux tests | 22 dans apps/api/test/push.test.ts, 7 dans RemoteStore.test.ts |
| CHROMIUM=/opt/pw-browsers/chromium E2E_DATABASE_URL=… npm run test:e2e | **exit 0**, deux suites navigateur (PWA + partenaires/admin) ; le Chromium préinstallé est utilisé car la version téléchargeable par Playwright n'est pas disponible |
| Audit npm | **non rejoué** depuis ces changements |

Non couvert : transport web-push/VAPID réel, navigateur et téléphones physiques.
