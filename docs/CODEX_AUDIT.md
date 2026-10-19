# Audit indépendant — 19 octobre 2026

Référence : CDC GoBilan PWA du 19 octobre 2026 (29 pages), branche Claude `feat/gobilan-pwa-foundation`, HEAD `d68acd112f28e4edf8c59a5598f464b4967acd8a`.
Dépôt cloné propre ; les éventuelles modifications non commitées sur l'ordinateur de Claude ne sont pas accessibles dans ce clone.

## État initial reproduit

`npm ci` et `npm run check` réussis : domaine 94, contrats 7, API 110, PWA 32 tests. TypeScript, ESLint et builds verts. Portails sans tests unitaires dédiés. Les tests API initiaux utilisent exclusivement PGlite.

| Exigence | État initial | Constat / suite |
|---|---|---|
| PWA → API / connexion / bilans / équipe / stock | simulé | Toutes les écritures PWA passent par DemoStore ; intégration P0 nécessaire |
| Domaine et permissions API | partiel | Règles présentes, nombreuses régressions testées ; audit de concurrence requis |
| PostgreSQL réseau | absent | Adaptateur présent ; aucun essai réel reproduit initialement |
| Sessions / CSRF | partiel | Cookies httpOnly ; Origin + header pour mutations ; pas de CORS permissif |
| Quotas IP | partiel | `trustProxy: true` accepte les IP déclarées par le client |
| Quotas OTP appareil/IP et essai gratuit | partiel | Lecture puis écriture non verrouillées sur les clés partagées |
| Caisse / stock côté PWA | simulé | API historique limitée ; calculer sur une page tronquée donne des montants faux |
| Abonnement / renouvellement | partiel | Domaine testé ; route PWA abonnement inaccessible après blocage |
| FedaPay | simulé | DevGateway ; pas de compte sandbox externe ni de SDK officiel validé |
| WhatsApp / e-mail / CAPTCHA / Web Push | simulé | Doubles de développement ; serveur refuse la production |
| Partenaires / commissions / versements | partiel | Services et portails présents ; contrôles append-only en SQL |
| Allowlist admin avec confirmation / changement de rôle | absent | À compléter avant production ; aucune validation client supposée |
| Installation / guide iOS | partiel | Manifest et SW présents ; captures/vidéo iOS manquantes |
| PDF | partiel | Fonctionnel en tests texte ; audit npm signale jsPDF critique, mise à jour requise |
| CI | partiel | check et audit ; PostgreSQL réseau et parcours PWA absents |
| Production | bloqué | Fournisseurs externes, exploitation et revue juridique non finalisés |

Les résultats après corrections sont maintenus dans TEST_REPORT, REQUIREMENTS_MATRIX et DEPLOYMENT_READINESS. Aucun résultat simulé n'est une homologation fournisseur réel.
