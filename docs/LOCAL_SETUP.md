# GoBilan — lancement et comptes de recette locale

## Sur le PC déjà préparé

Depuis `C:/Users/sakry/Projects/bilango`, PowerShell, branche `test/gobilan-local-acceptance` :

```powershell
# Seulement après un redémarrage du PC, si le cluster de recette est arrêté :
& 'C:\Program Files\PostgreSQL\18\bin\pg_isready.exe' -h 127.0.0.1 -p 55432
# Si « no response » :
& 'C:\Program Files\PostgreSQL\18\bin\pg_ctl.exe' -D .local/postgres -l .local/postgres.log -o '-h 127.0.0.1 -p 55432' -w start

# Lancer les quatre applications, dans UN terminal :
npm run preview:local
```

Ne pas lancer une deuxième instance si les ports sont déjà utilisés. Le lanceur refuse un port occupé. Ctrl+C arrête les quatre applications qu'il a lancées ; PostgreSQL reste indépendant. Si le cluster est déjà prêt, la seule commande nécessaire est `npm run preview:local`.

| Service | Adresse |
|---|---|
| PWA | http://localhost:5173 |
| Partenaires | http://localhost:5174 |
| Administration | http://localhost:5175 |
| API | http://127.0.0.1:8787/health |
| PostgreSQL de recette | 127.0.0.1:55432 |

`preview:local` sert les builds locaux, avec le service worker de la PWA, et l'API reste en développement. Ce n'est pas un déploiement. Après une modification frontend : `npm run build`, puis relancer la prévisualisation. Pour le rechargement à chaud : `npm run dev:local` ; le service worker n'est volontairement pas enregistré par Vite en mode dev. Ne pas conserver une ancienne PWA installée/cache actif pendant une comparaison de versions sans vérifier la mise à jour.

Utiliser `localhost` pour les interfaces : les contrôles Origin autorisent exactement ces trois origines. L'API écoute sur IPv4 `127.0.0.1` ; `/health` répond sans authentification. Une erreur 404 sur `/` de l'API n'est pas une panne.

## Accès aux comptes fictifs

```powershell
# Affichage UNIQUEMENT sur le PC ; ne pas copier ce contenu dans une PR :
Get-Content .local/accounts.json
# Lire les futurs OTP et e-mails simulés :
Get-Content .local/api.log -Tail 60 -Wait
```

Les PIN et mots de passe sont générés aléatoirement. Les adresses et téléphones sont fictifs ; aucun message externe n'est envoyé. `.local/accounts.json` et `.env.local` sont ignorés par Git. Les accords préacceptés par les fixtures sont des acceptations fictives de DÉMO, pas des signatures client.

### PWA : propriétaire, gérant, employé et comptable

1. Ouvrir http://localhost:5173 dans Chrome/Edge. Installer GoBilan depuis l'interface du navigateur si proposé, puis ouvrir l'application installée. L'accès standalone est obligatoire ; aucune désactivation de cette règle n'a été ajoutée. Les tests Chromium émulent ce signal et ne prouvent pas l'installation physique.
2. Au premier accès sur cet appareil, choisir **Créer mon compte / nouvel appareil**, **Bénin**, puis le numéro national du profil choisi (retirer `+229` du téléphone présent dans `users` du fichier local).
3. Cliquer **Recevoir le code** ; lire la ligne `[DEV WHATSAPP] ... code=1234` correspondant à ce téléphone dans `.local/api.log`, saisir le code. Le compte existe déjà : l'OTP ouvre son accès sans recréer le business.
4. Aux connexions suivantes sur cet appareil connu, sélectionner Bénin, saisir le numéro et le PIN de `users`. Le quatrième chiffre déclenche la connexion. Les cookies conservent la session ; une déconnexion permet de tester à nouveau le PIN.

