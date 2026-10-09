# Recette Android — BilanGo

**Statut au 9 octobre 2026 : non exécutée.** Les tests Jest et l'export Android ne constituent pas une recette native. Ne marquer une ligne « OK » qu'après observation sur l'appareil indiqué.

## 1. Préparation et installation

1. Noter `git rev-parse HEAD`, le modèle, la version Android, la résolution et le mode de navigation système (gestes / trois boutons).
2. Utiliser Node **22.13 ou supérieur**, installer les dépendances du lockfile avec `npm ci`, puis `npm run check`, `npx expo-doctor` et `npm run bundle:android`.
3. Installer une version d'Expo Go compatible avec le SDK 57. Démarrer `npm start`, connecter téléphone et ordinateur au même Wi-Fi, scanner le QR code. En cas d'échec réseau, vérifier le pare-feu Node, puis utiliser `npx expo start --tunnel` si nécessaire.
4. Alternative : installer Android Studio et un AVD, démarrer l'émulateur, puis `npm run android`. Ne pas générer ou éditer `android/` à la main.
5. Pour **l'icône du lanceur et le splash**, utiliser un binaire Android de release construit par EAS : Expo Go ne reproduit pas ces éléments fidèlement. Lancer une build uniquement avec les identifiants et la configuration EAS du projet ; le livrable Play Store sera un `.aab`. Voir [BRANDING_ASSETS.md](BRANDING_ASSETS.md).
6. Sur téléphone, désactiver toute capture contenant des données personnelles réelles. Utiliser uniquement les comptes fictifs du README : OTP `123456`, PIN choisi pour le test (ex. `2468`). Rien n'est envoyé par WhatsApp ou push.

Les données métier sont en mémoire : **garder la même instance de l'application pendant le scénario multi-compte**. Un rechargement recrée les données. Session/PIN restent dans SecureStore ; les nouveaux comptes créés dans la démo ne sont pas retrouvés après reconstruction de la base. Pour changer de compte : menu → Se déconnecter → PIN oublié ou autre numéro. Attendre au moins 30 s avant un second OTP du même numéro (5 demandes maximum sur 24 h dans le mock).

## 2. Scénario complet et valeurs attendues

| Étape | Action | Résultat attendu |
| --- | --- | --- |
| D1 | Numéro 01 97 00 00 99 → OTP → nom → PIN et confirmation | Un seul choix initial « + Créer mon business » |
| D2 | Créer « Kiosque du Port », secteur Boutique, stock désactivé, rappel 20:00 | État vide rassurant, rôles Gérant et Vendeur proposés |
| D3 | Équipe → inviter 01 97 00 00 06 comme Vendeur | Invitation en attente, aucun accès avant acceptation |
| D4 | Changer de compte vers 06, OTP → nom → PIN | Invitations, dont Kiosque du Port et l'invitation fictive Chez Maman Bar |
| D5 | Accepter **Kiosque du Port** | Accueil Saisie seule ; pas d'onglet Équipe, ni abonnement propriétaire |
| D6 | Premier bilan : caisse de départ 15 000, CA 40 000, dépenses 5 000, ajouts 0 | Confirmation avant envoi ; bilan daté de Cotonou et lié au contributeur |
| D7 | Revenir à l'accueil manager | Caisse théorique **50 000 FCFA** ; aucun détail des mouvements globaux |
| D8 | Changer de compte vers 99 (après le délai OTP) | Dashboard : CA **40 000**, caisse **50 000**, contributeur visible dans Bilans |
| D9 | Propriétaire soumet son propre bilan : CA 10 000, dépenses 0, ajouts 2 000 | Aucune seconde demande de caisse de départ ; CA total **50 000**, caisse **62 000** |
| D10 | Reconnexion 06 → modifier son CA de 40 000 à 45 000 avant 24 h | Version originale conservée ; propriétaire voit CA **55 000**, caisse **67 000** |
| D11 | Propriétaire retire 06 puis 06 se reconnecte | Plus d'accès au Kiosque ; ses bilans et son nom restent visibles pour le propriétaire |

Les trois interprétations (invitation avant accès, nom demandé, un bilan/auteur/jour) restent provisoires, voir ARCHITECTURE §7. Le test automatisé du scénario D1–D8 se trouve dans `consolidation.test.tsx`.

## 3. Parcours par rôle et permissions

| ID | Manipulation | Attendu |
| --- | --- | --- |
| P1 | Koffi (01), Boutique Étoile → menu | Trois business ; business courant marqué ; CA visibles seulement selon les droits du business ; jours restants |
| P2 | Koffi → Chez Maman Bar | Dernier bilan daté et « En attente du bilan » ; périodes Aujourd'hui / 7 / 30 jours ; détail par contributeur |
| P3 | Koffi → E-Shop Cotonou | Droits Livreur/Saisie seule malgré le rôle propriétaire sur les deux autres business |
| P4 | Rodrigue (02) → historique | Seulement ses bilans ; caisse visible sans CA/dépenses/ajouts globaux ; invitations acceptables ou refusables |
| P5 | Fatou (03) → équipe / invitations | Gère les rangs inférieurs ; aucun retrait/changement du propriétaire ou d'un gérant ; aucun rôle Gestion complète proposé à l'invitation |
| P6 | Yacine (04) → dashboard / stock / bilan | Consultation seulement ; aucun bouton de saisie, ajout de stock ou gestion d'équipe |
| P7 | Koffi → rôle personnalisé « Comptable test », Lecture seule | Rôle créé, réutilisable à l'invitation ; nom doublonné rejeté ; nom invalide expliqué |
| P8 | Refuser une invitation puis revenir à l'accueil | Aucun nouveau business accessible ; invitation disparue |
| P9 | Koffi → Mon abonnement et aide abonnement | Statut, date, jours, historique ; aucun bouton, lien ou mention orientant vers un paiement externe |
| P10 | Bilan envoyé → modifier avant et après l'heure limite | Avant : heure limite et ancienne/nouvelle version ; après : bouton/badge disparus sans action ; serveur simulé refuse l'écriture |

