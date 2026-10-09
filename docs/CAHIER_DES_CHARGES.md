Cahier des charges — BilanGo, SaaS de suivi à distance pour propriétaires de business
1. Contexte et objectif
Application mobile (Android, Play Store) permettant à un propriétaire de business (bar, restaurant, boutique — modèle adaptable à tout secteur) de suivre à distance l'activité quotidienne de son établissement (chiffre d'affaires, dépenses, caisse, stock, présence de son personnel) sans avoir besoin d'être physiquement sur place.
Le manager/employé sur place saisit un bilan simple en fin de journée. Le propriétaire consulte ce bilan depuis son téléphone, où qu'il soit.
Marché cible de lancement : propriétaires de bars, restaurants, buvettes et boutiques de quartier à Cotonou, Bénin. Business avec un gérant/employé sur place et un propriétaire pas toujours présent.
Marché cible : au-delà des business physiques (bars, restaurants, boutiques), l'app s'adresse à toute personne ayant besoin qu'on lui fasse un bilan journalier à distance — par exemple un e-commerçant qui ajoute ses livreurs ou ses closers pour qu'ils lui fassent le bilan de fin de journée. Le concept reste générique : un "propriétaire" absent, une ou plusieurs personnes sur le terrain qui rapportent l'activité du jour.
Proposition de valeur : le propriétaire n'a plus besoin d'être sur place pour connaître l'activité de son commerce ; il récupère de la visibilité qu'il n'avait pas avant (fini le cahier papier illisible ou non consulté), et dispose d'un outil de contrôle de sa caisse pour limiter la fuite d'argent.
Société éditrice : Novadis Digital. Nom de l'application : BilanGo.
2. Modèle économique
- Abonnement : 2000 FCFA pour 30 jours (volontairement exprimé en "30 jours" et non "1 mois", pour éviter toute ambiguïté de calcul liée aux mois calendaires de durée variable)
- Paiement via Mobile Money uniquement (MTN Money, Moov Money), aucune gestion de carte bancaire
- Pas de prélèvement automatique : le renouvellement est toujours une action volontaire du client (contrainte du marché — les paiements récurrents automatiques ne sont pas fiables/adoptés avec le Mobile Money local)
- L'application elle-même ne gère et ne fait jamais transiter l'argent des utilisateurs entre eux — seul l'abonnement à la plateforme est encaissé par l'éditeur de l'app
- Essai gratuit avant le premier paiement (durée à définir, recommandation : 5 à 7 jours)
- Renouvellement anticipé : si le client repaie avant la date d'expiration, les 30 nouveaux jours s'ajoutent à la date d'expiration existante (jamais un reset qui ferait perdre les jours déjà payés). Si le client paie après expiration, les 30 jours partent de la date du paiement.
3. Utilisateurs et modèle de comptes
3.1 Principe général
Il n'existe qu'un seul type de compte. Un compte s'inscrit avec uniquement un numéro de téléphone — pas de mot de passe.
Le rôle (propriétaire, manager, etc.) est une propriété de la relation entre un compte et un business précis, pas une propriété du compte lui-même. Un même utilisateur peut donc être propriétaire de son propre business ET manager sur un ou plusieurs autres business (ex : un livreur peut faire le bilan pour plusieurs e-commerçants différents), avec un seul compte.
3.2 Authentification par code OTP (sans mot de passe)
Pas d'email, pas de mot de passe dans le système — authentification entièrement basée sur un code OTP ("One-Time Password", code de vérification à usage unique) envoyé via l'API WhatsApp Business (et non par SMS) :
1. L'utilisateur entre son numéro de téléphone
2. Un code de vérification (4-6 chiffres) est envoyé via un template WhatsApp pré-approuvé par Meta (catégorie "Authentication")
3. Il entre le code → il est connecté, une session persistante est créée (voir 5.0), et il définit un code PIN local à 4 chiffres
Le numéro utilisé doit être actif sur WhatsApp — condition obligatoire dès l'inscription, pas seulement recommandée. Ce choix est cohérent avec le reste du système : le lien de paiement/renouvellement d'abonnement passe déjà exclusivement par WhatsApp (voir section 9), donc un numéro sans WhatsApp ne pourrait de toute façon jamais utiliser l'app jusqu'au bout. Un seul canal à intégrer (WhatsApp), pas de fournisseur SMS séparé à gérer, coût d'authentification quasi nul (catégorie "Authentication" facturée à moins de 0,01$/message).
PIN local pour la reconnexion rapide (sans nouvel envoi) : après une déconnexion volontaire sur le même appareil, l'utilisateur retape uniquement son PIN local (stocké sur l'appareil) pour se reconnecter — aucun nouveau message à chaque reconnexion. L'OTP n'est redemandé qu'en cas de nouvel appareil, de PIN oublié, ou de première connexion.
Ce choix élimine tout flux de récupération de mot de passe, simplifie l'inscription pour un public peu technophile, et reste peu coûteux grâce à la session persistante et au PIN local.
Protection anti-abus obligatoire (spam de codes) :
- Rate limiting : un numéro ne peut demander qu'un code toutes les X minutes (ex : 2 min), avec un maximum de tentatives par 24h (ex : 5)
- Limitation complémentaire par device/IP en cas de tentatives répétées sur plusieurs numéros depuis la même source
- CAPTCHA ou vérification "je ne suis pas un robot" avant l'envoi du code
3.3 Parcours à l'ouverture de l'app après inscription
- Le système vérifie si ce numéro de téléphone a déjà été invité sur un business existant
  - Si oui → redirection directe vers le dashboard de ce business (aucune question posée)
  - Si non → écran avec un seul choix clair : "+ Créer mon business"
