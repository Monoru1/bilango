# Audit de migration Expo → web
Conservé et réutilisé : règles de bilan/caisse théorique, abonnement/essai/grâce, PIN, commissions, versements (→ `packages/domain`, tests 94).
Abandonné : couche React Native / Expo (déplacée dans `legacy/expo-app`, non supprimée), stockage local comme source de vérité (remplacé par PostgreSQL).
Réécrit : écrans (web), auth (serveur : OTP/PIN hachés), tout le backend, portails partenaires/admin.
Historique Git non modifié ; main non touché (SHA initial c8f0e1fd).
