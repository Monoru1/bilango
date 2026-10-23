# GoBilan — monorepo PWA

PWA utilisateurs, portail partenaires, administration et API partagée pour le CDC du 19 octobre 2026.

| Package | Rôle |
|---|---|
| apps/pwa | PWA propriétaire/employé ; client HTTP par défaut, démo explicite |
| apps/partners | Portail partenaires, API réelle |
| apps/admin | Administration, API réelle, 2FA et confirmations de l'allowlist |
| apps/api | Fastify + PostgreSQL ; PGlite optionnel en développement |
| packages/domain | Règles métier pures |
| packages/contracts | Contrats et validation Zod |
| packages/ui | Tokens, composants et textes légaux |
| legacy/expo-app | Ancien prototype Expo, conservé en référence |

## Installation et validation

Node.js 22 ou plus récent, npm et, pour les validations SQL/E2E, une base PostgreSQL de développement dédiée.

```bash
npm ci
npm run check
```

`check` vérifie TypeScript, ESLint, tests rapides et builds. Les scénarios de concurrence SQL sont réservés au vrai PostgreSQL :

```bash
TEST_DATABASE_URL=postgresql://user:password@localhost:5432/gobilan_test npm run test:postgres -w @gobilan/api
npx playwright install chromium
E2E_DATABASE_URL=postgresql://user:password@localhost:5432/gobilan_e2e npm run test:e2e
```

Les tests PostgreSQL et E2E créent leur propre schéma aléatoire, puis suppriment uniquement ce schéma. Le compte doit pouvoir créer des schémas. Utiliser une base de test, jamais une base de production. Les E2E lancent eux-mêmes les quatre applications, génèrent les secrets de test, exécutent les parcours et arrêtent les processus. Ports 5173, 5174, 5175 et 8787 requis libres. CHROMIUM permet de fournir un exécutable local si nécessaire.

## Lancer le développement

Variables serveur nécessaires : PIN_PEPPER_HEX (au moins 32 octets), PAYOUT_KEY_HEX (32 octets), FEDAPAY_WEBHOOK_SECRET. DATABASE_URL choisit une base PostgreSQL persistante ; sans cette variable, PGlite est éphémère et les données disparaissent au redémarrage.

Exemple PowerShell dans le terminal de l'API :

```powershell
$env:PIN_PEPPER_HEX = node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
$env:PAYOUT_KEY_HEX = node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
$env:FEDAPAY_WEBHOOK_SECRET = node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
$env:DATABASE_URL = 'postgresql://user:password@localhost:5432/gobilan_dev'
npm run dev:api
```

Variables facultatives : VAPID_PUBLIC_KEY (clé publique Web Push ; sans elle, GET /v1/push/config répond enabled=false et la PWA n'abonne personne) et SCHEDULER=0 pour désactiver l'ordonnanceur en processus (rappels quotidiens, expiration J-3..J-1, rapprochement FedaPay horaire). Le transport push du serveur de développement ne contacte aucun service : il journalise seulement le type de notification.

Pour conserver une base de développement, conserver aussi les mêmes secrets hors dépôt : les changer invalide les hachages/chiffrements existants. Le serveur applique les migrations non encore présentes dans cette base de développement. La CLI migrate applique aussi les migrations ; ne pas la lancer sur une base réelle sans revue.

Dans trois autres terminaux :

```bash
npm run dev:pwa
npm run dev:partners
npm run dev:admin
```

PWA : http://localhost:5173 ; partenaires : http://localhost:5174 ; admin : http://localhost:5175. L'installation standalone est exigée pour la PWA ; les E2E émulent uniquement ce signal d'affichage, pas une installation physique.

Pour amorcer un administrateur Dev, renseigner DEV_SEED_ADMIN_EMAIL et DEV_SEED_ADMIN_PASSWORD au démarrage. Ajouter ensuite une seconde adresse depuis l'onglet Administrateurs, avec le code de confirmation e-mail Dev.

## Démo et fournisseurs

`?demo=1` ouvre les données locales clairement marquées DÉMO. `?demo=0` revient au client HTTP. Construire avec VITE_ALLOW_DEMO_BYPASS=0 supprime cet accès démo. Aucune panne réseau ne bascule automatiquement en démo.

Les fournisseurs externes restent **simulés** : OTP WhatsApp et e-mails dans la console API, CAPTCHA Dev, DevGateway et push de test. Le mode HTTP ne propose pas de faux bouton de paiement réel. Le serveur refuse NODE_ENV=production.

Voir docs/TEST_REPORT.md pour les validations exécutées, docs/REQUIREMENTS_MATRIX.md pour les écarts, docs/DEPLOYMENT_READINESS.md pour les blocages de lancement, et docs/CODEX_HANDOFF.md pour la reprise.
