# SEC-48 — Désactivation auditée des codes de parrainage propriétaire (12 novembre 2026)

Statut : **IMPLÉMENTÉ ET TESTÉ EN CI UNIQUEMENT** — non déployé en recette, portail admin non déployé.

- Route : `POST /v1/admin/owner-referral-codes/deactivate` `{ code, reason }` (session admin, origine admin, CSRF).
- Service : `AdminService.deactivateOwnerReferralCode` — transaction, verrou de ligne partagé avec l'attribution
  (`AuthService.updateProfile`), ligne `audit_log` `owner_referral_code.deactivate` (auteur, date, motif).
- Aucune migration : la colonne `owner_referral_codes.active` existe depuis la migration 006.
- Interface : onglet « Codes de parrainage propriétaire » de l'administration (bouton Désactiver, motif obligatoire,
  rechargement de l'état serveur après chaque tentative).
- Tests : `apps/api/test/owner-referral-deactivation.test.ts` (session, origine, CSRF, motif, code inconnu, audit,
  répétition → 409, attributions antérieures et crédit conservés, nouvelle attribution refusée, accès simultanés).
- Non couvert : parcours navigateur de l'interface admin (`e2e/portals-smoke.mjs` ne crée pas de code propriétaire).
