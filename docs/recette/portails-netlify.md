# Déployer les deux portails en recette

Utiliser deux projets Netlify distincts reliés à `Monoru1/bilango`. Pour chacun, conserver la racine du dépôt comme **Base directory** et indiquer le **Package directory** ci-dessous. Sélectionner une branche autorisée qui contient les deux configurations et le proxy. Le build est défini dans le fichier Netlify du portail.

| Portail | Package directory | Répertoire publié |
|---|---|---|
| Partenaires | `apps/partners` | `apps/partners/dist` |
| Administration | `apps/admin` | `apps/admin/dist` |

Définir `API_ORIGIN` à l’origine HTTPS de l’API de recette. Le build produit le routage `/v1/*` avant la réécriture SPA. Sans origine API, les appels retournent la réponse d’indisponibilité JSON. Chaque portail conserve son origine et son cookie de session propres. Pour activer le transfert signé, appliquer la configuration Edge de [SECURITY_MODEL.md](../SECURITY_MODEL.md) dans le contexte de déploiement concerné.

Une fois les URL attribuées, déclarer les origines HTTPS exactes du portail partenaire et administrateur dans `PARTNERS_ORIGIN` et `ADMIN_ORIGIN` sur le service API de recette. `PWA_ORIGIN` reste l’origine de la PWA. Vérifier ensuite les pages de connexion et les routes profondes, un retour HTTP 401 JSON des endpoints de session sans cookie et le rejet d’un cookie de l’autre audience. Pour le parcours authentifié, utiliser les comptes de recette prévus et un SMTP de test qui permet de recevoir l’activation partenaire et le second facteur admin.

[Configuration Netlify d’un monorepo](https://docs.netlify.com/build/configure-builds/monorepos/)

## Raccordement Git des deux sites existants

Les projets de recette sont [gobilan-partenaires-recette](https://app.netlify.com/projects/gobilan-partenaires-recette)
et [gobilan-admin-recette](https://app.netlify.com/projects/gobilan-admin-recette).
Leurs déploiements publiés actuels sont prêts mais leurs métadonnées ne donnent
ni branche ni commit. Réutiliser ces deux projets.

Dans les paramètres de déploiement continu de chaque projet, lier
`Monoru1/bilango`, choisir `fix/gobilan-livraison-15-novembre` et
renseigner le package directory correspondant dans le tableau ci-dessus.
Vérifier la présence côté projet de `API_ORIGIN`, `GOBILAN_EDGE_API_ORIGIN`
et `GOBILAN_PROXY_KEY_HEX`, sans lire ou recopier leurs valeurs dans les preuves.
Laisser les domaines et origines de recette existants. Après publication du build
Git, relever son SHA et contrôler que l'accueil répond 200 et que la route
`/v1/admin/me` ou `/v1/partner/me` répond 401 JSON sans session.
Pour les métriques admin, le proxy Edge transmet aussi les métadonnées
d’origine du navigateur. Vérifier l’affichage et le CSV après connexion admin
sur le même déploiement.

Contrôle HTTP du 12 novembre sur les deux sites actuels : accueils à 200,
routes de session sans cookie à 401 JSON. Raccordement Git et parcours admin
authentifié à confirmer.
