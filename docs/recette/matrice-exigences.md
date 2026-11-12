# Traçabilité de livraison GoBilan

Matrice de travail, pas certificat de conformité. Le détail historique reste dans `docs/REQUIREMENTS_MATRIX.md`. « Code présent » ne signifie pas « livré ». Les preuves de ce lot sont dans `demo-15-novembre.md` ; chaque ligne non validée reste ouverte.

| ID / source | Exigence | Implémentation | Test | Preuve / statut | Bloqueur |
| --- | --- | --- | --- | --- | --- |
| P0-WEB / CDC §3.1 | Navigateur : installation/légal seuls, sans session API | App.tsx, useStore.ts | App.test.tsx, install-smoke.mjs | Tests locaux et E2E CI trois moteurs réussis | Recette déployée |
| P0-DEMO / mission §1 | ?demo=1 ne contourne pas le site public | useStore.ts, App.tsx | App.test.tsx, install-smoke.mjs | Flag build explicite, aucun repli API | Démo métier hébergée séparée |
| P0-ANDROID / CDC §3.2 | beforeinstallprompt, manifest, icônes, SW, HTTPS | Install.tsx, public/, netlify.toml | screens.test.tsx, install-smoke.mjs | Événement synthétique distingué d'une installation réelle | Appareil physique |
| P0-IOS / v1.2 §6 | Guide visuel trois étapes, fermer puis réouvrir volontairement | Install.tsx | screens.test.tsx, install-smoke.mjs | Unitaires et E2E trois moteurs réussis : fermeture persistée, focus et Échap | Safari physique |
| P0-INAPP / CDC §3.4 | Invitation à ouvrir Chrome/Safari | lib/env.ts, Install.tsx | env.test.ts, install-smoke.mjs | UA simulée ; WhatsApp réel à vérifier | Navigateur WhatsApp physique |
| P0-API / mission §1 | Pas de crash /v1/me, pas de HTML de SPA pour API | ui/http.ts, RemoteStore.ts, configure-netlify.mjs | http.test.ts, RemoteStore.test.ts, netlify-routing.test.ts | Erreurs contrôlées et proxy existant PR #7 repris | API persistante hébergée |
| AUTH / CDC §4 | Pays, OTP, PIN, nouvel appareil, CAPTCHA, récupération | Auth.tsx, services/auth.ts, integrations/ | auth/http/configured-integrations tests, pwa-smoke.mjs | Code repris PR #7, validation distante restante | Meta/Turnstile configurés et recette autorisée |
| RBAC / CDC §5/13 | Isolation, rangs, révocation logique, invitations | requireAccess, business/workspace services | tenant/roles/workspace/concurrency tests, pwa-smoke.mjs | Contrôles serveur conservés | Recette déployée |
| REPORTS / CDC §6 | Multi-auteurs, caisse, stock, édition 24h/version/recalcul | domain + reports service + PWA | report/workspace tests, pwa-smoke.mjs | Code présent ; état détaillé matrice historique | Recette déployée |
| DASHBOARD / CDC §7 | Périodes, dernier bilan, aide, PDF | Home/Reports/Help, lib/pdf.ts | domain/PWA + pwa-smoke.mjs | Code présent | Recette mobile complète |
| SUB / CDC §8 | 7j, 2000 FCFA/30j, grâce 3j, blocage J4, pas de rattrapage | domain/subscriptions + PWA | subscription/tenant + pwa-smoke.mjs | Aucune confirmation sur retour navigateur | FedaPay sandbox autorisé |
| PUSH / CDC §9 | Événements sans montants, badge et permission au bon moment | push/jobs + SW/PWA | push/scheduler/RemoteStore tests | Adaptateur configuré repris PR #7 | VAPID et appareils physiques |
| PARTNERS / CDC §10/annexe D | Activation, accords, commissions, cloisonnement | apps/partners + services | partners/admin/concurrency + portals-smoke.mjs | Code présent ; pas de validation externe déclarée | SMTP, recette métier |
| ADMIN / CDC §10/13 | Admin séparé, allowlist/2FA, versements append-only | apps/admin + services/migrations | admin/allowlist/concurrency + portals-smoke.mjs | Code présent | SMTP + comptes autorisés |
| UI-LEGAL / CDC §11/12/annexes | Mobile, palette, textes intégraux et confidentialité | UI partagé, LegalPage et assets | screens/App + install smoke | PDF archivés, textes comparés | Revue juridique et appareils |
| OPS / CDC §13 | HTTPS, secrets serveur, backup/restore, quotas, logs | runtime-config, compose, scripts | runtime/crypto/tenant, CI postgres et acceptance-container | Infrastructure de recette existante reprise | Hébergement et sauvegarde hors hôte |
| V12-CLOSE / §2 | Heure fermeture configurable, bonne zone IANA | domain/notifications.ts + countries.ts (timeZone), contrat `closingTime`, BusinessService.createBusiness, ClosingTimeField (création, onboarding, profil par business) | domain notifications.test.ts (fuseaux vérifiés contre l'ICU), api v12-closing-notifications.test.ts, screens.test.tsx, pwa-smoke.mjs | REC-01 volet notifications internes automatisé (voir REC ci-dessous) | Rappel WhatsApp exclu tant que §9 non tranché |
| V12-REMIND / §3 | WhatsApp jours 1–7, sans lien, aucun si bilan envoyé | À compléter après décision | REC-02/03/04 | Ouvert | Décision V1, consentements/templates |
| V12-INTERNAL / §4 | Notification selon nombre employés | domain `ownerReportNotice`, ReportService.submit, contrat push `report_available`/`authorFirstName`, sw.js sans tag commun | api v12-closing-notifications.test.ts, service-worker.test.ts | REC-05/06 automatisés avec transport Push Dev | VAPID + appareil physique pour la réception réelle |
| V12-EVENING / §5 | Un seul rapport patron, business à jour uniquement | À implémenter | REC-07 | Ouvert | Décision V1, horaire, Meta |
| V12-IOS / §6 | Guide fermé ne revient qu'à la demande | P0-IOS ci-dessus | REC-08 + écrans/E2E installation | Partiel : tests représentatifs à consigner | Installation physique |
| V12-OTP / §7 | 5 demandes/24h, cadence 2 min, quotas globaux | Politique WhatsApp configurable, CDC par défaut | auth.test.ts, runtime-config.test.ts | Test local de la v1.2 ; recette hébergée ouverte | Arbitrage CDC / v1.2 |
| V12-REF / §8 | Owner après premier paiement, code unique non réattribué, crédit sans commission | À implémenter dans domain/contracts/API/PWA/admin | REC-09/10/11/12/13 | Ouvert | Nature des jours/plafond/essai |
| V12-METRICS / §12/13 | Analytics anonymes, funnel, CSV, admins seuls, audit accès | À implémenter | Tests isolation/agrégats/CSV à créer | Ouvert | Politique anonymat/APDP, exclusions équipe |

## REC-01 à REC-14

Le lot P0 cible REC-08. Le lot P1 du 5 novembre (voir `demo-15-novembre.md`, section « Lot P1 ») automatise :

| REC | Résultat automatisé | Limite |
| --- | --- | --- |
| REC-01 | 18:00 à la création puis 21:30 : stocké côté serveur (E2E trois moteurs) ; le rappel interne part à 18:05 puis plus à l'ancienne heure, et à 21:35 après modification (API, PGlite + PostgreSQL) | Volet « rappels WhatsApp » non implémenté (décision §9) |
| REC-05 | Un employé : `report_available`, texte « Le bilan de [Business] est disponible » | Transport Push Dev ; réception physique non testée |
| REC-06 | Trois employés : trois notifications `report_sent` avec prénom, sans montant ni tag commun | Idem |

REC-02/03/04/07 (WhatsApp) et REC-09–14 restent **non recettés**. Aucun transport externe n'est validé par un double HTTP ou un journal Dev. Compléter les résultats un par un avec commit, commande, appareil/environnement et pièce de preuve.

Preuve transversale du lot : commit `2eba05d`, [CI six jobs réussis](https://github.com/Monoru1/bilango/actions/runs/42032534589), preview et captures référencées dans `demo-15-novembre.md`. Les limites physiques et fournisseurs ne sont pas levées par ces résultats.
