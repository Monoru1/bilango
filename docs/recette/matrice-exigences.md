# Traçabilité de livraison GoBilan

Matrice de travail, pas certificat de conformité. Le détail historique reste dans `docs/REQUIREMENTS_MATRIX.md`. « Code présent » ne signifie pas « livré ». Les preuves de ce lot sont dans `demo-15-novembre.md` ; chaque ligne non validée reste ouverte.

| ID / source | Exigence | Implémentation | Test | Preuve / statut | Bloqueur |
| --- | --- | --- | --- | --- | --- |
| P0-WEB / CDC §3.1 | Navigateur : installation/légal seuls, sans session API | App.tsx, useStore.ts | App.test.tsx, install-smoke.mjs | Navigation publique observée en Chrome sur la preview ; [preuve](preuves/2026-11-12-pwa-hebergee.md) | Installation physique |
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
| V12-REF / §8 | Owner après premier paiement, code unique non réattribué, crédit sans commission | Registre, attribution et journal de crédit présents ; liste et CSV sur #19 | REC-09/10/11/12/13 | Recette hébergée ouverte | Nature des jours/plafond/essai |
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

## Audit final ciblé du 12 novembre 2026

Référentiel : CDC du 19 octobre, modifications v1.2 du 1er novembre et issue #8. Base fonctionnelle auditée : #19, `e529b61`. Déployé : `13d63a0`. Les parcours historiques de démonstration restent des preuves de recette sur leur SHA. Le statut concerne la fonctionnalité et son environnement indiqué.

