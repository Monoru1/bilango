# GoBilan V1 commerciale — livraison prévue le 15 novembre 2026

**État au 12 novembre — NO-GO commercial.** La preview et l’API de recette sont accessibles. La navigation publique a été vérifiée dans Chrome. Le proxy IP, la politique OTP, le lanceur Playwright et les deux portails sont réunis sur la branche temporaire d’intégration. Le déploiement des changements et leur validation hébergée attendent l’autorisation d’intégration.

- [Validation locale du proxy](preuves/2026-11-12-proxy-client-ip.md)
- [Contrôles de la preview et commande Playwright](preuves/2026-11-12-pwa-hebergee.md)
- [Preuves antérieures Render et PostgreSQL](preuves/2026-11-12-recette-render.md)
- [Modèle de sécurité et activation du proxy](../SECURITY_MODEL.md)
- [Configuration des fournisseurs et sauvegarde isolée](../CODEX_HANDOFF.md)

## Recette v1.2

| Exigence | Scénario et résultat attendu | Résultat constaté et preuve | Statut |
|---|---|---|---|
| REC-01 | Créer à 18 h, modifier à 21 h 30 et suivre la nouvelle heure | Tests API et E2E locaux/CI documentés dans la matrice. Exécution hébergée à faire | Partiel |
| REC-02 | J3, employé sans bilan, rappel WhatsApp sans lien | Consentement, décision V1 et template Meta requis | Bloqué |
| REC-03 | J8, notification interne uniquement | Rappel interne automatisé. Comportement du canal WhatsApp à vérifier après configuration | Partiel |
| REC-04 | Bilan présent avant fermeture, aucun rappel | Rappel interne couvert par les tests de l’ordonnanceur. Canal WhatsApp à vérifier | Partiel |
| REC-05 | Un employé, notification de disponibilité reçue par le propriétaire | Événement vérifié avec transport de test. VAPID et appareil requis | Partiel |
| REC-06 | Trois employés, trois notifications distinctes | Événements vérifiés avec transport de test. Réception réelle à vérifier | Partiel |
| REC-07 | Rapport WhatsApp unique du soir, business à jour uniquement | Décision V1, heure et template Meta requis | Bloqué |
| REC-08 | Guide iPhone en trois étapes | Guide couvert par les scénarios d’émulation existants. Safari physique à tester | Partiel |
| REC-09 | Propriétaire sans abonnement payé, onglet masqué | Recette hébergée à exécuter | Ouvert |
| REC-10 | Après paiement, code unique visible | Paiement FedaPay sandbox et affichage hébergé à vérifier | Ouvert |
| REC-11 | Codes de deux propriétaires générés en parallèle, sans doublon | Scénario hébergé à exécuter avec deux abonnements de test | Ouvert |
| REC-12 | Premier paiement du filleul, 30 jours offerts et aucune commission | Arbitrage des avantages et FedaPay sandbox requis | Bloqué |
| REC-13 | Liste administrateur, propriétaire et statut de chaque code | Liste paginée en CI. Origine admin et accès 2FA via SMTP de test requis pour la recette | Partiel |
| REC-14 | Refus après cinq demandes, intervalle de deux minutes | Sélection de politique disponible en code. CDC actif par défaut. Recette hébergée après arbitrage | Partiel |

## Fournisseurs et mise en service

| Intégration | Code | Configuration et preuve externe |
|---|---|---|
| Meta WhatsApp | Adaptateur OTP existant | Compte, template approuvé et destinataires de test requis |
| Turnstile | Widget et vérification serveur existants | Clés de recette et parcours navigateur requis |
| SMTP | Adaptateur existant | SMTP de test pour activation, réinitialisation partenaire et 2FA admin |
| FedaPay | Checkout, webhook et rapprochement existants | Compte sandbox requis. Live soumis à accord séparé |
| Web Push | Transport et abonnements existants | Paire VAPID et réception sur appareils physiques à vérifier |

Pour une infrastructure séparée sur Render, le tarif de calcul de base est de **13 $US/mois** (API 7 $US, PostgreSQL 256 Mo 6 $US). Le stockage additionnel est affiché à 0,30 $US/Go. Confirmer le total dans le devis de la configuration retenue, avec stockage, éventuel plan d’équipe, taxes et dépassements. Fournisseurs, hébergement des interfaces et sauvegarde hors hôte sont à chiffrer séparément. Capacité à valider avant mise en service. Sources [tarifs Render](https://render.com/pricing) et [stockage PostgreSQL](https://render.com/articles/how-much-does-cloud-application-hosting-cost-for-small-businesses).

Avant toute ouverture commerciale, valider les trois origines HTTPS, les secrets distincts, une sauvegarde hors hôte avec restauration testée, les contrôles de disponibilité et le retour arrière. Prévoir un déploiement parallèle séparé de la base de recette. Confirmer le montant et les accès fournisseurs avant engagement.
