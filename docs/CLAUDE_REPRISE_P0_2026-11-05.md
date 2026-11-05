# Prompt de reprise Claude — GoBilan

Tu reprends `Monoru1/bilango`, branche `fix/p0-demo-november`, pour LIVRER, sans recommencer les audits.

Échéances : démo complète/stable/installable mobile le 15 novembre 2026 ; recette finale le 1er décembre 2026. Suivi : issue #8.

## Commence par les sources et l'état livré

Lis entièrement `AGENTS.md`, `docs/CODEX_MISSION_LIVRAISON_2026-11.md`, les deux extractions sous `docs/cahiers-des-charges/`, puis les deux PDF originaux s'ils sont disponibles localement : leur publication publique a été rejetée par le contrôle automatique et nécessite une autorisation explicite. Lis `docs/recette/demo-15-novembre.md`, `docs/recette/matrice-exigences.md` et `docs/decisions/contradictions-cdc.md`. Vérifie le dernier commit de cette branche et les résultats de sa PR/CI ; ne repars pas de main seul et ne réimplémente pas la PR #7.

La branche part de `d260c08` (PR #7) et intègre main `871824c` : adaptateurs réels configurables, CAPTCHA, checkout reprenable, proxy API et sauvegardes sont présents, mais pas certifiés opérationnels chez les prestataires. La production reste verrouillée.

## Corrections apportées par Codex

- Guide iPhone trois étapes, fermeture persistante, réouverture à la demande, focus/Échap.
- Page d'installation montée immédiatement pour écouter Android ; erreurs du prompt contrôlées.
- Client HTTP : rejette les réponses 200 vides/null/HTML/primitive/tableau ; conserve 204 et erreurs métier. `/v1/me` malformé ne suggère plus `?demo=1`.
- Barrière publique et flag demo sécurisés repris de main ; tests démontrent l'absence de requêtes API sur accueil/légal/routes métier publiques.
- Service worker v2 : API non cachée, pas de HTML mis en cache comme asset, nettoyage limité aux caches GoBilan.
- PGlite de test libéré après chaque cas et workers API limités ; ne pas retirer cette fermeture.
- `e2e/install-smoke.mjs` et `npm run test:e2e:install` testent le build public sur les trois moteurs en CI ; captures archivées par job. Événement Android synthétique et UA iPhone/WhatsApp = émulation uniquement.
- PDF originaux vérifiés localement sans réécriture, checksums et équivalence textuelle documentés ; binaires exclus de Git après rejet de la publication par le contrôle automatique. Les décisions commerciales ouvertes ne sont pas approuvées implicitement.

## Exécute la suite, sans nouvel audit global

1. Si la CI de la PR a un échec, lis le job exact et corrige-le. Préserve les tests de permissions et financiers.
2. Vérifie la preview de la PR : HTTP `/`, routes SPA, `/v1/me` JSON jamais HTML, manifest/icônes/SW/en-têtes ; puis parcours navigateur et captures. Consulte les résultats consignée dans la PR avant d'affirmer « validé ».
3. Branche l'API + PostgreSQL persistants sur un environnement de recette autorisé déjà disponible. Aucun projet Maison des Pyjamas ne doit servir de base GoBilan. Si aucun hôte autorisé n'est disponible, nomme exactement l'accès/décision qui manque et continue les travaux indépendants. Pas de service payant créé automatiquement.
4. Exécute le parcours réel mobile avec fournisseurs de recette : OTP/PIN/nouvel appareil → business → invitation → bilan multi-auteur → édition/caisse/stock/PDF → abonnement. Tester les permissions et erreurs réseau. Aucune intégration simulée ne doit être présentée comme réelle.
5. Si une démonstration simulée est nécessaire, elle doit être sur un environnement distinct, portant clairement DÉMO, sans paiements ni prestataires réels, et ne doit pas ouvrir les écrans métier du site public avec `?demo=1`.
6. Termine P0 puis implémente P1 selon la mission : fermeture et notifications internes, adaptations v1.2 après arbitrages, owner referral avec unicité DB, admin/analytics anonymes/CSV, REC-01..14, sécurité et exploitation. Les règles métier restent dans `packages/domain`, contrats dans `packages/contracts`, permissions serveur `requireAccess`.

## Validation et livraison

- `npm ci` puis `npm run check` avant commit.
- `TEST_DATABASE_URL=<base dédiée> npm run test:postgres -w @gobilan/api`.
- `npx playwright install --with-deps chromium` ; `npm run test:e2e:install` ; `E2E_DATABASE_URL=<base dédiée> npm run test:e2e`.
- Répéter l'installation avec `E2E_BROWSER=firefox` et `webkit` comme en CI ; une émulation n'est pas une installation physique.
- Mettre à jour les preuves de recette pour le commit exact : commande, résultats, URL et appareils. Ne pas additionner les mêmes tests API exécutés sur PGlite et PostgreSQL.
- Commits/PR testés, petites étapes. Pas de fusion main, déploiement production, migration destructive, vraie notification ni paiement sans l'autorisation applicable. Ne jamais imprimer les secrets.
- Termine chaque lot avec ce qui a changé, ce qui a réellement passé, la preview vérifiée et uniquement les blocages concrets. Ne jamais déclarer « prêt » sur la seule base d'une CI verte.
