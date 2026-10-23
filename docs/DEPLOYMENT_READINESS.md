# Préparation au déploiement — 19 octobre 2026

**Décision : NO-GO production.** La V1 dispose maintenant de parcours PWA réellement persistants et de validations SQL/navigateur, mais plusieurs services et obligations V1 restent incomplets. Rien n'a été déployé et aucun vrai paiement/envoi n'a été effectué.

## Préparation vérifiée

- Branche d'intégration séparée, historique Claude conservé, main inchangée.
- Client HTTP par défaut ; démo explicite avec ?demo=1, désactivable via VITE_ALLOW_DEMO_BYPASS=0.
- Inscription/PIN, profil, business, rôles, invitations, bilans, versions, stock et dashboard intégrés.
- Abonnement consultable après blocage, paiements simulés exclus du mode HTTP.
- PostgreSQL réseau, concurrence, rollback, isolation et idempotence testés.
- Portails partenaires/admin et contrôle e-mail de l'allowlist exécutés dans Chromium.
- Correction coordonnées, exclusion parrainage et suivi abonnements accessibles admin.
- Édition/archivage des rôles ; transitions de rôle partenaire autorisées avant obligations avec nouvel accord obligatoire. Un compte portant déjà une équipe/parrainages/commissions reste conservé : le nouveau rôle utilise un compte distinct.
- jsPDF corrigé et export téléchargé/vérifié ; audit des dépendances production sans vulnérabilité au contrôle indiqué dans TEST_REPORT.

## Blocages externes

1. Comptes au nom de Novadis Digital : WhatsApp Business, CAPTCHA, SMTP, FedaPay Business/sandbox (RCCM/IFU), VAPID/Web Push. Brancher les vrais adaptateurs et rejouer les scénarios avec les réponses externes, signatures et statuts officiels.
2. Domaines distincts, HTTPS, reverse proxy /v1, origines exactes, politique CSP/headers du frontend, secrets gérés et rotation.
3. Sauvegardes automatiques, restauration effectivement exécutée, exploitation et accès DB nominatifs ; deuxième adresse admin effective et dispositif de récupération.
4. Revue des textes par un juriste au Bénin, validation client des hypothèses D-004, D-014 et D-018 notamment ; logo/visuels iOS officiels.

## Travail local restant pour V1

- Web Push : abonnements, rappels, échéances et rapprochement horaire sont livrés et testés avec transport Dev. Reste le transport réel (bibliothèque web-push + clés VAPID), non implémenté volontairement faute de clés ; variables à fournir : VAPID_PUBLIC_KEY (et clé privée côté transport). Planificateur en processus : à exécuter sur UNE instance ou à laisser la déduplication en base protéger (clé unique), à confirmer à l'exploitation.
- Captures/vidéo d'installation iOS et tests sur Android/iPhone physiques (installabilité, standalone, notifications et clavier).
- Validation du checkout FedaPay embarqué ; mode HTTP indique explicitement l'indisponibilité des paiements Dev.
- Volumétrie et pagination : le workspace charge tout l'historique autorisé de tous les business pour calculer correctement la caisse. Il faut dissocier agrégats serveur et pages d'historique avant de viser des comptes volumineux / smartphones modestes.
- Audit d'accessibilité et responsive tablette/desktop approfondi ; portails à améliorer pour certaines erreurs de lecture et renouvellements de session.

## Déploiement futur

Le serveur maintient volontairement son refus de démarrer en production. Le retirer seul serait dangereux : il faut d'abord remplacer les fournisseurs Dev, tester leurs échecs et respecter les points ci-dessus. Cette branche ne constitue ni une validation client ni une autorisation de mise en production.
