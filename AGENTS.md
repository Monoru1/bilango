# AGENTS.md
- Le CDC du 19 oct 2026 prime sur tout ancien document. Ne rien inventer comme validation client.
- Ne jamais déclarer un test réussi sans l'avoir exécuté ; un mock n'est pas une fonctionnalité opérationnelle (étiqueter « DÉMO »).
- Pas de merge sur main, pas de réécriture d'historique, pas de déploiement prod, pas de vrais paiements/notifications, aucun secret dans le dépôt.
- Règles métier uniquement dans `packages/domain` ; contrats dans `packages/contracts` ; permissions toujours côté serveur (`requireAccess`).
- Journal des commissions et des actions admin : append-only (triggers SQL). Correction = ligne d'annulation.
- Avant commit : `npm run check`. Lire `docs/CODEX_HANDOFF.md` en premier.
- Design : fond blanc, texte #14181A, accent #0F6E56, onglet actif #25D366, erreur #B54B3A/#FBEDEA, Inter.
