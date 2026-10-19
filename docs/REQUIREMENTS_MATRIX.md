# Matrice V1 — intégration et recette locale (19 octobre 2026)

Référence : CDC du 19 octobre 2026. « Conforme » signifie validé dans le périmètre indiqué, pas homologué en production. Les fournisseurs Dev ne constituent pas des services externes opérationnels.

| ID | Exigence | État | Preuve / limite |
|---|---|---|---|
| R01 | Installation obligatoire, Android/iOS, navigateurs intégrés | partiel | Manifest, SW, détection et tests ; aucune installation physique homologuée ; captures/vidéo Safari absentes |
| R02 | Onboarding / identité / pays / PIN | conforme en développement intégré | Parcours navigateur avec API HTTP et PostgreSQL ; saisie PIN côté serveur |
| R03 | WhatsApp OTP / CAPTCHA réels | simulé / bloqué production | Codes Dev dans console serveur, jamais dans réponse HTTP ; jeton CAPTCHA de développement explicitement marqué |
| R04 | Sessions persistantes / nouvel appareil / PIN oublié | conforme API, partiel navigateur | Cookies httpOnly ; OTP, reset, révocation et quotas testés ; bouton déconnecter anciens appareils branché |
| R05 | Création et sélection de business | conforme | PostgreSQL + navigateur ; anti-abus essais numéro/appareil, concurrence testée |
| R06 | Rôles, invitations, acceptation, retrait logique | conforme pour création, édition et archivage sécurisé | API et PWA réelles ; entrée seule filtrée serveur ; propriétaire protégé ; rôle attribué/invité non archivable |
| R07 | Bilans, caisse initiale, contributions | conforme | Création persistante et agrégation vérifiées navigateur/API/SQL |
| R08 | Modification sous 24 h, versions conservées | conforme | Parcours employé exécuté ; auteur et délai contrôlés côté serveur ; append-only |
| R09 | Historique / dashboard / caisse | conforme fonctionnellement | Historique complet autorisé, aucune troncature comptable ; volumes importants à optimiser |
| R10 | Stock facultatif | conforme pour articles et ventes | Quantités globales serveur sans fuite des bilans d'autrui ; dernier article concurrent testé ; réapprovisionnement non livré |
| R11 | PDF texte pur | conforme | Téléchargé depuis le navigateur ; texte extrait et rendu visuel contrôlés ; jsPDF mis à jour |
| R12 | Essai 7 j, 2000 FCFA/30 j, grâce et blocage | conforme API / UI expiration | Tests domaine/API ; propriétaire accède à l'abonnement après blocage ; employé voit message neutre |
| R13 | FedaPay externe sandbox / live | simulé / bloqué | DevGateway, signatures, identité exacte transaction, re-vérification, idempotence et fixtures testés ; aucune validation du protocole fournisseur externe |
| R14 | Rapprochement périodique | partiel | Méthode reconcilePending testée ; planification horaire non installée |
| R15 | Rappels / notifications / pastille | simulé / partiel | Payloads neutres et SW présents ; ni abonnement push serveur réel, ni ordonnanceur rappels |
| R16 | Portail partenaires e-mail / activation / accords | fonctionnel et testé localement, canal simulé | Chromium Windows : manager, agent et influenceur activés, accord obligatoire, connexion sans 2FA partenaire, bloc Paiement agent persisté ; aucun e-mail réel |
| R17 | Codes, attribution, commissions, plafonds | conforme aux règles codées | Domaine et API, taux figés ; exclusions manuelles ; hypothèses D-004/D-014/D-018 à valider client |
| R18 | Versements 1er/15, seuil, frais, annulations | conforme en tests API | Journal append-only, doubles versements refusés ; aucun transfert réel, validation manuelle après virement hors app |
| R19 | Administration 2FA / allowlist | conforme en Dev intégré | Confirmation e-mail, révocation, minimum deux adresses ; code lié au challenge ; scénario navigateur exécuté |
| R20 | Admin : partenaires, exclusions, coordonnées, abonnements | partiel | UI/API ajoutées ; coordonnées chiffrées/auditées, abonnements paginés ; changement de rôle avant obligations uniquement, nouvel accord et révocation des sessions |
| R21 | Isolation et permissions serveur | conforme dans les scénarios exécutés | IDOR et retrait membre refusés ; entrée seule sans équipe, autres bilans ni historique paiements |
| R22 | Quotas / CSRF / secrets / cookies | partiel pour production | CSRF et Origin, cookies par audience, proxy non fiable refusé ; limites distribuées et infrastructure TLS à configurer |
| R23 | Réseau / erreurs / chargement | conforme parcours testés | Perte de réponse, identifiant d'envoi stable, panne réseau réelle interceptée dans Chromium et bouton Réessayer ; pas d'écriture hors-ligne |
| R24 | Design et accessibilité | partiel / écarts ouverts | Dashboard PWA et quatre profils portails à 320/390/768/1440px ; en-têtes et code promo corrigés. Guide iPhone : focus, Tab, Échap, restauration, mouvement réduit exécutés. Contrastes, menus/pop-ups, lecteur d'écran et Safari physiques non homologués |
| R25 | Pages légales | partiel | Textes fournis conservés ; revue juriste béninois non faite |
| R26 | CI / tests de persistance / E2E | conforme localement, CI distante à consulter | Check, PostgreSQL réseau et Chromium exécutés ; jobs dédiés ajoutés, aucun statut GitHub inventé |
| R27 | Sauvegardes, restauration, exploitation | absent / bloqué | Aucun hébergement de production ni restauration réelle configurés |
| R28 | V2 | absent volontairement | Anomalies, fonctionnalités offline, multilingue, etc. hors mission V1 |

