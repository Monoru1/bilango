# Démonstration du 15 novembre — lot P0 du 5 novembre 2026

## Périmètre livré dans cette branche

Branche `fix/p0-demo-november`, issue #8. Point de départ : PR #7 (`d260c08`), avec intégration des spécifications et corrections publiques de `main` (`871824c`). Pas de fusion sur main ni d'activation de prestataires externes.

Corrections du lot :
- Guide iPhone en trois étapes, fermeture mémorisée, réouverture volontaire, focus clavier et Échap.
- Installation publique montée sans délai artificiel de 500 ms, pour écouter l'événement Android plus tôt ; refus de prompt géré sans rejet non capturé.
- Réponse API vide, null, primitive, tableau ou HTML rejetée proprement ; réponse de mutation 204 préservée. Aucun conseil de contournement public par `?demo=1`.
- Service worker v2 : pas de cache API, pas de HTML ajouté au cache des assets, conservation des caches appartenant à d'autres applications et mise à jour de la coque de secours.
- PGlite de test fermé après chaque cas au lieu d'accumuler les moteurs WASM ; deux workers API maximum.
- Tests navigateur du build public ajoutés : Android/iPhone/WhatsApp émulés, légal, zéro appel API public, réponse HTML installée et reprise. Captures CI `mobile-install-*`.
- PDF originaux comparés aux extractions puis publiés avec autorisation explicite du propriétaire ; voir `../cahiers-des-charges/ORIGINAUX.md`.

## Exécutions et limites

| Contrôle | Résultat |
| --- | --- |
| `npm ci` | Exécuté avec le lockfile de la PR #7 |
| Tests PWA | 60 réussis localement après correction de l'assertion de titre légal et du chemin du test service worker |
| Tests client HTTP partagé | 7 réussis localement |
| ESLint | Réussi localement |
| Audit dépendances production | 0 vulnérabilité (`npm audit --omit=dev --audit-level=high`) |
| `npm run check` | Réussi : 345 tests (API 177, PWA 60, contrats 7, domaine 94, UI 7), 9 réservés au PostgreSQL réseau. Première tentative interrompue, moteurs PGlite désormais fermés |
| E2E mobiles ajoutés | CI réussie sur Chromium 320, Firefox 390, WebKit 768 pour les parcours métier ; suite installation en viewport 390 sur les trois moteurs. Aucun E2E local revendiqué |
| Site public existant | Ouvrir `/b/private/bilan?demo=1` affiche uniquement installation et lien légal dans Chrome distant ; constat sur `main`, pas preuve de déploiement des nouvelles corrections |
| Recette physique | Aucun iPhone, Android ou navigateur WhatsApp physique testé pendant ce lot |
| Intégrations externes | Aucun OTP WhatsApp, e-mail, paiement FedaPay ou push réel exécuté |

## Parcours à homologuer

1. Public → installer → icône → première ouverture → pays/WhatsApp → OTP → PIN.
2. Propriétaire → nom → business avec stock → invitation → employé acceptant.
3. Employé → bilan → édition sous 24h ; propriétaire → agrégation, caisse, PDF.
4. Deuxième business et autre propriétaire → isolation, droits lecture/saisie/gestion, retrait.
5. Nouvel appareil, PIN erronés/blocage, récupération, déconnexion et session expirée.
6. Abonnement essai/grâce/suspension, accès neutre employé, reprise par paiement sandbox autorisé, webhook signé/idempotent.
7. Installer la version suivante, vérifier mise à jour service worker, absence d'anciens assets et absence de cache API.

Les scénarios API/DB et navigateur existants couvrent une partie de ces chemins avec des fournisseurs Dev explicitement simulés. Ils ne certifient pas une API hébergée, une installation physique ou un paiement fournisseur.

## Dépendances externes encore ouvertes

- API GoBilan et PostgreSQL persistants sur un hôte autorisé, avec URL et secrets serveur. Les projets Supabase accessibles identifiés concernent un projet générique et Maison des Pyjamas ; aucun n'a été réutilisé pour GoBilan. Render demande une sélection explicite de workspace avant inventaire ; aucune infrastructure n'a été créée ni modifiée.
- Secrets Meta/Turnstile/SMTP/VAPID/FedaPay de recette, destinataires de test autorisés et vérification des retours réels. Ne pas remplacer par des mocks silencieux.
- Appareils physiques pour l'installation, standalone et réception de notifications.
- Arbitrages v1.2 dans `../decisions/contradictions-cdc.md`, cahier de sécurité complémentaire et relecture juridique avant recette finale.

**Statut : P0 en cours. Ni démonstration complète homologuée, ni livraison finale déclarée.**

## Preuves finales du lot P0

Commit de code vérifié : `2eba05d1600fac55635ed315049290f5eb1cb678` (PR [#9](https://github.com/Monoru1/bilango/pull/9)).

[CI complète du commit](https://github.com/Monoru1/bilango/actions/runs/42032534589) : **six jobs réussis**, résultat consulté le 5 novembre 2026. PostgreSQL : 186 tests réussis, aucun ignoré ; ce sont les 177 cas API locaux plus les 9 cas de concurrence, pas 186 tests supplémentaires à additionner au total local. Les deux parcours PWA et portails passent sur les trois moteurs. Les envois restent Dev ; aucun prestataire réel certifié.

Le job PostgreSQL restaure un dump dans une base isolée : utilisateur, caisse, historique et triggers préservés. Le job conteneur vérifie la persistance après remplacement, l'archive et son checksum puis une restauration dans une base temporaire distincte. Aucun stockage de production ou sauvegarde hors hôte validé.

Captures CI : `mobile-install-chromium` (artifact 13417111238), `mobile-install-firefox` (13416941929), `mobile-install-webkit` (13416862094), accessibles depuis la CI. Deux captures publiques, sans données personnelles, sont aussi conservées dans `preuves/` :

- [Installation iPhone émulée après fermeture du guide](preuves/installation-iphone-emule.png).
- [Erreur API contrôlée et réessai](preuves/api-erreur-controlee.png).

Preview : [https://deploy-preview-9--gobilan-pwa.netlify.app](https://deploy-preview-9--gobilan-pwa.netlify.app), deploy Netlify `6aec7edf1f5e7dcc147bb1b0`, lié au même SHA, état ready. HTTP et navigateur réellement contrôlés :

| Ressource / action | Résultat constaté |
| --- | --- |
| `/` et `/connexion` | 200 HTML, CSP présente |
| Route métier `/b/private/bilan?demo=1` | Installation seule, aucune donnée métier affichée dans Chrome distant |
| Lien légal depuis cette page | Texte légal complet accessible |
| `/v1/me` | 404 `application/json`, code `unavailable`, jamais HTML |
| `/manifest.webmanifest` | 200 `application/manifest+json`, display standalone, cache no-cache |
| `/sw.js` | 200 JavaScript, version gobilan-shell-v2, cache no-cache |

La réponse `unavailable` est volontaire et ne constitue pas une API métier disponible. La preview de cette PR reste une preuve d'hébergement PWA, pas une démonstration métier hébergée complète. La production demeure sur main.

## Autorisation des originaux

Le 5 novembre 2026, le propriétaire a explicitement autorisé la publication des deux PDF originaux sur le dépôt public en réponse à la demande précise. Les deux binaires sont ajoutés sans altération dans `docs/cahiers-des-charges/` ; leurs SHA-256 sont ceux du contrôle initial. Le blocage de publication des PDF est donc levé. Aucun changement applicatif ni activation de prestataire dans ce lot documentaire.
