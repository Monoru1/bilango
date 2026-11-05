# MISSION CODEX — GOBILAN : DÉMO 15/11/2026, LIVRAISON 01/12/2026

**Documents disponibles dans le dépôt :** `docs/cahiers-des-charges/CDC_GoBilan_2026-10-19_EXTRACTION.txt` et `docs/cahiers-des-charges/Modifications_GoBilan_v1.2_2026-11-01_EXTRACTION.txt`. Ces fichiers sont des **extractions textuelles** des PDF transmis : pour les tableaux, figures, annexes ou ambiguïtés, exiger les PDF originaux avant validation finale. Ne pas présenter ces extractions comme les PDF binaires.

Tu es l'ingénieur principal chargé de **livrer** GoBilan, pas de produire un audit de plus. Référentiel contractuel : les deux PDF originaux remis par le propriétaire (19/10/2026, 29 pages ; modifications v1.2 du 01/11/2026, 5 pages). Ils doivent être conservés sans altération dans `docs/cahiers-des-charges/`. **Si les PDF ne sont pas encore présents dans le dépôt, signale leur absence et demande leur ajout : ne prétends pas les avoir lus depuis GitHub.** Le propriétaire les a fournis dans la conversation ChatGPT, pas nécessairement dans l'environnement Codex. Ne substitue jamais ce prompt aux PDF.

## Dates et définition de « livré »
- **15/11/2026 :** démonstration client fiable, installable sur iPhone et Android, avec parcours de bout en bout utilisable et sans données réelles détournées.
- **01/12/2026 :** application, API, portail partenaires, administration, intégrations, sécurité, sauvegardes et recette complète selon les cahiers.
- Chaque fonctionnalité clôturée = code + test automatisé + vérification manuelle ou E2E représentative + preuve de déploiement si concernée. Pas de « prêt » sans preuve.
- Ne pas fusionner ni activer en production les paiements, envois WhatsApp ou migrations destructives sans validation explicite, paramètres réels et plan de retour arrière.
- Ne pas bloquer tout le travail pour des secrets manquants : implémenter des adaptateurs testables et documenter précisément les paramètres et validations restantes.

## 0. Démarrage immédiat — ne pas répéter les audits
1. Lire les deux cahiers **intégralement**, y compris tableaux, annexes, notes et critères de recette. Lire aussi `docs/`, `README`, configuration CI, GitHub issues et PR existantes.
2. Examiner l'état réel du dépôt, les branches `main` et PR #6/#7, le site Netlify `gobilan-pwa`, les apps PWA/API/partners/admin, et les variables attendues **sans révéler de secrets**.
3. Exécuter `npm ci`, `npm run check` et les tests E2E existants ; relever les échecs exacts et les corriger, sans faire une nouvelle boucle de rapports.
4. Créer une matrice de traçabilité `docs/recette/matrice-exigences.md` : ID/section source, exigence exacte, implémentation, test, preuve, statut, bloqueur.
5. Suivre l'issue GitHub #8 et créer des PR de livraison petites, testées et traçables. Éviter de réécrire des composants fonctionnels inutilement.

## 1. PRIORITÉ ABSOLUE — démonstration 15 novembre
### Hébergement et PWA
- Déploiement Netlify depuis `main` : `npm run build -w @gobilan/pwa`, dossier `apps/pwa/dist`, routage SPA, cache/service worker et mises à jour maîtrisés.
- **Dans le navigateur** : afficher uniquement logo, texte d'installation, bouton installer et lien légal ; aucune page métier, inscription, session API ni erreur `/v1/me` ne doit s'afficher avant installation. Ne jamais prendre la barrière visuelle pour une autorisation de sécurité.
- Android Chrome : capter `beforeinstallprompt`, afficher un état de repli si indisponible, vérifier manifest, icônes, HTTPS, service worker, lancement standalone.
- iPhone Safari : afficher le guide visuel prévu dans modifications v1.2 §6 ; fermeture possible et réouverture via « Comment installer ? ». Pas de tentative d'installation automatique. Gérer les navigateurs intégrés WhatsApp/Instagram/TikTok/Facebook en proposant Safari/Chrome.
- Le paramètre `?demo=1` **ne doit pas** exposer les écrans métier sur le site public. Pour la recette, créer un environnement de démonstration **isolé**, explicitement identifié, avec données fictives et aucun appel à des prestataires réels. Ne jamais affaiblir la sécurité du produit.
- Vérifier sur appareils réels ou tests mobiles représentatifs les chemins : accueil web → installation → première ouverture → onboarding → PIN → business → invitation → bilan → dashboard → abonnement. Consigner limites d'émulation.

