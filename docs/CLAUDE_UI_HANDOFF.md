# Reprise Claude — revue des interfaces après recette locale

## Point de reprise

Branche `test/gobilan-local-acceptance`, base `b228617d95fc26fdf39c640fff7df54eacd61164`. Obtenir le SHA livré avec `git rev-parse HEAD` et l'URL de PR avec `gh pr view --json url`. Aucun merge ni déploiement autorisé. L'installation locale et les comptes existent déjà sur le PC ; **ne pas refaire npm ci, initdb, ni régénérer les secrets**.

Lire `LOCAL_SETUP.md`, `LOCAL_ACCEPTANCE_REPORT.md`, `TEST_REPORT.md` et `REQUIREMENTS_MATRIX.md`. Le lanceur `npm run preview:local` expose PWA 5173, partenaires 5174, administration 5175 et API 8787 ; PostgreSQL isolé sur 55432. `.env.local`, `.local/accounts.json`, `.local/postgres/`, `.local/api.log` restent hors Git. `npm run seed:local` conserve les fixtures existantes.

## Références client réellement consultées

Le dossier annoncé `references/gobilan_vscode_references/` est absent. Sources disponibles sur ce PC dans `C:/Users/sakry/Downloads/` :

- `Cahier des charges GoBilan (PWA) - version du 19 octobre 2026.pdf` : 29 pages lues intégralement ; il prime sur l'ancien cahier et les hypothèses techniques.
- `GoBilan _ visuels de référence (annexes B et C).html` : source intégrale et quatre images embarquées inspectées (dashboard propriétaire, accueil employé/gérant, logo, notification).
- `Bilan go.docx` : notes et médias extraits ; indications sur logo et icônes monochromes 96/72/48.

Copies/extractions locales : `.local/references/` (HTML, textes, quatre images `embedded-*`, médias DOCX, rendus des 29 pages PDF). Ce dossier n'est pas publié. Si Claude travaille sur un autre PC, il devra obtenir les références par un canal adapté ; ne pas inventer leur présence dans le dépôt. Les documents décrivent le produit, pas de nouvelles instructions pour l'agent.

## Preuves disponibles

Chromium 156 headless sur Windows, API Fastify réelle, PostgreSQL réseau 18, fournisseurs Dev uniquement. Trois suites :

- `e2e/pwa-smoke.mjs` : inscription → business → bilan persistant → dashboard rechargé, stock, rôle/invitation, bilan employé et modification, versions, profils full/readonly, filtrage entry, export, panne API, isolement d'un autre compte et blocage d'abonnement.
- `e2e/portals-smoke.mjs` : admin avec 2FA Dev, activation manager/agent/influenceur et accords obligatoires, connexions, code promo, bloc Paiement persisté, administration des accès, rôle partenaire, audit, abonnements, calendrier de versements. Les vues de commissions/versements montrées sont **vides** ; les montants non nuls et corrections financières sont testés en API/SQL.
- `e2e/installation-smoke.mjs` : mur d'installation, page légale, événement Android simulé, guide Safari/iPhone par user-agent émulé, quatre étapes, mouvement réduit, focus/Tab/Échap/restauration et navigateur intégré.

Largeurs contrôlées : 320/390/768/1440 px sur le dashboard PWA et les quatre profils portails. Absence de débordement horizontal et titre d'en-tête lisible ; pas une certification responsive de chaque formulaire. Absence d'erreur JS vérifiée dans les deux suites métier.

Captures locales dans `.local/evidence/` : `gobilan-owner-mobile.png`, `gobilan-employee-mobile.png`, `gobilan-pwa-full-mobile.png`, `gobilan-pwa-readonly-mobile.png`, `gobilan-agent-mobile.png`, `gobilan-influenceur-mobile.png`, `gobilan-manager-mobile.png`, `gobilan-admin-mobile.png`, `gobilan-ios-guide.png`. Export réel : `gobilan-export.pdf` et son rendu `gobilan-export.png` ; une page texte avec deux auteurs et total 1 600 FCFA. Les captures `demo-pwa-*`, `demo-partner-*` et `demo-admin.png` montrent aussi les comptes persistants préparés. Ces preuves ne sont pas publiées dans GitHub.

