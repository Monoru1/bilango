# PWA de recette hébergée

L’accueil, les instructions du bouton d’installation et la navigation vers les mentions légales ont été vérifiés dans Chrome cloud sur la [preview Netlify](https://deploy-preview-12--gobilan-pwa.netlify.app/).

## Scénario métier rejouable

Exécuter depuis la racine du dépôt. Injecter directement dans le lanceur de confiance les variables ci-dessous. Désactiver les traces Playwright et toute journalisation des valeurs du lanceur. Le script ne produit ni capture ni PDF persistant en recette hébergée.

| Variable | Valeur |
|---|---|
| `E2E_RECETTE_URL` | `https://deploy-preview-12--gobilan-pwa.netlify.app` |
| `E2E_RECETTE_PHONES` | Trois numéros béninois fictifs et distincts de la liste autorisée dans Render, au format national, séparés par des virgules |
| `E2E_RECETTE_OTP` | Code de démonstration courant, injecté depuis sa configuration protégée |
| `E2E_RECETTE_PIN` | PIN temporaire des comptes de recette créés par ce scénario |
| `E2E_BROWSER`, `E2E_WIDTH` | `chromium` / `320`, `firefox` / `390`, `webkit` / `768` |

```sh
bash e2e/run-hosted-recette.sh
```

Le lanceur demande les valeurs sans écho dans un terminal ou les reçoit d’un lanceur de confiance. Il fixe l’origine de recette, désactive les variables de trace et ne crée aucun fichier de secrets.

Réserver des comptes neufs pour chaque exécution. Le scénario enregistre un propriétaire, un employé et un compte sans accès, crée un business et écrit des données fictives. Il passe par les interfaces et API de recette. Il émule le mode standalone et laisse la base distante intacte côté SQL. Les changements d’heure et les versions de bilan sont vérifiés à la lecture de l’API. Le scénario hébergé vérifie l’essai en cours. Le passage accéléré au blocage J+4 reste dans la suite locale sur PostgreSQL isolé.

Le contrôle préalable refuse une origine autre que la preview et exige les données de test avant de demander un OTP. Le parcours authentifié reste à exécuter avec des comptes fictifs réservés et le code actif. Le Chromium du terminal échoue au démarrage sur un refus de socket. Firefox a refusé le certificat dans le terminal. La vérification manuelle concerne la navigation publique dans Chrome cloud. Installation sur Android et iPhone physiques à valider séparément.

La synthèse de livraison et les critères contractuels sont dans [livraison-15-novembre.md](../livraison-15-novembre.md).