Les écarts et dépendances restent explicitement ouverts dans DEPLOYMENT_READINESS.md.

## Lecture de la recette Windows

Les résultats antérieurs Linux ne remplacent pas cette recette. Voir `LOCAL_ACCEPTANCE_REPORT.md` et `TEST_REPORT.md` pour les commandes exécutées, ainsi que `LOCAL_SETUP.md` pour reproduire.

| Catégorie demandée | Éléments concernés |
|---|---|
| Fonctionnel et testé | PWA HTTP/PostgreSQL, propriétaire/entry/full/readonly, bilans/versions/stock, isolation, export, panne API/réessai, blocage ; activation/connexion des trois rôles partenaires ; 2FA/admin/allowlist/audit/abonnements/calendrier |
| Fonctionnel mais non testé intégralement dans le navigateur | PIN oublié et réinitialisation partenaire jusqu'au bout (API testée), copie presse-papiers, refus d'invitation, correction/validation financière non nulle par UI, navigation de chaque écran sur chaque largeur |
| Simulé | OTP WhatsApp, e-mails/2FA/activation, CAPTCHA, passerelle de paiement et push Dev ; signal standalone et user-agent Safari/iPhone dans Chromium ; accords et comptes des fixtures |
| Non implémenté | Planification des rappels/rapprochement, abonnement push serveur complet, réapprovisionnement stock, captures/mini-vidéo Safari |
| Bloqué par un service externe | WhatsApp/SMTP/CAPTCHA/FedaPay/Web Push opérationnels, appareils physiques, revue juridique et exploitation de production |
| Non conforme ou à arbitrer | Guide iOS incomplet ; contraste non homologué ; plusieurs erreurs de lecture des portails absorbées ; états de réinitialisation PIN et libellés UX ; ambiguïté Gestion complète §5.3 / navigation manager §5.5 ; logo officiel à comparer |

Les tableaux financiers des portails ont été consultés avec des états vides. Les commissions, frais, seuils, annulations et journal immuable sont vérifiés en API/SQL avec fournisseurs Dev ; ce n'est pas la preuve d'un paiement ou versement externe. Aucun transfert ni notification réelle n'a eu lieu.