| Entrée `users` du fichier local | Parcours attendu |
|---|---|
| Patron Démo | Dashboard propriétaire, business « Boutique Démo locale », CA 48 500 FCFA et caisse théorique 52 500 FCFA à la création des fixtures ; Bilans / Équipe |
| Gérant Démo | Permission Gestion complète ; Accueil / Historique ; accès aux bilans autorisés et saisie. Voir l'ambiguïté CDC §5.3/§5.5 dans le handoff |
| Caissier Démo | Employé en Saisie seule ; formulaire et historique personnel ; les bilans des autres auteurs sont filtrés serveur |
| Comptable Démo | Lecture seule ; aucun envoi de bilan |

Ces fixtures n'ajoutent pas de bilans artificiels aux employés : leur historique personnel est initialement vide. L'essai expire normalement après sept jours, puis les règles de grâce/blocage s'appliquent. L'environnement local ne contient pas de vrai moyen de renouvellement.

Pour une visite graphique immédiate sans installation : http://localhost:5173/?demo=1 ouvre la **DÉMO en mémoire**, avec les personnages et le PIN indiqués à l'écran. Elle ne montre pas les comptes PostgreSQL. `?demo=0` quitte cette démo ; la page d'installation réapparaît hors standalone.

### Partenaires : agent, manager, influenceur

Ouvrir http://localhost:5174 et utiliser les champs `email` / `password` de l'entrée correspondante dans `partners` du fichier local. Il n'y a pas de second facteur partenaire.

| Rôle dans `partners` | Ce qu'il faut examiner |
|---|---|
| `agent` | Code KOFFI229, parrainages, gains, versements et bloc Paiement |
| `manager` | Équipe, création d'un agent et suivi des gains de l'équipe ; aucun code personnel |
| `influencer` | Code DEMO229, abonnés, gains et bloc Paiement ; aucune création d'agent |

Les comptes préparés sont déjà activés avec des accords fictifs. Pour tester une activation réelle dans cet environnement : depuis l'administration créer un manager ou influenceur avec une nouvelle adresse `.test`, puis récupérer `Activez votre accès : http://localhost:5174/activer?token=...` dans `.local/api.log`. Ouvrir le lien en navigation privée, créer le mot de passe et accepter l'accord. Pour un agent, créer l'invitation depuis son manager. Le lien est à usage unique, sept jours ; aucun mot de passe n'est envoyé.

### Administrateur

Ouvrir http://localhost:5175, utiliser une entrée de `admins` du fichier local, puis saisir le code à six chiffres de l'e-mail Dev **Code de connexion GoBilan Admin**, ligne `Votre code : ...` dans `.local/api.log`. Un nouveau code est requis à chaque connexion. Deux comptes fictifs sont préparés : principal et secours.

Les trois audiences ont des cookies différents, mais localhost partage les cookies entre ports. Utiliser des profils/navigation privée séparés pour comparer deux comptes du même type en parallèle. Ne pas vider tous les cookies si une autre recette est en cours.

### Réinitialiser un accès sans supprimer les données

- PWA : **PIN oublié ?**, pays/numéro, OTP Dev, puis nouveau PIN. Sur appareil inconnu, passer d'abord par l'OTP. La création du PIN traverse actuellement les écrans de parrainage/nom après réinitialisation : point UX ouvert.
- Partenaire : **Mot de passe oublié ?**, e-mail fictif, code à six chiffres dans le journal Dev, nouveau mot de passe.
- Admin principal : modifier uniquement `DEV_SEED_ADMIN_PASSWORD` dans `.env.local`, conserver les clés de chiffrement/pepper, puis redémarrer l'API locale. Les autres admins se gèrent par confirmation e-mail depuis l'interface.
- Reporter manuellement le nouvel accès dans le fichier de comptes local si nécessaire. `npm run seed:local` est idempotent et **ne réinitialise pas** les comptes existants.

Les quotas OTP et blocages PIN restent actifs : quatre essais, dix minutes par code, deux demandes par téléphone sur 24 h, quotas appareil/IP complémentaires. Ne pas désactiver les protections pour la recette. Aucune commande de suppression de cluster ni de remise à zéro des données n'est fournie.

