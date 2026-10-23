# Décisions (D-xxx)
- D-010 : jour de paiement lu au fuseau de Cotonou.
- D-014 : un seul essai par numéro.
- D-003…D-018 : voir historique des commits ; décisions techniques de ma part, **non validées par le client**.
- D-020 : rappel quotidien (§6.7) envoyé aux membres NON propriétaires pouvant saisir (niveaux « Saisie seule » et « Gestion complète »), dans une fenêtre de 3 h à partir de l'heure choisie par le propriétaire, au fuseau du pays du business (BJ UTC+1 ; CI et TG UTC+0), si aucun bilan n'existe pour le jour du business et que l'abonnement n'est pas bloqué. Interprétation du CDC « le manager » : à confirmer.
- D-021 : notification d'expiration (§9.2) au propriétaire seul, une fois par jour de J-3 à J-1 (même seuil que le pop-up §8.3).
- D-022 : remise des notifications planifiées AU PLUS UNE FOIS (clé de déduplication unique en base) : un échec de livraison n'est pas rejoué le même jour.
- D-023 : la charge utile push est typée (type, nom du business, pastille) ; le texte est fabriqué par le service worker, aucun montant ne peut y figurer.
- D-024 : l'alerte « nouvel appareil » exclut l'appareil qui vient de se connecter (§9.2 : elle part à l'ancien).
- D-025 : permission de notification demandée juste après la création du PIN uniquement sur Android installé ; sur iPhone, bouton « Activer les notifications » du profil seulement (§9.3).
## Incohérences du CDC
- Navigation des rôles « complets » : §5.3 vs §5.5 → appliqué littéralement Accueil/Historique ; à confirmer.
- Commissions : max 12 paiements, fenêtre 30 jours — à valider économiquement (agent 1000/500 sur 2000 F = marge à challenger).
- Frais Mobile Money FedaPay inconnus (net = brut − frais saisis).
