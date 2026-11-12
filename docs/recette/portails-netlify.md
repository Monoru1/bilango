# Déployer les deux portails en recette

Utiliser deux projets Netlify distincts reliés à `Monoru1/bilango`. Pour chacun, conserver la racine du dépôt comme **Base directory** et indiquer le **Package directory** ci-dessous. Sélectionner une branche autorisée qui contient les deux configurations et le proxy. Le build est défini dans le fichier Netlify du portail.

| Portail | Package directory | Répertoire publié |
|---|---|---|
| Partenaires | `apps/partners` | `apps/partners/dist` |
| Administration | `apps/admin` | `apps/admin/dist` |

Définir `API_ORIGIN` à l’origine HTTPS de l’API de recette. Le build produit le routage `/v1/*` avant la réécriture SPA. Sans origine API, les appels retournent la réponse d’indisponibilité JSON. Chaque portail conserve son origine et son cookie de session propres. Pour activer le transfert signé, appliquer la configuration Edge de [SECURITY_MODEL.md](../SECURITY_MODEL.md) dans le contexte de déploiement concerné.

Une fois les URL attribuées, déclarer les origines HTTPS exactes du portail partenaire et administrateur dans `PARTNERS_ORIGIN` et `ADMIN_ORIGIN` sur le service API de recette. `PWA_ORIGIN` reste l’origine de la PWA. Vérifier ensuite les pages de connexion et les routes profondes, un retour HTTP 401 JSON des endpoints de session sans cookie et le rejet d’un cookie de l’autre audience. Pour le parcours authentifié, utiliser les comptes de recette prévus et un SMTP de test qui permet de recevoir l’activation partenaire et le second facteur admin.

[Configuration Netlify d’un monorepo](https://docs.netlify.com/build/configure-builds/monorepos/)
