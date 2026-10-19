# Modèle de sécurité — intégration Codex

## Authentification et sessions

PIN et mots de passe hachés scrypt + pepper serveur ; OTP et jetons de session hachés en base. Aucun PIN, preuve OTP ou cookie de session n'est persisté dans le stockage navigateur. Seul l'identifiant d'installation aléatoire est conservé en localStorage. Une preuve OTP ne vit qu'en mémoire.

Cookies distincts gb_user, gb_partner, gb_admin, httpOnly, SameSite=Lax, Secure par défaut dans buildApp. Le lanceur de développement emploie HTTP et secure=false, et REFUSE NODE_ENV=production tant que les fournisseurs ne sont pas branchés. Des domaines distincts sont nécessaires pour les audiences de production. Sur localhost les ports ne séparent pas les cookies : les E2E utilisent des contextes navigateur distincts.

PIN : quatre erreurs, cinq minutes de blocage, durée doublée aux séries suivantes. Compteur transactionnel verrouillé, échecs validés avant de lever l'erreur. Révocation des autres appareils exposée par route authentifiée et protégée CSRF.

OTP : usage unique, dix minutes, quatre essais, deux demandes/24 h par numéro. Quotas complémentaires par installation/IP, désormais verrouillés sur toutes les clés partagées dans un ordre stable. Les créations concurrentes de business verrouillent le compte et l'installation pour ne concéder qu'un essai.

## Transport, CSRF et proxy

Toutes les mutations authentifiées exigent x-gobilan-csrf:1 et une Origin autorisée pour l'audience. Aucun CORS permissif : les applications passent par leur proxy de même origine /v1. Les GET ne modifient aucune donnée métier. Les webhooks sont hors CSRF et utilisent une signature sur le corps brut.

trustProxy=false : un client ne peut plus fabriquer son IP via X-Forwarded-For. Toute future confiance proxy doit être limitée aux relais effectivement contrôlés, avec tests avant mise en production. Le rate limiting Fastify reste local au processus ; les quotas OTP sont en base.

## Permissions et données

requireAccess vérifie l'appartenance active à chaque opération ; un autre tenant reçoit 404. Le workspace PWA n'est pas un accès SQL générique : rôle courant et filtres appliqués serveur. Un compte en saisie seule reçoit ses bilans et les quantités stock, sans les autres bilans, l'équipe ou les paiements. Aucun rôle ne peut retirer le propriétaire ou un pair/supérieur.

Un propriétaire bloqué ne reçoit plus les bilans/la caisse via workspace, list ou get ; son abonnement reste consultable. L'employé conserve son historique personnel, avec saisie refusée côté serveur et message neutre. Les données chargées sont purgées si session expirée ou chargement réseau échoué ; aucune bascule silencieuse en démo.

## Paiements, commissions et audit

Confirmation uniquement après signature + relecture passerelle, référence/montant cohérents et identifiant EXACT de la transaction liée au paiement. Paiement et business verrouillés, prolongation et commissions atomiques. Évènements et clés de commission idempotents. Remboursements/contestations corrigent le journal par lignes inverses.

Versions de bilan, commissions et audit append-only par triggers SQL. Versements manuels validés par admin, montant recalculé, interdiction de verser deux fois une même ligne active. Numéro et nom Mobile Money chiffrés AES-256-GCM. Corrections de coordonnées et journal avant/après écrits dans une seule transaction ; les champs personnels du journal restent chiffrés.

## Administration

Allowlist relue à chaque requête. Mot de passe puis code e-mail à chaque connexion ; le code est lié à l'identifiant précis du challenge, à usage unique. Les tentatives partenaires/admin sont sérialisées aussi lorsque le compteur n'existe pas encore.

Ajout/retrait d'admin : demande authentifiée, code e-mail au demandeur, dix minutes, confirmation liée à la demande et au demandeur, quota et quatre essais. Aucun changement avant confirmation. Conservation d'au moins deux admins lors d'un retrait ; sessions de l'adresse retirée révoquées immédiatement ; journal ancien/nouvel état. Le bootstrap initial peut créer une seule adresse en développement ; une seconde adresse effective reste exigée avant production.

## Limites explicites

Pas de validation de sécurité exhaustive ni de pentest. CAPTCHA, WhatsApp, SMTP et push sont des fournisseurs Dev. FedaPay externe non homologué. Hébergement TLS, secrets gérés, rotation, sauvegardes/restauration, comptes DB nominatifs et limites distribuées restent à réaliser. La détection automatique des liens familiaux ou de propriété d'un partenaire n'est pas possible avec les données présentes : exclusions administratives manuelles. Des hypothèses de règles métier de Claude restent à confirmer au client (DECISIONS.md).

## Cycle de vie des rôles

Les rôles applicatifs sont modifiables par le propriétaire uniquement ; leur permission est relue sur chaque accès. L'archivage conserve la ligne SQL et refuse un rôle encore attribué ou proposé dans une invitation. Invitation et archivage sont sérialisés sur le business.

Une transition de rôle partenaire est refusée si le compte porte une équipe, un parrainage, une attribution de code sur un compte utilisateur ou des écritures de commission. Elle ne réécrit donc jamais les obligations existantes. Une transition admise révoque les sessions, exige le nouvel accord, valide le code et le manager du même pays, et écrit les valeurs avant/après dans le journal. Les opérations de rattachement, de profil et de changement de rôle verrouillent le partenaire pour prévenir les courses.
