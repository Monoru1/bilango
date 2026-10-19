# CODEX_HANDOFF
1. **Branche** `feat/gobilan-pwa-foundation` (non mergée, main intact c8f0e1fd). SHA final : `git rev-parse HEAD`.
2. **Architecture** : voir PWA_ARCHITECTURE.md.
3. **Arborescence** : apps/{api,pwa,partners,admin}, packages/{domain,contracts,ui}, legacy/expo-app, docs, e2e.
4. **Fait** : domaine, API (auth, tenants, bilans, abonnement, webhook simulé, partenaires, commissions, versements, admin), portails partenaires/admin, écrans PWA en DEMO, PDF, légal.
5. **Partiel** : PWA non reliée à l'API ; admin (allowlist, exclusion, rôle) ; push ; e-mail.
6. **Tests** : TEST_REPORT.md.
7. **Défauts connus** : logo reconstitué ; captures iOS/vidéo absentes ; pas de test Postgres réel.
8. **Décisions** : DECISIONS.md.
9. **Écarts CDC** : navigation rôles complets littérale ; auth PWA simulée.
10. **Dépendances externes** : FedaPay (RCCM/IFU), WhatsApp Business, SMTP, VAPID, hébergement, domaines distincts.
11. **Risques sécurité** : SECURITY_MODEL.md.
12. **Prochaines tâches** : (1) client HTTP PWA→API ; (2) CI Postgres réel ; (3) allowlist admin + confirmation e-mail ; (4) e-mail/WhatsApp/push réels ; (5) FedaPay sandbox ; (6) revue juriste.
13. **Commandes** : `npm ci && npm run check` ; `npm run dev:api` + `dev:pwa` (`?demo=1`).
14. **À valider par le propriétaire/client** : économie des commissions, nav des rôles, textes légaux, logo HD, frais Mobile Money, domaines.