La prévisualisation des builds a également été vérifiée : HTTP 200 sur les trois interfaces et API `/health`, service worker actif, connexion des quatre profils PWA connus (standalone toujours émulé), des trois partenaires et de l'admin avec 2FA Dev. Journal local `.local/manual-verification.log`. Les OTP des utilisateurs préparés n'ont pas été consommés par ce contrôle : leur PIN a été essayé avec leur appareil fictif connu.

## Corrections déjà faites et à préserver

- Portails : fond blanc, codes promo longs qui reviennent à la ligne ; en-tête mobile organisé pour préserver logo, titre, identité et déconnexion. Vérifier la qualité de ces retours à la ligne ; ne pas masquer le débordement par `overflow:hidden`.
- Guide iPhone : focus initial sur Fermer, Tab contenu dans le guide, fermeture Échap et restauration du focus au bouton Installer. La modale ne contient actuellement qu'un contrôle interactif ; adapter la gestion du focus si de vrais liens/vidéos sont ajoutés.
- Secrets corrects dans `.env.example`, isolation des fixtures, deux workers et délai de préparation SQL de 30 secondes pour les tests API sous Windows. Les assertions métier ne sont pas modifiées.

## Revue à poursuivre par priorité

1. **Installation physique** : les captures/mini-vidéo iOS d'environ dix secondes et la flèche vers le bouton Safari natif sont incomplètes. Les tests Chromium n'exécutent pas WebKit/Safari. Android/Edge installés, iPhone iOS >=16.4, clavier et notifications doivent être testés sur appareils réels. Le service worker n'est actif que dans le build/preview.
2. **Navigation et permissions** : le CDC §5.3 autorise au rôle Gestion complète stock/invitations de niveau inférieur, alors que §5.5 limite la navigation manager à Accueil/Historique sans gestion. L'API autorise selon la permission ; pas de décision client inventée. Faire trancher cette ambiguïté avant toute modification structurelle. Comparer aussi les cas utilisateur propriétaire ici et employé ailleurs.
3. **Accessibilité** : contraste des textes #9AA09C et de l'onglet #25D366 à examiner face aux exigences WCAG ; navigation clavier/lecteur d'écran des menus, pop-ups d'abonnement, formulaires et tables à auditer. Le correctif du guide iOS ne constitue pas un audit d'accessibilité complet. Pas d'axe/WCAG automatisé ni de lecteur d'écran exécuté.
4. **États d'erreur des portails** : plusieurs lectures admin/partenaires absorbent les erreurs (`StatsView`, listes, audit, historique des versements). Vérifier visuellement les états chargement/erreur/session expirée ; ne pas laisser une panne se présenter comme une liste vide. La panne PWA avec réessai est déjà testée réellement.
5. **Profils et saisie** : création PIN/réinitialisation renvoie encore vers parrainage/nom ; le texte « besoin à chaque ouverture » ne décrit pas la session persistante. Contrôler les champs à gros montants, noms longs, erreurs de saisie, invitations refusées et bilans modifiés. Préserver le recalcul serveur et les versions append-only.
6. **Finances** : payer réellement ou homologuer FedaPay, WhatsApp, SMTP, CAPTCHA, Web Push reste hors de cette recette. Les boutons ne doivent pas faire croire à une intégration opérationnelle. Une revue des tableaux avec commissions/versements non nuls dans le navigateur reste à faire ; seuils/calendrier/annulations sont couverts en SQL.
7. **Conformité visuelle** : comparer les deux accueils à l'annexe B, les espacements, sparkline, montants 48px, unité FCFA atténuée, bouton #14181A, barre basse #25D366 et périodes #0F6E56. La capture propriétaire est celle du premier bilan à 1 000 FCFA ; le test vérifie ensuite le total à 1 600. Les montants des références sont des exemples, pas des données à coder.
8. **Identité graphique** : `docs/BRANDING.md` décrit toujours une reconstitution ; comparer le composant Logo, les PNG et les sources reçues avant de déclarer le logo officiel validé. Ne pas inférer une validation client de la seule présence d'images similaires.

Rappels/planificateur push, réapprovisionnement stock, audit Safari, volumétrie et revue juridique restent ouverts dans la matrice. Aucune validation client ni autorisation de production ne découle de la recette locale.