## Reproduire sur un nouveau checkout Windows

Prérequis : Node >=22, npm, PostgreSQL installé ; binaires utilisés ici dans `C:/Program Files/PostgreSQL/18/bin`. Le cluster existant du PC sur 5432 n'est pas utilisé.

```powershell
npm ci --registry=https://registry.npmjs.org
npx playwright install chromium
New-Item -ItemType Directory -Force .local | Out-Null
if ((Test-Path .env.local) -or (Test-Path .local/postgres)) { throw 'Configuration existante : la conserver et suivre la section de démarrage.' }
$localPassword = node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
[IO.File]::WriteAllText((Join-Path $PWD '.local/pg-password.txt'), $localPassword)
& 'C:\Program Files\PostgreSQL\18\bin\initdb.exe' -D .local/postgres -U gobilan_local --auth=scram-sha-256 --pwfile=.local/pg-password.txt --encoding=UTF8 --locale=C
if ($LASTEXITCODE -ne 0) { throw 'initdb a échoué ; ne pas poursuivre.' }
& 'C:\Program Files\PostgreSQL\18\bin\pg_ctl.exe' -D .local/postgres -l .local/postgres.log -o '-h 127.0.0.1 -p 55432' -w start
if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL a échoué ; ne pas poursuivre.' }
$testDatabase = "postgresql://gobilan_local:${localPassword}@127.0.0.1:55432/postgres"
$developmentDatabase = $testDatabase + '?options=-c%20search_path%3Dgobilan_local'
$pepper = node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
$payoutKey = node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
$webhookSecret = node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
$adminPassword = node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
@(
  "DATABASE_URL=$developmentDatabase", "TEST_DATABASE_URL=$testDatabase", "E2E_DATABASE_URL=$testDatabase",
  "PIN_PEPPER_HEX=$pepper", "PAYOUT_KEY_HEX=$payoutKey", "FEDAPAY_WEBHOOK_SECRET=$webhookSecret",
  'DEV_SEED_ADMIN_EMAIL=admin@novadis.test', "DEV_SEED_ADMIN_PASSWORD=$adminPassword"
) | Set-Content .env.local -Encoding utf8
node --env-file=.env.local --input-type=module -e "import pg from 'pg'; const u=new URL(process.env.DATABASE_URL); u.searchParams.delete('options'); const c=new pg.Client({connectionString:u.toString()}); await c.connect(); await c.query('create schema if not exists gobilan_local'); await c.end();"
npm run seed:local
npm run check
npm run preview:local
```

Les noms des variables réellement attendues sont dans `.env.example`. Les commandes `dev:api` séparées ne chargent pas automatiquement `.env.local` ; le lanceur commun et `seed:local` le chargent explicitement. Garder les secrets stables pour conserver l'accès aux données persistantes.

## Rejouer les tests

Arrêter d'abord les quatre serveurs pour libérer leurs ports avant les E2E. Exécuter les suites lourdes successivement pour éviter la saturation Windows.

```powershell
npm run check
node --env-file=.env.local node_modules/vitest/vitest.mjs run --root apps/api --maxWorkers=2 --hookTimeout=30000
node --env-file=.env.local e2e/run-smoke.mjs
npm audit --omit=dev --audit-level=high
npm run preview:local
```

Le second appel charge `TEST_DATABASE_URL`, puis exécute tous les tests API sur PostgreSQL réseau. Ne pas charger `.env.local` autour du check rapide si l'on souhaite conserver sa validation PGlite distincte. Les schémas SQL/E2E sont aléatoires et isolés ; seule leur suppression automatique est prévue. Le schéma persistant `gobilan_local` n'est pas effacé.

Les journaux E2E indiquent leur dossier temporaire ; les dernières captures/PDF de cette recette sont copiés dans `.local/evidence/`. Ils restent locaux. Le journal API contient des codes d'accès fictifs : ne pas le publier.
