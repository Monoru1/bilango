# Recette isolée reproductible (pas une mise en production)

## Ressources constatées le 3 novembre 2026

Netlify `gobilan-pwa` existe, sans variable d'environnement sur le site. Render expose un service Jarvis indépendant et aucune instance PostgreSQL ; aucun service n'a été modifié ou créé. Supabase expose les projets Pyjamas production et recette, pas de projet GoBilan identifié. Ils ne sont pas réutilisés pour mélanger les données des deux applications.

L'hébergement d'une API persistante GoBilan reste à fournir/valider. La stack Docker ci-dessous prépare l'artefact exécutable sans nouvelle souscription. Elle n'est pas un hébergement cloud déjà opérationnel.

## Démarrer la stack locale/privée

Préparer hors dépôt des valeurs persistantes : `ACCEPTANCE_DB_PASSWORD` (recommandé : 32 octets aléatoires en hexadécimal), `PIN_PEPPER_HEX` (32 octets au moins), `PAYOUT_KEY_HEX` (32 octets), `FEDAPAY_WEBHOOK_SECRET` (clé de signature de fixtures distincte des vraies clés). Ne pas régénérer ces secrets à chaque démarrage : les hachages/chiffrements existants deviendraient inutilisables.

```sh
docker compose -f compose.acceptance.yml config --quiet
docker compose -f compose.acceptance.yml up -d --build --wait
curl --fail http://127.0.0.1:8787/ready
```

L'API est publiée sur 127.0.0.1:8787 seulement. PostgreSQL n'a pas de port hôte et conserve sa base `gobilan_acceptance` dans un volume. Le conteneur API tourne sans root. `NODE_ENV=production` reste refusé ; les fournisseurs par défaut restent explicitement Dev. `SCHEDULER=0` évite tout traitement automatique en recette. `docker compose down` préserve le volume ; `down -v` est réservé à la destruction volontaire de fixtures.

`API_HOST=0.0.0.0` n'est accepté qu'avec `ACCEPTANCE_ISOLATED=true` et une URL PostgreSQL dont la base est exactement `gobilan_acceptance`. Hors conteneur, l'écoute reste loopback par défaut. `PWA_ORIGIN`, `PARTNERS_ORIGIN`, `ADMIN_ORIGIN` acceptent une origine HTTPS exacte ou HTTP loopback, sans chemin ni identifiants. Le défaut correspond aux trois Vite locaux. Une publication distante exige un reverse proxy HTTPS, une protection privée de recette et des cookies Secure ; elle n'est pas activée ici.

`/health` vérifie le processus ; `/ready` vérifie aussi la base et renvoie 503 sans détail privé en cas de panne.

## Transports de recette préparés

`apps/api/src/integrations/acceptance.ts` fournit des adaptateurs aux interfaces existantes. Ils ne sont pas choisis automatiquement par `server.ts` et ne rendent aucun fournisseur actif en production.

- SMTP : `acceptanceSmtpTransport` + `SmtpAcceptanceSender`. TLS obligatoire hors capture loopback ; destinataire unique limité à une liste de test explicite ; pièces jointes/fichiers/URLs désactivés ; vérification de l'acceptation SMTP, erreurs sans détails sensibles. Le test ouvre un vrai serveur SMTP de capture loopback, reçoit le message, puis prouve qu'une autre adresse est refusée. Aucune réception externe attestée.
- Web Push : `AcceptanceWebPushTransport`. Chiffrement aes128gcm et VAPID réels, charge utile typée sans montants, destinataires limités aux abonnements de test exacts sur les services connus ; destinations privées, credentials URL et redirections refusés. Le test déchiffre le message avec la clé éphémère du destinataire et vérifie l'absence de montant. Réponse HTTP doublée, aucun appareil réel notifié.
- CAPTCHA : `TurnstileVerifier` valide côté serveur succès booléen, hostname et action exacts ; délai borné, redirection refusée, rejet en cas d'erreur. Les clés publiques de test nécessitent `testing:true`. Le test fournisseur explicite se lance avec `node --import tsx scripts/check-turnstile-test-service.mjs`. La tentative effectuée ici a expiré en 8 secondes : succès externe NON attesté. Le widget frontend et les clés du domaine restent à raccorder après choix/configuration du fournisseur.
- WhatsApp OTP : non branché ; le sender SMTP refuse explicitement la méthode WhatsApp. Il faut le compte de test Meta/BSP, la version API et le modèle d'authentification approuvé. Aucune API propriétaire non documentée choisie par défaut ; documentation Meta inaccessible (429) pendant cette reprise.
- FedaPay : interface Dev conservée et refus du lancement production maintenu. Clés/compte sandbox et preuves authentiques indispensables ; aucune création de transaction exécutée.

