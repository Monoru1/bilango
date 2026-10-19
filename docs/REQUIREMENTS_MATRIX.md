# Matrice des exigences
Statuts : IMPLEMENTED = code présent ; TESTED = test exécuté vert ; un mock n'est pas opérationnel.

| ID | CDC | Fonction | Prio | Statut | Modules | Tests | Blocages |
|---|---|---|---|---|---|---|---|
| R01 | 3 | Page d'installation PWA / guide iPhone | V1 | IMPLEMENTED (captures iOS non fournies) | pwa/Install | screens | assets client |
| R02 | 4 | OTP 4 chiffres, PIN, verrouillage (API) | V1 | TESTED | api, domain | oui | WhatsApp réel : stub |
| R03 | 4 | Auth dans la PWA | V1 | IMPLEMENTED en DEMO uniquement | pwa/demo | oui | client HTTP non branché |
| R04 | 5 | Bilan, caisse théorique, 24 h, double version | V1 | TESTED (domain+API) ; PWA en DEMO | domain, api | oui | |
| R05 | 5 | PDF du bilan | V1 | TESTED | pwa/pdf | oui | |
| R06 | 6 | Abonnement, essai, grâce, blocage | V1 | TESTED (domain/API) | domain, api | oui | |
| R07 | 6 | Paiement FedaPay | V1 | IMPLEMENTED webhook ; live BLOCKED | api | oui (simulé) | compte FedaPay, RCCM/IFU |
| R08 | 7 | Notifications push / pastille | V1 | TODO (stub) | | non | VAPID |
| R09 | 10 | Portail partenaires | V1 | TESTED API + smoke e2e | partners, api | oui | e-mail réel |
| R10 | 10.8 | Commissions, journal append-only | V1 | TESTED | domain, api | oui | |
| R11 | 10.9 | Versements manuels, seuil, report | V1 | TESTED | domain, api | oui | |
| R12 | 13.4 | Admin : partenaires, versements, journal | V1 | IMPLEMENTED/TESTED partiel | admin, api | smoke | |
| R13 | 13.4 | Admin : allowlist avec confirmation e-mail, exclusion parrainage, changement de rôle (UI) | V1 | TODO | | non | |
| R14 | 13.4 | 2FA admin par e-mail | V1 | IMPLEMENTED (code) ; envoi réel stub | api | oui | SMTP |
| R15 | annexes | Pages légales / accords | V1 | IMPLEMENTED | ui | oui | validation juriste béninois |
| R16 | 14 | V2 (anomalies, graphes, multi-langue, offline) | V2 | TODO | | | |
