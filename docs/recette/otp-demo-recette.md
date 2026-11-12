# OTP de démonstration — recette Render (TEMPORAIRE)

Statut : mécanisme provisoire pour la démonstration du 15 novembre 2026. Il **ne remplace pas**
l'OTP WhatsApp Meta exigé pour la V1 et doit être retiré (variables supprimées) dès que
`PROVIDER_MODE=configured` est validé. Aucun message WhatsApp n'est envoyé : l'interface affiche
« DÉMO — WhatsApp simulé ».

## Fonctionnement

- Code : `apps/api/src/recette-demo-otp.ts`, branché dans `server.ts` et `services/auth.ts`.
- Actif uniquement si `RENDER_RECETTE=true`, `NODE_ENV` ≠ `production`, `DATABASE_URL` = base
  dédiée `gobilan-recette` et `PROVIDER_MODE` ≠ `configured`.
- Toute variable `RECETTE_DEMO_*` présente hors de ces conditions **bloque le démarrage**
  (`recette_demo_otp_forbidden`) : impossible à activer en production.
- Les numéros de `RECETTE_DEMO_PHONES` reçoivent le code `RECETTE_DEMO_OTP` jusqu'à
  `RECETTE_DEMO_OTP_EXPIRES_AT`. Tout autre numéro est refusé (HTTP 403, message explicite),
  sans code émis ni compté.
- Le code passe par le circuit normal `otp_codes` : demande préalable obligatoire, expiration
  10 min, 4 essais, usage unique, quotas par numéro / appareil / IP, CAPTCHA et limitation de débit.
- Aucun endpoint ne restitue le code ou la liste. `/v1/auth/config` expose seulement
  `demo.whatsappSimulated`.
- Journaux en recette : `[RECETTE WHATSAPP] simulé (non envoyé)` et `[RECETTE EMAIL] simulé (non
  envoyé)`, sans code, numéro, destinataire ni corps de message.

## Variables Render (service `gobilan-recette-api`) — à saisir dans le dashboard, jamais dans Git

| Variable | Valeur |
|---|---|
| `NODE_ENV` | `recette` |
| `RENDER_RECETTE` | `true` |
| `API_HOST` | `0.0.0.0` |
| `SECURE_COOKIES` | `true` |
| `DATABASE_URL` | URL **interne** de `gobilan-recette` |
| `PWA_ORIGIN` | `https://gobilan-pwa.netlify.app` (ou l'origine exacte de la preview utilisée) |
| `PARTNERS_ORIGIN`, `ADMIN_ORIGIN` | origines HTTPS exactes et distinctes |
| `PIN_PEPPER_HEX`, `PAYOUT_KEY_HEX`, `FEDAPAY_WEBHOOK_SECRET` | secrets existants ; ne pas régénérer si des données existent |
| `RECETTE_DEMO_PHONES` | numéros fictifs E.164 séparés par des virgules (20 max ; +229, +228, +225) |
| `RECETTE_DEMO_OTP` | 4 chiffres, non triviaux (ni `0000`, ni suite) |
| `RECETTE_DEMO_OTP_EXPIRES_AT` | date ISO avec fuseau, 31 jours maximum ; ex. `2026-11-16T22:00:00Z` |

Ne pas définir `PRODUCTION_RELEASE_APPROVED`, `PROVIDER_MODE`, `EXTERNAL_DELIVERY_ENABLED`,
`EXTERNAL_PAYMENTS_ENABLED`. Health check Render : `/health`.

Une seule origine PWA est acceptée par l'API : la démonstration doit donc se faire depuis
l'URL exacte déclarée dans `PWA_ORIGIN`.

## Garde des migrations (recette)

Au démarrage en mode recette, `apps/api/src/recette-migration-guard.ts` inspecte la base en
lecture seule et journalise uniquement des compteurs (`[recette] base : tables=… decision=…`).
Les migrations ne partent que si la base est vide (`initialize`), déjà à jour (`up_to_date`), ou
si les migrations en attente ont été approuvées après sauvegarde avec
`RECETTE_MIGRATION_APPROVED_UP_TO=<dernier fichier en attente>` (`approved`). Sinon le démarrage
est refusé (`recette_database_not_empty_backup_required`) sans aucune écriture.

## Révocation

- Retirer un numéro de `RECETTE_DEMO_PHONES`, ou avancer `RECETTE_DEMO_OTP_EXPIRES_AT`, puis
  redéployer : plus aucun code n'est émis pour ce numéro.
- Changer `RECETTE_DEMO_OTP` invalide l'ancien code pour toute nouvelle demande.
- Les sessions déjà ouvertes restent valides jusqu'à leur révocation (déconnexion, ou
  suppression des lignes de session du compte dans la base de recette).
- Les comptes de démonstration n'existent que dans la base `gobilan-recette`, sans donnée réelle.

## Limites connues

- Le quota OTP par numéro (2 ou 5 par 24 h selon l'arbitrage CDC / v1.2 en attente) s'applique
  aussi aux comptes de démonstration : prévoir assez de numéros fictifs pour répéter le parcours.
- Les e-mails (activation et réinitialisation partenaires, 2FA admin) ne sont ni envoyés ni
  journalisés en recette : ces parcours ne sont pas démontrables tant qu'un SMTP de test n'est
  pas configuré.

## Raccordement Netlify (après validation de l'API)

1. Définir `API_ORIGIN=https://gobilan-recette-api.onrender.com` dans l'environnement de build
   du projet `gobilan-pwa` (contexte utilisé pour la démonstration).
2. Relancer un build : `scripts/configure-netlify.mjs` écrit `/v1/* → API` dans
   `apps/pwa/dist/_redirects`. Une variable ajoutée après le build n'a aucun effet.
3. Vérifier sur le site Netlify que `/v1/auth/config` renvoie du JSON avec
   `demo.whatsappSimulated: true` (et non `api-unavailable.json`).
