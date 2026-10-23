# Blocages restants (humains / externes)

Mis à jour : 23 octobre 2026. Rien ci-dessous n'est simulé comme réussi : chaque point exige un accès, une clé ou une décision que seule l'équipe Novadis Digital peut fournir.

| # | Blocage | Pourquoi je ne peux pas le lever | Action attendue |
|---|---|---|---|
| 1 | Transport Web Push réel | Exige des clés VAPID au nom de Novadis ; `PushTransport` est une interface, seule la version Dev existe | Générer les clés VAPID (stockées hors dépôt), puis brancher une implémentation `web-push` et rejouer le test avec un vrai navigateur |
| 2 | WhatsApp Business OTP, CAPTCHA, SMTP | Comptes externes ; aucun envoi réel autorisé | Fournir les comptes sandbox/test |
| 3 | FedaPay Sandbox puis Live | Comptes, clés et RCCM/IFU requis ; mode Live interdit sans autorisation explicite | Fournir les clés Sandbox ; autorisation écrite avant tout Live |
| 4 | Tests sur téléphones physiques | Installation Android/iPhone, standalone, notifications | Session de recette sur appareils |
| 5 | Sauvegardes et restauration | Pas d'accès à une infrastructure réelle | Mettre en place et exécuter une restauration |
| 6 | Validation juridique (CGU, confidentialité, §12) | Revue par un juriste au Bénin | Relecture ; aucun texte juridique modifié ici |
| 7 | Validation client des interprétations | D-004, D-014, D-018, D-020 à D-025 | Confirmer ou corriger |
| 8 | Déploiement | Interdit sans accord ; le serveur refuse NODE_ENV=production | Accord explicite |
