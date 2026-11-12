# GoBilan V1 commerciale — livraison prévue le 15 novembre 2026

**État au 12 novembre — NO-GO commercial.** La preview et l’API de recette sont accessibles. La navigation publique a été vérifiée dans Chrome. Le proxy IP, la politique OTP, le lanceur Playwright et les deux portails sont réunis sur la branche temporaire d’intégration. Le déploiement des changements et leur validation hébergée attendent l’autorisation d’intégration.

- [Validation locale du proxy](https://github.com/Monoru1/bilango/blob/e529b61f454b69111edab136682d43c4732a40f2/docs/recette/preuves/2026-11-12-proxy-client-ip.md)
- [Contrôles de la preview et commande Playwright](https://github.com/Monoru1/bilango/blob/e529b61f454b69111edab136682d43c4732a40f2/docs/recette/preuves/2026-11-12-pwa-hebergee.md)
- [Preuves antérieures Render et PostgreSQL](preuves/2026-11-12-recette-render.md)
- [Modèle de sécurité et activation du proxy](https://github.com/Monoru1/bilango/blob/e529b61f454b69111edab136682d43c4732a40f2/docs/SECURITY_MODEL.md)
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

## Verdict de passation du 12 novembre

**NO-GO commercial.** Render et la preview Netlify servent `13d63a0`, alors
que les changements de livraison et de suivi sont sur #18 et #19 ouvertes.
Les preuves HTTP de la recette et les sept CI vertes couvrent deux périmètres
différents. Aucun paiement Live ni déploiement commercial n’a été vérifié.

| Sujet de sécurité | Constat et vérification restante |
| --- | --- |
| IP et HMAC | Vérification par HMAC, comparaison en temps constant, méthode et URL liées à la preuve, fenêtre courte et normalisation IPv4/IPv6. Aucun nonce individuel attesté. La fenêtre de fraîcheur limite le rejeu sans établir un usage unique. Vérifier confidentialité du transport, horloges et absence de preuves dans les journaux de recette. |
| Quotas et accès direct | Le trafic sans preuve fiable utilise un quota partagé distinct lorsque la clé est active. Les tests isolés couvrent la concurrence et l’indépendance des quotas. Confirmer en recette l’impact opérationnel du quota partagé et la conservation du contrôle par numéro et appareil. |
| OTP/PIN et sessions | Contrôles serveur et audience vérifiés en CI. Vérifier le mode réel sans OTP fictif, l’expiration, la récupération, la révocation, les cookies et le CSRF avec les origines hébergées. |
| Business et administration | Tests d’isolation, d’allowlist, de permissions et de refus hors admin verts. Rejouer sur les trois origines. La désactivation auditée SEC-48 reste à coder. |
| Webhooks et commissions | Signature, événements dédupliqués, transitions transactionnelles et calculs couverts en CI. Vérifier sandbox, doublons reçus côté fournisseur et rapprochement des écritures avant accord Live. |
| CSV, XSS et secrets | #19 neutralise les formules et réserve l’export aux admins. Le marqueur factice ne figure pas dans les bundles #18. Vérifier CSP et journaux hébergés après intégration, avec sortie expurgée. |
| Dépendances | Zéro vulnérabilité production signalée dans le job check de #18. Rejouer l’audit sur le SHA réellement livré. |

Aucune vulnérabilité critique démontrée dans le périmètre vérifié pendant cette
passation. Les vérifications restantes se rejouent via les suites indiquées
dans la [matrice](matrice-exigences.md) et, après autorisation, sur la recette
avec des données fictives.

**Dépendances de livraison.** P0 : faire tourner les tests locaux ciblés,
obtenir l’accord de fusion, déployer les builds correspondants, établir les
trois origines, vérifier les parcours hébergés et fournisseurs, contrôler
sauvegarde et restauration. P1 : SEC-48 et tests des parrainages, puis rappels,
rapport du soir, statistiques et export après arbitrages applicables. P2 :
réunir les preuves REC-01 à REC-14, valider les appareils physiques, rédiger les
guides et consigner surveillance et retour arrière. Les fichiers, scénarios et
critères détaillés sont dans le [prompt de reprise](../CLAUDE_REPRISE_LIVRAISON_FINALE_15_NOV_2026.md).

L’issue #8 conserve la démo du 15 novembre et la livraison du 1er décembre.
L’instruction du 12 novembre fixe la V1 finale au 15 novembre. Le complément
sécurité cité par la v1.2 et les arbitrages contractuels restent à obtenir.