| Fonctionnalité | Exigence CDC | Statut | Fichiers | Test/preuve | Écart restant | Priorité |
| --- | --- | --- | --- | --- | --- | --- |
| Page publique et accès sans session | CDC §3.1, §13.2 | TERMINÉ ET VÉRIFIÉ EN DÉPLOYÉ | PWA Install.tsx, API http/app.ts | Preview 13d63a0, accueil 200 et /v1/me 401 | Écrans authentifiés et appareils traités séparément | P0 |
| Inscription WhatsApp réelle | CDC §4, §9.1 | BLOQUÉ PAR UNE DÉPENDANCE EXTERNE | PWA Auth.tsx, API integrations/configured.ts | configured-integrations.test.ts ; preview en mode OTP fictif | Meta, modèle et preuve d’un envoi autorisé | P0 |
| OTP et PIN | CDC §4.1–4.4, v1.2 §7 | PARTIEL | services/auth.ts, runtime-config.ts, domain/security.ts | auth.test.ts, http.test.ts, Playwright ; démo historique c7894fd | Recette hébergée du lot intégré, arbitrage REC-14 | P0 |
| Récupération et nouvel appareil | CDC §4.2–4.3 | IMPLÉMENTÉ ET TESTÉ EN CI UNIQUEMENT | PWA Auth.tsx, services/auth.ts | auth.test.ts et http.test.ts | OTP réel et exercice sur appareil distinct | P0 |
| Installation Android | CDC §3.2 | PARTIEL | PWA Install.tsx, public/ | e2e/install-smoke.mjs, événement synthétique | Installation depuis Chrome et ouverture depuis l’icône | P1 |
| Installation iPhone | CDC §3.3, v1.2 §6 et REC-08 | PARTIEL | PWA Install.tsx | install-smoke.mjs, guide en émulation | Safari iOS physique, fermeture et réouverture | P1 |
| Profil | CDC §4.1 | IMPLÉMENTÉ ET TESTÉ EN CI UNIQUEMENT | PWA Auth.tsx, Settings.tsx, services/auth.ts | auth.test.ts et pwa-smoke.mjs | Parcours hébergé de la V1 | P0 |
| Création de business | CDC §5.2 | IMPLÉMENTÉ ET TESTÉ EN CI UNIQUEMENT | PWA NewBusiness.tsx, services/business.ts | workspace.test.ts, pwa-smoke.mjs | Recette hébergée après intégration | P0 |
| Employés et invitations | CDC §4.5, §5 | IMPLÉMENTÉ ET TESTÉ EN CI UNIQUEMENT | services/business.ts, PWA BusinessShell.tsx | roles.test.ts, pwa-smoke.mjs | Invitation, acceptation et changement de rôle sur la recette | P0 |
| Permissions par rôle | CDC §5.3–5.4, §13.1 | IMPLÉMENTÉ ET TESTÉ EN CI UNIQUEMENT | services/access.ts, http/app.ts | roles.test.ts, tenant.test.ts | Valider les rôles sur la version hébergée | P0 |
| Bilans multi-contributeurs | CDC §6.2–6.3 | IMPLÉMENTÉ ET TESTÉ EN CI UNIQUEMENT | services/reports.ts, PWA ReportForm.tsx | reports.test.ts, concurrency.test.ts, pwa-smoke.mjs | Comparer lecture/écriture sur la recette | P0 |
| Caisse théorique | CDC §6.4 | IMPLÉMENTÉ ET TESTÉ EN CI UNIQUEMENT | services/reports.ts, PWA Home.tsx | reports.test.ts, pwa-smoke.mjs | Contrôler le recalcul après édition sur la recette | P0 |
| Stock | CDC §6.2–6.3 | IMPLÉMENTÉ ET TESTÉ EN CI UNIQUEMENT | PWA Stock.tsx, services/reports.ts | reports.test.ts, pwa-smoke.mjs | Exécuter le scénario hébergé multi-utilisateur | P0 |
| Historique et édition sous 24 h | CDC §6.5–6.6, §7.2 | IMPLÉMENTÉ ET TESTÉ EN CI UNIQUEMENT | services/reports.ts, PWA Reports.tsx | reports.test.ts, pwa-smoke.mjs | Historique et refus après délai en recette | P0 |
| PDF | CDC §7.2 | IMPLÉMENTÉ ET TESTÉ EN CI UNIQUEMENT | PWA lib/pdf.ts, Reports.tsx | pdf.test.ts, pwa-smoke.mjs | Téléchargement et lecture sur appareils physiques | P1 |
| Tableaux de bord propriétaire | CDC §7 | IMPLÉMENTÉ ET TESTÉ EN CI UNIQUEMENT | PWA Home.tsx, services/workspace.ts | workspace.test.ts, pwa-smoke.mjs | Données et rendu sur la recette | P0 |
| Essai, abonnement et blocage | CDC §7.4, §8.1–8.4 | IMPLÉMENTÉ ET TESTÉ EN CI UNIQUEMENT | services/subscriptions.ts, PWA Subscription.tsx | subscription.test.ts, pwa-smoke.mjs | Valider le renouvellement sandbox et le retour UI | P0 |
| FedaPay checkout et renouvellement | CDC §8.2–8.4 | BLOQUÉ PAR UNE DÉPENDANCE EXTERNE | integrations/configured.ts, services/subscriptions.ts | configured-integrations.test.ts, subscription.test.ts ; paiements désactivés sur preview | Compte sandbox, checkout et transaction confirmée | P0 |
| Webhooks, échecs et doublons | CDC §8.2, §13.1 | IMPLÉMENTÉ ET TESTÉ EN CI UNIQUEMENT | services/subscriptions.ts, crypto.ts, migrations 005 | subscription.test.ts, concurrency.test.ts, http.test.ts | Webhook sandbox réel, rapprochement et erreurs fournisseurs | P0 |
| SMTP transactionnel | CDC §10.2, §13.3–13.4 | BLOQUÉ PAR UNE DÉPENDANCE EXTERNE | integrations/configured.ts, services/admin.ts et partners.ts | Tests configurés et portails avec journal simulé | SMTP recette, domaine d’envoi et livraison effective | P0 |
| Turnstile | CDC §4, §13.1–13.2 | BLOQUÉ PAR UNE DÉPENDANCE EXTERNE | PWA Auth.tsx, integrations/configured.ts | configured-integrations.test.ts ; captcha dev sur preview | Clés et vérification navigateur dans le domaine attendu | P0 |
| Web Push | CDC §9.2–9.3, v1.2 §4 | BLOQUÉ PAR UNE DÉPENDANCE EXTERNE | services/push.ts et jobs.ts, PWA public/sw.js | push.test.ts, v12-closing-notifications.test.ts | VAPID, consentement et notifications reçues sur appareils | P1 |
| Rappels internes et fermeture | CDC §6.7, v1.2 §2–4 | IMPLÉMENTÉ ET TESTÉ EN CI UNIQUEMENT | services/jobs.ts, domain/notifications.ts | v12-closing-notifications.test.ts, REC-01/05/06 en simulation | Vérifier exécution et réception réelle par fuseau | P1 |
| Rappels et rapport WhatsApp | v1.2 §3, §5, §9, REC-02/03/04/07 | BLOQUÉ PAR UNE DÉPENDANCE EXTERNE | services/jobs.ts, integrations/configured.ts | Aucune preuve d’envoi réel | Arbitrage V1, horaire, coût, consentement, templates puis implémentation des flux | P1 |
| Portail agent et manager | CDC §10.2, §10.5–10.6 | IMPLÉMENTÉ ET TESTÉ EN CI UNIQUEMENT | apps/partners, services/partners.ts | partners.test.ts, portals-smoke.mjs | Site distinct et essais de rôle hébergés | P0 |
| Portail influenceur | CDC §10.7 | IMPLÉMENTÉ ET TESTÉ EN CI UNIQUEMENT | apps/partners, services/partners.ts | partners.test.ts | Tableau et données en recette | P0 |
| Parrainage partenaire, commissions et historique | CDC §10.8–10.10 | IMPLÉMENTÉ ET TESTÉ EN CI UNIQUEMENT | services/partners.ts, commission-ledger.ts, subscriptions.ts | partners.test.ts, concurrency.test.ts, portals-smoke.mjs | Paiement sandbox et contrôle des écritures | P0 |
| Activation et réinitialisation partenaires | CDC §10.2, §13.3 | BLOQUÉ PAR UNE DÉPENDANCE EXTERNE | services/partners.ts et otp.ts, apps/partners | partners.test.ts, portals-smoke.mjs simulé | Réception SMTP et parcours hébergé | P0 |
| Connexion admin forte et 2FA | CDC §13.4 | BLOQUÉ PAR UNE DÉPENDANCE EXTERNE | services/admin.ts et otp.ts, apps/admin | admin-allowlist.test.ts, http.test.ts, portals-smoke.mjs simulé | Portail lié et OTP reçu via SMTP réel | P0 |
| Autorisations et gestion des partenaires | CDC §10.4, §13.4 | IMPLÉMENTÉ ET TESTÉ EN CI UNIQUEMENT | services/admin.ts, http/app.ts, apps/admin | http.test.ts, admin-allowlist.test.ts, portals-smoke.mjs | Preuve des refus et de l’allowlist en recette | P0 |
| Commissions et versements admin | CDC §10.8–10.10 | IMPLÉMENTÉ ET TESTÉ EN CI UNIQUEMENT | services/admin.ts et commission-ledger.ts, apps/admin | partners.test.ts, concurrency.test.ts, portals-smoke.mjs | Recette des états et rapprochement, paiement réel séparé | P0 |
| Parrainage propriétaire | v1.2 §8, REC-09–12 | PARTIEL | services/owner-referrals.ts, auth.ts, subscriptions.ts, migrations 006–007 | owner-referrals.test.ts ; récompense journalisée | Arbitrer la consommation des 30 jours et valider les parcours sandbox | P1 |
| Liste, compteurs, recherche et export admin | v1.2 §8.6, REC-13 | IMPLÉMENTÉ ET TESTÉ EN CI UNIQUEMENT | services/admin.ts, http/app.ts, admin Operations.tsx | #19, http.test.ts, portail Playwright | Affichage et téléchargement en recette admin | P1 |
| Désactivation auditée du code | v1.2 §8.6 et SEC-48 cité | NON COMMENCÉ | services/admin.ts, http/app.ts, admin Operations.tsx | Le statut est lu, aucune action admin attestée | Implémenter motif et journal transactionnel | P1 |
| Statistiques d’audience et entonnoir | v1.2 §12 et entonnoir | NON COMMENCÉ | apps/admin, collecte autorisée à définir | Aucune preuve pour ce périmètre ; statistiques admin existantes distinctes | Source, anonymat, exclusions, export et arbitrage APDP | P1 |
| Journal admin | CDC §13.4 | IMPLÉMENTÉ ET TESTÉ EN CI UNIQUEMENT | services/admin.ts, migrations 001–002 | admin-allowlist.test.ts, portals-smoke.mjs | Accès et consultation en recette, intégrité du journal opérationnel | P0 |
| Isolation multi-tenant | CDC §5.4, §13.1 | IMPLÉMENTÉ ET TESTÉ EN CI UNIQUEMENT | services/access.ts, tenant.test.ts | tenant.test.ts, http.test.ts, pwa-smoke.mjs | Rejouer entre business hébergés avec comptes fictifs | P0 |
| Signature proxy et quotas directs | CDC §4.4, §13.2 | IMPLÉMENTÉ ET TESTÉ EN CI UNIQUEMENT | Edge api-client-ip.js, http/client-ip.ts et app.ts | client-ip.test.ts, auth.test.ts, concurrency.test.ts | Déployer #18 et vérifier la chaîne Edge–Render | P0 |
| Sessions, cookies et CSRF | CDC §13 | IMPLÉMENTÉ ET TESTÉ EN CI UNIQUEMENT | http/app.ts, services/auth.ts, partners.ts et admin.ts | http.test.ts, auth.test.ts, portals-smoke.mjs | Vérifier cookies et refus par origine déployée | P0 |
| XSS et exposition de secrets en service | CDC §13.1, §13.6 | NON VÉRIFIÉ | React, netlify.toml, runtime-config.ts | Marqueur factice absent des trois builds #18 | Vérifier CSP et rendu réel, stockage des secrets et journal expurgé | P0 |
| PostgreSQL de recette | CDC §13.1 et livraison | PARTIEL | db.ts, recette-migration-guard.ts | /ready 200 sur 13d63a0, preuves historiques de persistance c7894fd | Inventaire du schéma et restauration hébergée non rejoués | P0 |
| Migrations protégées | CDC §13 et exploitation | IMPLÉMENTÉ ET TESTÉ EN CI UNIQUEMENT | recette-migration-guard.ts, migrate-render-recette.ts | recette-migration-guard.test.ts, render-recette-target.test.ts | Confirmer schéma en lecture seule, sauvegarder avant opération autorisée | P0 |
| Sauvegarde et restauration | CDC §13 et issue #8 | PARTIEL | scripts/acceptance-backup.sh, test-backup-restore.mjs | Jobs postgres et acceptance-container ; restauration isolée verte | Copie hors hôte et essai de restauration de recette | P0 |
| Supervision commerciale | Issue #8, disponibilité | PARTIEL | http/app.ts, docs d’exploitation | /health et /ready vérifiés sur la recette | Alerte, rétention des journaux, capacité et reprise opérationnelle | P2 |
| PWA et API de recette déployées | Issue #8, CDC §3–4 | TERMINÉ ET VÉRIFIÉ EN DÉPLOYÉ | Netlify PWA et service Render | 13d63a0 sur les deux ; réponses HTTP vérifiées | Publication de la V1 intégrée reste distincte | P0 |
| Portails déployés et production commerciale | CDC §10.1, issue #8 | BLOQUÉ PAR UNE DÉPENDANCE EXTERNE | apps/{admin,partners}/netlify.toml, Dockerfile.api | Build CI vert ; recherche Netlify ne retourne que gobilan-pwa | Raccordement, origines, devis et autorisation de mise en service | P0 |