## Migration et restauration

Le migrateur verrouille le couple base/schéma AVANT la première DDL et applique le lot dans une transaction : deux démarrages concurrents ne créent plus les tables/fonctions en course. Un test PostgreSQL utilise deux pools indépendants vers un schéma temporaire neuf.

La CI exécute `scripts/test-backup-restore.mjs` avec `node --import tsx`. Il refuse toute URL distante, toute base d'entrée autre que `gobilan_test` et tout identifiant de conteneur invalide. Il crée deux bases temporaires distinctes, migre la source, insère des fixtures, produit un vrai `pg_dump` custom et restaure par `pg_restore`. Il compare utilisateurs, caisse et historique de migrations, puis vérifie le déclencheur d'audit append-only avant de supprimer uniquement ces deux bases. Le résultat doit être lu dans la CI, pas supposé d'après la présence du script.

Le job conteneur vérifie démarrage, readiness et conservation d'une fixture après remplacement des conteneurs, puis détruit son volume de test. Il ne modifie aucune infrastructure hébergée.

## Navigateurs et résolutions

La CI rejoue les parcours PWA et portails dans Chromium (320 px), Firefox (390 px) et WebKit (768 px pour la PWA, 1100 px pour les portails). Un contrôle de débordement horizontal couvre le tableau de bord. Il s'agit d'émulations navigateur ; elles ne remplacent ni les appareils physiques ni un audit WCAG complet. Consulter les résultats des jobs avant d'affirmer leur réussite.

## NO-GO conservé

L'API cloud, le câblage complet des fournisseurs, les clés et modèles autorisés, les callbacks fournisseur authentiques, les appareils mobiles physiques, la supervision/sauvegarde d'une infrastructure réelle et les validations métier/juridiques restent à attester. La configuration frontend corrige le 404 en preview existante ; aucune production déployée ou fusion effectuée. Les assertions de tests et leurs doublures ne constituent pas une réception client.

## Préparer une copie chiffrée hors hôte

Après le contrôle d'intégrité et le test de restauration de l'archive, provisionner sur le runner le certificat RSA **public** de restauration. Obtenir son empreinte SHA-256 complète par un canal séparé. La clé privée reste chez les responsables de restauration.

```sh
sh scripts/encrypt-backup-export.sh /chemin/prive/archive.dump \
  /chemin/prive/archive.dump.cms /chemin/prive/certificat.pem EMPREINTE_SHA256_APPROUVEE
```

La commande prépare un fichier chiffré sans écraser une copie existante. La destination distante, ses accès et la rétention restent soumis à approbation. Ne transférer que le fichier chiffré. Pour une répétition de restauration, déchiffrer avec `openssl cms -decrypt -inform DER` dans un répertoire privé sur le runner isolé. Utiliser le fichier déchiffré uniquement si la commande réussit, puis lancer la restauration PostgreSQL. Le test de chiffrement emploie une clé et un contenu jetables. Le job PostgreSQL chiffre puis déchiffre un véritable dump synthétique avant sa restauration isolée.
