# Audit de sécurité — 23 octobre 2026 (branche feat/gobilan-claude-v1)

Portée : revue du code et des tests de ce dépôt, exécutés en local avec fournisseurs Dev. Ce n'est **pas** un test d'intrusion, ni une validation de l'infrastructure, des services externes ou du TLS. Chaque ligne indique la preuve réellement exécutée.

## Constats corrigés pendant cette revue

| # | Constat | Gravité | Correction | Preuve |
|---|---|---|---|---|
| S1 | Les notifications serveur portaient `{title, body}` alors que le service worker attend `{type, businessName}` : elles étaient silencieusement abandonnées (fonction de sécurité « aucun montant sur l'écran verrouillé » inopérante et non testée de bout en bout) | moyenne (fonctionnel + confidentialité) | Charge utile typée validée par Zod côté serveur ; le texte est fabriqué par le service worker ; aucun champ ne peut porter un montant | push.test.ts (champs superflus retirés) |
| S2 | Notifications envoyées à l'intérieur des transactions SQL : envoi sous verrou, et envoi d'une notification pour un bilan ou un paiement ensuite annulé (rollback) | moyenne | Envoi après commit uniquement | push.test.ts, reports.test.ts |
| S3 | L'alerte « nouvel appareil » pouvait atteindre le nouvel appareil au lieu de l'ancien (§9.2) | moyenne | `excludeDeviceId` | auth.test.ts |
| S4 | Reprise d'un point d'accès Web Push appartenant à un autre compte : un tiers pouvait détourner ou rendre illisible l'abonnement d'autrui | moyenne | Reprise refusée sauf clés de chiffrement identiques | push.test.ts |
| S5 | Réponses API sans `Content-Security-Policy` ni `X-Frame-Options` | basse | `default-src 'none'; frame-ancestors 'none'` et `DENY` | http.test.ts |
| S6 | Révocation des sessions au changement de mot de passe (§13.3, §13.4) et alertes e-mail admin : code présent mais **jamais prouvé** | information | Tests ajoutés ; mutants (suppression de la révocation, de l'alerte) mis en échec par les tests | http.test.ts |

## Vérifié sans écart

- Aucun fichier `.env` suivi par git (seul `.env.example`) ; `.gitignore` exclut `.env*`, clés et certificats.
- Cartes sources désactivées dans les trois builds (`sourcemap: false`, §13.1).
- Cookies httpOnly / Secure / SameSite, CSRF et contrôle d'Origin par audience, jeton jamais renvoyé dans le corps (http.test.ts).
- « Mot de passe oublié » partenaire : réponse identique que l'adresse existe ou non, code à usage unique.
- Aucune journalisation de l'endpoint push (le transport Dev n'écrit que le type).
- `npm audit --omit=dev --audit-level=high` : 0 vulnérabilité (exécuté le 23 octobre 2026).
- Le serveur refuse `NODE_ENV=production` tant que les fournisseurs Dev sont en place.

## Non couvert / à faire par l'équipe

- En-têtes des frontends (CSP stricte, HSTS, `frame-ancestors`, `Permissions-Policy`) : dépendent de l'hébergeur ; **non configurés**. CSP recommandée pour la PWA : `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' <origine API>; frame-ancestors 'none'; base-uri 'none'; form-action 'self'` (à valider avec le checkout FedaPay).
- Limites de débit distribuées (le limiteur actuel est en mémoire, par instance).
- Transport Web Push réel (VAPID), WhatsApp, CAPTCHA, SMTP, FedaPay : jamais exercés contre les vrais services.
- Test d'intrusion indépendant, revue des secrets gérés et de leur rotation, sauvegardes chiffrées.
- Hypothèse D-004 (chaîne de renouvellement rompue après blocage) : décision métier à valider, pas un défaut de sécurité.
