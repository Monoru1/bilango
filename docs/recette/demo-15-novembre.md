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
- PDF originaux conservés localement et comparés aux extractions ; voir `../cahiers-des-charges/ORIGINAUX.md`.

## Exécutions et limites

| Contrôle | Résultat |
| --- | --- |
| `npm ci` | Exécuté avec le lockfile de la PR #7 |
| Tests PWA | 60 réussis localement après correction de l'assertion de titre légal et du chemin du test service worker |
| Tests client HTTP partagé | 7 réussis localement |
| ESLint | Réussi localement |
| Audit dépendances production | 0 vulnérabilité (`npm audit --omit=dev --audit-level=high`) |
| `npm run check` | Résultat final consigné dans la PR ; première tentative interrompue après timeout/mémoire des moteurs PGlite non fermés, correction incluse |
| E2E mobiles ajoutés | Résultat de CI à reporter dans la PR ; aucun succès local revendiqué : téléchargement Chromium reçu tronqué ; PostgreSQL système indisponible dans l'environnement |
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