P10 demande une attente réelle jusqu'à l'échéance dans une instance maintenue ouverte ; les tests automatisés avancent une horloge fictive. Ne pas modifier l'heure du téléphone pour prétendre avoir validé ce parcours natif.

## 4. Formulaires, stock et erreurs

1. Essayer numéro court, OTP incorrect, confirmation PIN différente et 5 PIN erronés : messages français, aucun accès indu ; après 5 erreurs, nouvel OTP requis.
2. Premier bilan sans caisse : erreur explicite, aucune écriture. Montants entiers FCFA, clavier numérique, aucun centime ni valeur négative.
3. Détailler séparément CA, dépenses, ajouts : plusieurs lignes nom/montant, total recalculé, ligne incomplète bloquante ; revenir au montant global. Les ajouts ne font pas augmenter le CA.
4. Chez Maman Bar : déclarer des ventes d'articles, vérifier le restant ; modifier les quantités d'un bilan puis vérifier le stock recalculé. Une vente excédant le restant doit être refusée. Dans Boutique Étoile, pas de module Stock.
5. Saisir une note longue, défiler jusqu'au dernier champ, envoyer et consulter le détail. Une note dépassant la limite doit être refusée.
6. Essayer nom de business vide, secteur absent, heure hors format HH:mm, invitation doublonnée, nom de rôle doublonné. Aucun formulaire bloqué définitivement après l'erreur.
7. Observer le chargement simulé et les états vides. La panne réseau n'affecte pas ce backend en mémoire : **les erreurs réseau réelles restent à recetter après intégration serveur**.
8. PDF, push, OTP réel, expiration bloquante et paiements réels : indisponibles ; consigner « non implémenté », jamais « OK ».

## 5. Accessibilité, clavier et système Android

| ID | Procédure | Critère |
| --- | --- | --- |
| A1 | Activer TalkBack dans Réglages → Accessibilité. Parcourir connexion, PIN, dashboard, menu, formulaire et invitations par balayage puis double toucher | Titres annoncés, icônes décoratives muettes, montant + contributeur + état lisibles, aucun Switch annoncé deux fois |
| A2 | Avec TalkBack, choisir un rôle, changer une période, développer l'aide | Description et état sélectionné/développé annoncés ; ordre de focus logique ; aucune action inaccessible |
| A3 | Régler police et taille d'affichage au maximum ; relancer | Aucun bouton/champ inaccessible, montant lisible, badges et lignes d'équipe non superposés ; plafond de police actuel 1,8 à évaluer |
| A4 | Petit écran ≈ 320 dp, puis Android récent en edge-to-edge | Contenu défilable ; aucun contrôle sous les barres système ; relever la marge basse éventuelle en doublon |
| A5 | Clavier téléphone, OTP, montants, nom et note multiligne | Champ actif visible ; onglets masqués sous clavier ; bouton d'envoi atteignable dans le formulaire long |
| A6 | Retour système clavier ouvert → retour sur formulaire modifié | Premier retour masque le clavier ; quitter le brouillon demande confirmation ; Annuler conserve la saisie |
| A7 | Retour système sur menu et feuille modale | Ferme le menu/la feuille ; pas de sortie accidentelle ; retour depuis un détail revient au bon business |
| A8 | Envoi réussi puis retour système | Pas de confirmation d'abandon du bilan enregistré ; pas de double envoi |
| A9 | Rotation, passage en veille, reprise et fermeture/réouverture | Portrait maintenu ; session persistante pour les comptes seed ; aucun écran étranger ; droits de modification réévalués à la reprise |
| A10 | Se déconnecter puis rouvrir avec le PIN correct | Aucun nouvel OTP ; mauvais PIN décrémente les essais ; oublier le PIN revient à la connexion |
| A11 | Alterner gestes et navigation trois boutons | Pied de formulaire et derniers éléments visibles ; barres d'état lisibles sur fond vert et clair |
| A12 | Binaire release : icône, thème monochrome Android, démarrage à froid | Œil et barres reconnaissables, pas de placeholder Expo, symbole non coupé ; fond splash #0F6E56 |
| A13 | Mesurer 3 démarrages à froid sur binaire release | Noter les durées ; cible cahier < 2 s, aucune performance affirmée sans mesure |

Les contrastes ont un contrôle automatisé ; TalkBack, grossissement et clavier exigent l'observation humaine. Le comportement edge-to-edge Android 15+ n'est pas encore validé.

## 6. Journal de recette

Copier une ligne pour chaque cas D/P/A et chaque configuration. Valeurs : **non exécuté / OK / KO / non implémenté**. Un KO doit inclure les étapes de reproduction et le résultat attendu.

| Cas | Résultat | Date | Appareil | Version Android | Build / HEAD | Remarques |
| --- | --- | --- | --- | --- | --- | --- |
| Ensemble | Non exécuté | — | — | — | — | Mission 04 : validation automatisée uniquement |

Avant démonstration client : D1–D11 et P1–P9, puis A1–A11 sur téléphone ; A12–A13 sur release. Traiter les KO bloquants avant publication.