4. Gestion des business et des rôles
4.1 Création d'un business
- Nom du business
- Secteur d'activité (sert à pré-remplir un modèle par défaut — ex : "Bar/Restaurant" pré-remplit des suggestions de rôles comme Gérant, Serveur, Caissier — mais tout reste modifiable)
- Activation ou non du module Stock (facultatif)
4.2 Rôles personnalisables
Le propriétaire peut créer autant de rôles qu'il veut via un bouton "+ Ajouter un rôle" :
1. Il choisit un nom libre pour le rôle (Caissier, Gérant, DG, Comptable...)
2. Il associe ce nom à un niveau de permission parmi une liste fixe :
   - Saisie seule — peut uniquement remplir le bilan du jour
   - Gestion complète — peut voir l'historique complet, gérer le stock, inviter/retirer des personnes de niveau inférieur uniquement
   - Lecture seule — consultation uniquement, aucune modification possible (utile pour un comptable externe par exemple)
3. Il entre le numéro de téléphone de la personne à qui attribuer ce rôle
4.2bis Système d'invitations
Inviter quelqu'un ne lui donne pas un accès immédiat et automatique : ça crée une invitation en attente. Si la personne a déjà l'app (avec un compte existant), l'invitation apparaît dans une section dédiée "Invitations" qu'elle peut consulter, avec le nom du business et le rôle proposé. Elle choisit d'accepter ou de refuser. Ce n'est qu'après acceptation que l'accès est effectif et qu'elle peut commencer à saisir des bilans pour ce business.
4.3 Règles de sécurité sur les permissions
- Personne ne peut retirer ou modifier quelqu'un de rang égal ou supérieur au sien
- Seul le propriétaire (celui qui a créé le business, celui qui paie l'abonnement) a un pouvoir absolu : gérer l'abonnement, supprimer le business, ajouter/retirer n'importe qui à n'importe quel niveau. Personne ne peut le retirer, lui.
4.4 Suppression d'un membre (soft delete)
Quand un propriétaire retire quelqu'un du business :
- Cette personne perd uniquement son accès futur (elle ne peut plus se connecter/saisir de nouveaux bilans pour ce business)
- Tous les bilans qu'elle a soumis par le passé restent conservés intégralement, avec son nom toujours visible dessus
- Ne jamais faire de suppression en cascade des données liées à un compte retiré
4.5 Navigation multi-business
- Menu latéral (icône "3 traits" / hamburger) : liste des business auxquels le compte a accès, avec un mini-indicateur du CA du jour à côté de chaque nom
- Le business actuellement affiché est marqué visuellement
- Lien "Faire le bilan du jour" accessible directement depuis ce menu pour le propriétaire — il a, comme le manager, la possibilité de soumettre lui-même un bilan (ex : s'il est exceptionnellement sur place, ou tant qu'il n'a pas encore de manager), sans changer de compte ni de rôle. Ouvre le même écran de saisie que celui du manager
- Bouton "+ Ajouter un business" en bas de la liste
- Le nombre de jours restants de l'abonnement est visible dans ce même menu
5. Fonctionnalités de saisie (côté manager/employé)
5.0 Session et écran d'accueil
L'application maintient une session persistante (token de session longue durée) : une fois connecté, l'utilisateur (propriétaire ou manager) n'a plus besoin de se reconnecter à chaque ouverture de l'app — il clique sur l'icône et voit directement ses informations. La déconnexion reste possible manuellement.
Écran d'accueil du manager :
- Bouton principal "Faire le bilan du jour"
- Bouton secondaire "Voir mes bilans précédents"
- Caisse théorique disponible affichée en évidence
5.1 Bilan quotidien
Écran simple centré sur un bouton principal "Faire le bilan du jour" :
- Chiffre d'affaires : saisie d'un montant global (pas de calcul croisé automatique prix × quantité)
- Dépenses du jour : montant global, avec possibilité de détail (voir ci-dessous)
- Ajout à la caisse : catégorie séparée pour tout argent déposé en caisse hors vente (ex : dépôt du propriétaire) — distincte du CA pour ne pas fausser le chiffre d'affaires réel ; montant global, avec possibilité de détail (voir ci-dessous)
- Stock (si le module est activé, facultatif) : sélection de la quantité vendue pour chaque article ; la quantité restante en stock se déduit automatiquement à chaque vente enregistrée
- Note du jour : champ libre facultatif
Détail par catégorie (optionnel) : chacune des trois catégories ci-dessus (CA, Dépenses, Ajout à la caisse) dispose de son propre bouton "Détailler (optionnel)", visible mais non-obligatoire au moment de la saisie. En cliquant, le manager peut ajouter autant de lignes qu'il veut, chacune composée de deux champs simples : Nom/élément (champ libre, ex : "Chaussures", "Achat ingrédients", "Dépôt propriétaire") et Montant — pas de champ quantité, pour rester simple. Les lignes détaillées s'additionnent automatiquement pour former le montant total de la catégorie ; le manager peut aussi se contenter du montant global sans jamais détailler.
5.2 Plusieurs contributeurs par jour
Plusieurs personnes (ex : plusieurs postes dans un même business) peuvent chacune soumettre leur propre bilan le même jour. Chaque bilan est horodaté et lié à la personne qui l'a soumis (nom + heure exacte d'envoi).
Le chiffre d'affaires du jour affiché au propriétaire = somme automatique de tous les bilans reçus ce jour-là, quel que soit le nombre de contributeurs.
5.3 Système de caisse théorique (contrôle anti-fraude)
- Au premier jour d'utilisation, le manager compte physiquement la caisse et déclare ce montant de départ une seule fois
- Chaque jour suivant, la caisse théorique est recalculée automatiquement selon la formule :
  Caisse du jour = Caisse de la veille + CA + Ajouts à la caisse − Dépenses
- Cette caisse théorique est visible à la fois côté manager et côté propriétaire, pour que le manager comprenne la logique et déclare correctement chaque mouvement d'argent
- Aucune alerte automatique n'est déclenchée en cas d'écart, pour éviter les fausses accusations — l'écart, s'il existe, est simplement visible dans l'historique consultable par le propriétaire
- La véritable protection anti-fraude repose sur le contrôle physique surprise du propriétaire (compter l'argent réel en caisse et comparer au montant affiché par l'app) — l'app fournit la référence fiable qui rend ce contrôle possible et rapide, mais ne prétend pas détecter automatiquement une fraude
5.4 Historique personnel
Le manager peut consulter ses propres bilans passés (pour vérifier/se rassurer sur ce qu'il a soumis), sans accès aux données globales du business s'il est en "Saisie seule".
5.5 Modification d'un bilan
- Le manager dispose d'un bouton "Modifier" sur un bilan déjà envoyé, visible pendant 24h maximum après l'envoi, avec un indicateur du type "Modifiable jusqu'à [heure]"
- Passé ce délai, le bouton disparaît automatiquement de l'interface
- Quand une modification est effectuée, le propriétaire reçoit une notification push l'informant du changement, et peut consulter les deux versions (originale et modifiée) avec leurs horodatages respectifs
- Note technique : une modification recalcule automatiquement la caisse théorique de ce jour et de tous les jours suivants jusqu'à aujourd'hui (effet en cascade à prévoir côté développement)
5.7 Rappel automatique
Si le manager n'a pas encore soumis son bilan à une heure définie, il reçoit une notification push automatique de rappel. Cette heure est fixée par le propriétaire (au moment de la création du business ou de l'ajout du manager), pas par le manager lui-même — cohérent avec la logique de contrôle de l'app. Une valeur par défaut raisonnable (ex : 20h) s'applique si le propriétaire ne la configure pas.
6. Fonctionnalités de consultation (côté propriétaire)
6.1 Dashboard principal
- Chiffre principal affiché en gros : le CA du jour s'il existe déjà, sinon le dernier bilan complet disponible avec sa date clairement affichée (jamais un écran vide/à zéro qui suggère que rien ne fonctionne)
- Caisse théorique disponible affichée en évidence, au même niveau d'importance que le CA
- Comparaison discrète avec la veille (montant ou % d'évolution)
- Sélecteur rapide de période : boutons "Aujourd'hui / 7 jours / 30 jours" (pas de calendrier complexe)
- Si le bilan du jour n'est pas encore arrivé pendant que la journée est en cours : badge discret "En attente du bilan" plutôt qu'un chiffre à zéro
6.2 Détail du bilan
- Accessible en cliquant sur le CA affiché
- Affiche le détail par contributeur si plusieurs personnes ont saisi un bilan ce jour-là (qui a rapporté quoi, à quelle heure)
- Si le manager n'a saisi que le CA sans détail : affichage "Votre manager n'a pas détaillé le bilan aujourd'hui"
- Affiche la caisse théorique du jour, avec le détail CA / Dépenses / Ajouts qui la composent
- Bouton "Télécharger le bilan" : génère un PDF texte pur (sans logo ni image, pour rester très léger) à la volée au moment du clic — jamais stocké sur le serveur, pour éviter tout coût de stockage et permettre de le régénérer à tout moment. Contenu : date, CA du jour (+ détail), dépenses (+ détail), ajout à la caisse (+ détail), caisse théorique, note du jour, nom du contributeur + heure d'envoi
6.3 État vide (première utilisation / essai gratuit)
Avant le premier bilan reçu, afficher un message explicatif rassurant plutôt qu'un dashboard vide et froid (ex : "Ton manager n'a pas encore fait son premier bilan — dès qu'il le fera, tu verras tout apparaître ici").
6.4 Statut de l'abonnement
Écran dédié "Mon abonnement" :
- Statut clair : "Actif jusqu'au [date]" ou "Expiré depuis [date]"
- Nombre de jours restants (aussi visible dans le menu latéral)
- Historique des paiements passés
6.5 Section "Comment utiliser l'application"
Section dédiée et facilement accessible depuis le menu principal (pas cachée dans un sous-menu), organisée par rôle (ce que voit/fait un manager vs un propriétaire), couvrant : faire le bilan, comprendre la caisse théorique, gérer les rôles/permissions, gérer l'abonnement. Réutilise le même contenu que les vidéos de démonstration marketing.
7. Design et expérience utilisateur
- Écran de chargement : viser moins de 2 secondes (idéalement 1-1,5s), logo centré, animation minimale
- Couleurs : palette officielle validée — vert foncé #0F6E56 (couleur principale : navigation, boutons, chiffres mis en avant), #085041 (accents foncés, textes importants), #5DCAA5 (accents clairs, indicateurs positifs). Choix cohérent avec les couleurs de confiance/réussite financière, tout en évitant le jaune/orange trop proche des identités visuelles MTN/Orange Money
- Logo : icône carrée arrondie, fond vert foncé (#0F6E56), œil stylisé blanc avec un petit graphique en barres montantes dans l'iris — symbolise à la fois la vision à distance de l'activité et la croissance du chiffre d'affaires
- Principe général d'interface : un seul chiffre fort mis en avant par écran, le reste en support visuel discret — l'app doit rester utilisable par des personnes peu à l'aise avec la technologie
- Poids de l'application à garder léger (peu de fonctionnalités lourdes, pas de multimédia superflu), pour faciliter le téléchargement même avec un forfait data limité
8. Notifications
- Canal retenu : notifications push natives dans l'application (Firebase Cloud Messaging pour Android), gratuites et illimitées — pas de dépendance à l'API WhatsApp Business pour l'usage quotidien
- Cas d'usage des notifications push :
  - Rappel au manager s'il n'a pas fait son bilan
  - Alerte au propriétaire quand un nouveau bilan est disponible
  - Alerte au propriétaire quand un bilan a été modifié
- WhatsApp Business API (mode Coexistence — numéro utilisable à la fois par l'automatisation et manuellement) réservé aux :
  - Rappels d'expiration d'abonnement (ex : à J-3) et liens de paiement
  - Confirmations de renouvellement
  - Service client (voir 8.1)
8.1 Service client
Au lancement, le service client se fait sur le même numéro WhatsApp Business que les notifications automatisées. Prévoir de créer un numéro séparé le jour où une personne dédiée est recrutée pour gérer le service client, afin qu'elle n'ait pas accès aux données/bilans liés au numéro principal.
9. Paiement et abonnement (intégration technique)
9.1 Choix de l'agrégateur : Fedapay
- Commission Mobile Money : environ 1,6%
- Pas d'abonnement mensuel fixe côté agrégateur
- Couverture confirmée au Bénin (MTN Money, Moov Money)
- API avec les champs nécessaires pour l'automatisation (voir 9.2)
- Type de compte : compte Business Fedapay requis pour le projet réel (nécessite RCCM + IFU — voir section 11), contrairement au projet d'entraînement (app de test, sandbox, sans besoin d'entreprise)
9.2 Identification automatique du client qui paie
Pour chaque transaction créée via l'API Fedapay, utiliser :
- merchant_reference : identifiant unique généré par le système pour chaque transaction (ex : SUB-BUSINESS0234-2026-09), jamais réutilisé pour deux transactions différentes
- custom_metadata : informations complémentaires (ID du business, type d'opération "renouvellement_abonnement")
9.3 Flux complet
1. Le serveur génère une transaction Fedapay avec le montant fixe (2000 FCFA), une merchant_reference unique liée au business, et le custom_metadata correspondant
2. Fedapay retourne un lien de paiement unique
3. Ce lien est envoyé au propriétaire via WhatsApp (canal externe à l'app)
4. Le client paie via Mobile Money sur ce lien
5. Fedapay envoie un webhook au serveur avec les détails de la transaction confirmée, y compris la merchant_reference
6. Le serveur retrouve le business correspondant et active/prolonge automatiquement l'abonnement
9.4 Sécurité du webhook
- Vérifier la signature/clé secrète fournie par Fedapay pour s'assurer que le webhook provient bien d'eux
- Prévoir une vérification périodique de secours (ex : toutes les heures, interroger l'API Fedapay pour les transactions en attente) en cas d'échec de livraison du webhook
9.5 Conformité Google Play
- L'application est gratuite au téléchargement sur le Play Store
- Aucun bouton, aucune mention, ni aucun parcours de paiement à l'intérieur de l'application ne doit rediriger vers un moyen de paiement externe (Google Play interdit ce type de flux pour la catégorie "logiciel professionnel/business")
- Le paiement de l'abonnement se fait entièrement via un canal externe à l'app (lien envoyé par WhatsApp)
- L'app se contente d'afficher un statut d'abonnement (actif/expiré), sans jamais initier elle-même de parcours de paiement
- Format de publication : .aab (Android App Bundle) obligatoire — le format .apk classique n'est plus accepté pour la soumission au Play Store
- Phase de test fermé obligatoire pour un nouveau compte développeur individuel : 12 testeurs minimum, utilisation pendant 14 jours consécutifs, avant publication publique. Prévu de recruter ces testeurs parmi des proches/connaissances et de simuler une activité quotidienne réaliste (transactions fictives variées : plusieurs contributeurs certains jours, écarts de caisse volontaires, oublis de bilan pour tester les rappels, cycle complet d'expiration/renouvellement d'abonnement) pour valider le produit en conditions réelles pendant cette période
9.6 Politique de confidentialité
Obligatoire pour la publication (l'app collecte des données personnelles : numéro de téléphone, données de compte et de bilan). Doit couvrir : nature des données collectées, usage et stockage (Supabase), partage avec des tiers (Fedapay pour le paiement, Meta/WhatsApp pour les notifications), procédure de suppression de compte/données, contact de confidentialité. Publiée via une page web accessible publiquement (lien requis dans la fiche Play Store).
10. Sécurité générale (à valider avec le développeur)
- Chiffrement des données en transit (HTTPS partout)
- Vérification stricte des permissions à chaque requête (un manager ne doit jamais pouvoir accéder aux données d'un business auquel il n'est pas rattaché, ni dépasser son niveau de permission)
- Protection anti-abus sur la récupération de mot de passe (voir 3.2)
- Vérification de signature sur les webhooks de paiement (voir 9.4)
- Accord de confidentialité (NDA) et clause de cession de propriété intellectuelle du code dans le contrat avec le développeur
11. Structure juridique et société éditrice
- Société éditrice : Novadis Digital, entreprise individuelle enregistrée au Bénin (RCCM + IFU via monentreprise.bj, Guichet Unique APIEx), avec une activité déclarée volontairement large (commerce général, développement et exploitation d'applications et services numériques, formation et accompagnement en e-commerce et marketing digital) pour couvrir l'ensemble des activités de l'éditeur (ce SaaS, e-commerce, formations) sans nécessiter d'entités séparées
- Siège social : domicile personnel de l'éditeur, admis pour une entreprise individuelle sans local commercial ; modifiable ultérieurement par simple déclaration de modification si un local dédié est pris plus tard
- Nom de domaine : réservation recommandée d'un .bj (registraire local béninois, ex : Afriregister.bj, IT-Num.bj, Open.bj) et, si disponible, du .com correspondant, dès validation du nom — ne nécessite pas d'attendre l'obtention du RCCM/IFU
12. Programme d'affiliation (agents terrain) — à intégrer côté back-office
- Les agents terrain démarchent physiquement les prospects (bars, restaurants, boutiques de quartier à Cotonou), font installer l'app, accompagnent jusqu'à la conversion en abonnement payant
- Pas de système de code de parrainage visible côté client (association négative avec les systèmes pyramidaux sur ce marché)
- Processus de suivi en interne :
  1. Avant de démarcher un prospect, l'agent vérifie auprès de l'équipe si ce numéro est déjà "pris" par un autre agent
  2. Si libre, il le déclare immédiatement (horodatage) pour se l'approprier
  3. En fin de mois, l'agent envoie la liste des numéros qu'il revendique avoir convertis
  4. L'équipe croise cette liste avec les paiements réellement confirmés (webhooks Fedapay) avant de valider toute commission
- Commission : 1000 FCFA sur le premier paiement uniquement (pas de commission récurrente sur les renouvellements suivants)
- Ce programme peut démarrer avec un simple outil de suivi manuel (ex : tableur partagé) avant tout développement dédié
- Prévu : briefing/formation des agents terrain + vidéos de démonstration courtes filmées (capture d'écran + voix off), une par fonctionnalité, réutilisées à la fois pour la formation des agents/managers et comme argument de crédibilité auprès des prospects
13. Priorisation V1 / V2
V1 — indispensable pour le lancement
- Inscription et connexion par code OTP envoyé via WhatsApp (sans mot de passe, numéro WhatsApp obligatoire)
- Création de business, gestion des rôles personnalisables et permissions
- Bilan quotidien (CA + dépenses + ajouts à la caisse + stock optionnel + note), système de caisse théorique, multi-contributeurs
- Modification de bilan avec fenêtre de 24h et double version consultable
- Dashboard propriétaire (CA du jour/dernier bilan, comparaison simple, périodes rapides)
- Section "Comment utiliser l'application"
- Navigation multi-business
- Notifications push (rappel manager, nouveau bilan, bilan modifié, expiration abonnement)
- Paiement Fedapay avec identification automatique et activation d'abonnement
- Politique de confidentialité publiée
- Essai gratuit avec limitation anti-fraude (numéro de téléphone comme identifiant principal, complété par un identifiant d'appareil)
V2 — à ajouter une fois le concept validé par les premiers utilisateurs
- Photo de profil et personnalisation visuelle
- Détection automatique d'anomalies (écarts stock/CA)
- Graphiques et comparaisons avancées
- WhatsApp Business API en option premium pour l'usage quotidien
- Support multi-langues, mode hors-ligne avancé
- Numéro de service client séparé (dès recrutement d'une personne dédiée)