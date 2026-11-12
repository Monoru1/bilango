# Preuves — intégration des lots Codex, proxy signé, limiteur de débit, portails (12 novembre 2026, après-midi)

Environnement : recette Render `gobilan-recette-api` + Netlify. Comptes fictifs uniquement. Aucune migration.

## Intégration
| Étape | Résultat |
|---|---|
| PR #21 (SEC-48) → branche de la PR #19 | fusionnée, `50845e9`, CI six jobs verts |
| PR #19 → `integration/gobilan-15-novembre` | fusionnée, `a261363`, CI six jobs verts |
| PR #18 → `fix/gobilan-livraison-15-novembre` | fusionnée, `5ec4127`, déploiement Render live |
| PR #22 (limiteur de débit) → livraison | fusionnée, `164f0ce`, CI six jobs verts, déploiement Render live |

## Défaut corrigé : limiteur de débit inactif
- Constat en déployé sur `5ec4127` : 14 demandes d'OTP en 6 s, aucun 429, aucun en-tête `x-ratelimit-*`.
- Cause : routes déclarées avant le chargement de `@fastify/rate-limit` (`register` non attendu).
- Correctif : routes déclarées dans `app.after()` ; tests `apps/api/test/rate-limit.test.ts`.
- Vérifié en déployé sur `164f0ce` : en-tête `x-ratelimit-remaining` présent et décroissant.

## Proxy signé (clé `GOBILAN_PROXY_KEY_HEX` sur Render et sur les trois projets Netlify)
| Vérification en déployé | Résultat |
|---|---|
| Appels directs à Render | compteur partagé « direct » qui décroît (299, 298, 297…) |
| Appel direct avec preuve forgée et `X-Forwarded-For` | compté dans le compteur direct : preuve rejetée |
| Appels via la preview PWA et via les deux portails | compteurs distincts du compteur direct |
| Clé absente des fichiers servis par la preview (HTML, JS, service worker) | aucune occurrence |

Limite : Netlify n'a pas accepté le marquage « secret » ni la restriction de portée de la variable sur cette
offre ; la clé est une variable d'environnement ordinaire du projet, lisible par les membres de l'équipe Netlify.

## Portails
- Partenaires : https://gobilan-partenaires-recette.netlify.app — Administration : https://gobilan-admin-recette.netlify.app
  (deux projets Netlify gratuits). Déployés par envoi de l'arbre du commit `164f0ce` avec le `netlify.toml` du
  portail copié à la racine, faute de pouvoir régler le « Package directory » par l'outil ; ils ne se
  redéploient donc pas automatiquement à chaque commit.
- `PARTNERS_ORIGIN` et `ADMIN_ORIGIN` de l'API pointent vers ces origines (plus de valeur de réserve).
- Vérifié : pages servies, `/v1/*` relayé ; connexion admin avec identifiants inconnus → 401 ; API admin
  appelée depuis l'origine partenaires → 403 ; statistiques admin sans session → 401.
- Non vérifié : connexion admin réelle, double authentification, activation partenaire (aucun compte admin en
  recette et e-mails non envoyés : SMTP requis).

## Parcours PWA authentifié sur la preview (Playwright, navigateur automatisé, pas un appareil physique)
`e2e/run-hosted-recette.sh`, Chromium, 390 px, commit `164f0ce` : 19 étapes réussies — inscription, profil,
business, heure de fermeture à la création puis modifiée (REC-01), premier bilan, tableau de bord après
rechargement, session employé réelle, modification avec version d'origine conservée, filtrage par permission,
agrégation propriétaire/employé, PDF, coupure réseau puis reprise, autre business → 404, abonnement d'essai,
déconnexion, reconnexion par PIN, cookie httpOnly SameSite, aucune erreur d'exécution.

Non exécuté ici : Firefox et WebKit contre la preview (le lancement échoue dans l'environnement de l'agent,
avant toute étape) ; ces moteurs restent couverts par la CI sur l'environnement local de test.
