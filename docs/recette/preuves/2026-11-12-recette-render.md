# Preuves — recette Render et raccordement Netlify (12 novembre 2026)

Vérifications exécutées par appels HTTP réels sur l'environnement déployé (pas d'émulation
d'appareil, pas de test sur téléphone physique). Comptes et données fictifs.

| Vérification | Résultat |
|---|---|
| Déploiement Render `dep-dbqokalckfvc73d2dk0g`, commit `c7894fd` | live |
| `GET /health` et `GET /ready` (API directe) | 200 `{"ok":true}` |
| Journal de démarrage | `tables=0 … decision=initialize`, migrations 001 à 007 appliquées |
| `GET /v1/auth/config` via la preview Netlify | 200 JSON, `demo.whatsappSimulated: true` |
| Demande d'OTP pour un numéro hors liste | 403, message explicite, aucun code émis |
| Inscription d'un compte de démonstration (OTP, PIN, profil) | 200 à chaque étape |
| Création d'un business (stock activé, fermeture 21:30) | 200, essai gratuit accordé, 7 jours restants |
| Bilan du jour : CA 85 000, dépenses 12 000, caisse d'ouverture 20 000 | 200 ; caisse théorique 93 000 |
| Redémarrage de l'API puis relecture avec la même session | business et CA du jour retrouvés |
| Déconnexion puis reconnexion par PIN via la preview | 200, tableau de bord relu |
| Requête mutante depuis une origine non déclarée | 403 |
| Tableau de bord sans session | 401 |
| Journaux Render : recherche du code de test, du PIN, du numéro, de `code=` | aucune occurrence ; seule ligne `[RECETTE WHATSAPP] simulé (non envoyé)` |
| `manifest.webmanifest` et `sw.js` sur la preview | 200, types MIME corrects |

Non vérifié à ce stade : installation réelle sur Android et iPhone, parcours dans l'interface
(navigateur), invitation et acceptation d'un employé, stock, modification de bilan, export PDF.