### Authentification et disponibilité
- Diagnostiquer la réponse vide de `/v1/me` et l'erreur historique `Cannot destructure property 'user' from null or undefined value`. Valider les réponses d'API et afficher un état d'erreur propre ; ne pas renvoyer du HTML de SPA pour les chemins `/v1/*`.
- Déployer/configurer une API et une base **réelles pour la démo**, ou utiliser une simulation strictement isolée et clairement annoncée au client. Ne pas présenter une simulation comme une intégration fonctionnelle.
- Tester login, déconnexion, nouvel appareil, PIN, invitations et permissions multi-business.

## 2. Fonctionnalités PWA / API selon CDC principal 19/10
- Onboarding pays (Bénin +229, Côte d'Ivoire +225, Togo +228), numéro WhatsApp, OTP 4 chiffres, parrainage optionnel, identité, création/rejoindre business, PIN 4 chiffres.
- OTP : usage unique, expiration 10 min, 4 essais/code, CAPTCHA, quotas IP/appareil/numéro, verrouillage côté serveur ; PIN haché et validé serveur, 4 échecs → blocage 5 min progressif, récupération WhatsApp, sessions persistantes, nouvel appareil.
- Un seul compte, rôles par business ; propriétaire non révocable, saisie seule/gestion complète/lecture seule, contrôle serveur sur chaque ressource, révocation sans suppression des bilans.
- Création business (nom, secteur, stock facultatif), invitations en attente, menu et navigation adaptés aux rôles.
- Bilans quotidiens multi-contributeurs : CA, dépenses, ajouts caisse, stock optionnel, note, détails optionnels ; calcul caisse théorique historique, initialisation, modifications ≤24h avec versions et recalcul des jours suivants, PDF à la volée, historique limité selon rôle.
- Dashboard propriétaire : dernier bilan pertinent, périodes Aujourd'hui/7j/30j, caisse, dépenses, contributeurs, états vides ; aide et pages légales.
- Abonnement : **2000 FCFA pour 30 jours par business**, essai gratuit 7 jours, renouvellement volontaire, prorogation, 3 jours de grâce, blocage dès J+4, message neutre employé, aucune saisie rétroactive pendant suspension.
- FedaPay : transaction serveur avec référence unique, metadata, pays, webhook signé, idempotence, vérification de secours, renouvellement seulement sur paiement confirmé. Jamais de clé côté navigateur.
- Web push : bilan envoyé/modifié, rappel, expiration, nouvel appareil ; aucune donnée financière sensible dans les notifications ; badge et permissions au bon moment.
- Accessibilité mobile-first, performance et palette CDC §11 ; CGU, CGV et confidentialité CDC §12/annexes, sans inventer de validation juridique.

## 3. Modifications v1.2 du 01/11 — obligatoires, avec arbitrages documentés
- Heure de fermeture configurable par business ; rappels selon heure locale réelle du pays et jours d'inscription de l'employé.
- Rappel WhatsApp **uniquement jours 1 à 7**, à l'heure de fermeture si bilan absent ; texte exact du PDF, **aucun lien** ; après jour 7 notifications internes uniquement.
- Notification interne au propriétaire : un employé → bilan disponible ; plusieurs employés → notification individuelle à chaque bilan.
- Rapport WhatsApp **unique par propriétaire** à l'heure du soir configurable (21h30 par défaut), agrégé sur ses business ayant transmis le bilan ; aucun message instantané WhatsApp au patron.
- iPhone : guide d'installation v1.2 §6 (fermeture et réouverture volontaire).
- Limitation des demandes OTP : cadence 2 min et maximum 5/24h selon v1.2, plus limites appareil/IP et plafond global à arbitrer.
- Parrainage owner : accès après premier abonnement payé, code aléatoire unique, non réattribuable, contrainte DB, 30 jours gratuits après **premier paiement** du filleul, pas de commission partenaire ; suivi admin, historique et anti-abus.
- Analytics page d'installation : visiteurs/visites anonymes, sources, clics installer, ouverture standalone, inscription, exports CSV ; pas d'IP en clair, pas de cookies publicitaires ; métriques admin acquisition/activation/conversion/revenus/rétention/engagement/parrainage/opérations/support.
- Exécuter et renseigner **REC-01 à REC-14** avec résultats et preuves.

## 4. Portail partenaires et administration
- Applications **distinctes** de la PWA : partenaires dans navigateur, admin sur lien séparé jamais affiché aux partenaires.
- Partenaires : e-mail/mot de passe, activation par lien à usage unique, accords versionnés, rôles agent/manager/influenceur, parrainages, commissions selon tableaux du CDC, affichage cloisonné.
- Admin : liste autorisée, 2FA e-mail, contrôle serveur, création partenaires, calendrier versements manuels les 1er/15, seuil 2000 FCFA, frais, validation immuable et annulations compensatoires, exports et métriques.
- Garantir calcul serveur des commissions sur paiements confirmés et non sur données modifiables côté client.

## 5. Sécurité et exploitation
- Contrôles d'accès **serveur** à chaque requête, isolation stricte entre business, validation des entrées, protection brute-force, quotas OTP, secrets uniquement serveur, HTTPS, source maps off, logs sans secrets ni PIN ni OTP, audit des accès.
- Webhooks signés et idempotents, transaction DB cohérente, prévention des doubles paiements/crédits, sauvegardes et **test de restauration**, migrations réversibles.
- CI : typecheck, lint, unitaires, intégration API/DB, E2E et build de chaque app. Exécuter réellement et corriger les échecs.
- Documenter déploiement Netlify et hébergement API/DB, domaines, environnements, procédures incident et restauration.

## 6. Conflits / décisions : ne pas inventer
Conserver les textes sources intacts. Créer `docs/decisions/contradictions-cdc.md` avec citation de sections, impact, option recommandée et statut. Au minimum :
1. CDC principal : WhatsApp seulement OTP ; v1.2 : rappels employés 7 jours et rapport patron → arbitrer V1/coûts/consentement/templates Meta.
2. CDC principal : 2 OTP/24h ; v1.2 : 5/24h et 1/2min → arbitrer la règle validée.
3. Guide iPhone : réaffichage à chaque visite vs v1.2 uniquement à la demande → suivre la modification v1.2, en consignant la différence.
4. Fuseaux : v1.2 écrit UTC+1 pour trois pays ; **ne pas recopier cette hypothèse sans vérification** ; utiliser `Africa/Porto-Novo`, `Africa/Lome`, `Africa/Abidjan` selon pays et tester.
5. 30 jours offerts au parrain : prolongation ou période séparée, plafond, cumul et essai filleul.
6. Le document v1.2 se dit « à valider avant développement » : identifier les décisions non validées, ne pas inventer leur approbation.
7. Cahier de sécurité complémentaire mentionné mais non fourni : rechercher dans dépôt, sinon marquer manquant et couvrir a minima le CDC §13.

## 7. Cadence et livrables attendus
- Ordre d'exécution : P0 démo (installation, déploiement, API, onboarding, parcours métier), puis P1 complet, puis optimisation.
- Après chaque lot : fichiers modifiés, commit/PR, tests exacts avec résultats, URL de preview et preuve d'exécution, risques résiduels, prochaine action concrète.
- D'ici 15/11 : `docs/recette/demo-15-novembre.md` avec scénarios, comptes fictifs, appareils testés, captures, liens et limites.
- D'ici 01/12 : `docs/recette/livraison-01-decembre.md`, matrice exigences complète, REC-01..14, preuves sécurité/restauration, guide déploiement/exploitation, liste explicite des éventuelles réserves.
- **Ne pas conclure avec un audit. Implémenter, tester, corriger, livrer.** Ne jamais prétendre avoir testé un appareil ou un service si ce n'est pas le cas.

## Commande de départ
Commence par lire intégralement les deux extractions textuelles présentes dans `docs/cahiers-des-charges/`. Vérifie ensuite si les deux PDF originaux sont également présents ; sinon, demande leur ajout pour contrôler tableaux, annexes et fidélité avant recette finale, mais commence immédiatement les corrections P0. Exécute ensuite la suite de tests existante et corrige les échecs. Prends comme suivi GitHub l'issue #8.
