# Plan d'implémentation

État au lot `feat/android-foundation`. Légende : **fait** (avec données fictives), **partiel**, **à faire**.

## Mission 1 — fondation Android (cette branche)

| Domaine | Cahier | État |
| --- | --- | --- |
| Expo + TypeScript + Expo Router, Android uniquement | — | fait |
| Design system, palette officielle, logo SVG | §7 | fait (icône d'app / splash : placeholders Expo à remplacer) |
| Auth simulée OTP + PIN local, session persistante | §3.2, §5.0 | fait (mock) |
| Création de business (nom, secteur, stock, rappel), rôles suggérés | §4.1 | fait |
| Rôles personnalisés, permissions, hiérarchie | §4.2, §4.3 | fait |
| Invitations (acceptation / refus) | §4.2bis | fait |
| Retrait d'un membre (soft delete) | §4.4 | fait |
| Navigation multi-business, CA du jour dans le menu, jours d'abonnement | §4.5 | fait |
| Accueil manager, bilan du jour (CA, dépenses, ajouts, détail optionnel, stock, note) | §5.1 | fait |
| Multi-contributeurs, historique personnel | §5.2, §5.4 | fait |
| Caisse théorique (dérivée, cascade) | §5.3 | fait |
| Modification 24 h, deux versions consultables | §5.5 | fait |
| Dashboard (CA / dernier bilan daté, comparaison veille, périodes, « En attente du bilan », état vide) | §6.1, §6.3 | fait |
| Détail du jour par contributeur et décomposition de la caisse | §6.2 | fait, **sauf PDF** |
| Abonnement en lecture seule | §6.4, §9.5 | fait |
| Aide « Comment utiliser l'application » par rôle | §6.5 | fait (texte ; vidéos à intégrer plus tard) |
| Stock facultatif | §5.1 | fait (ajout d'articles ; pas de réapprovisionnement ni d'édition) |
| États vides / chargement / erreur / validation | — | fait |

## Prochains lots (ordre proposé)

1. **Stabilisation et démonstration** (priorité actuelle, avant tout backend)
   - *Fait (mission 02)* : reliquats du template Expo supprimés, dépendances inutiles retirées, exclusions `tsc`/ESLint supprimées, branche publiée.
   - **Essai sur téléphone Android / émulateur** (jamais réalisé) : rendu, clavier numérique, pavé PIN, menu latéral, modales, safe areas, retour système. Corriger les écarts constatés.
   - Accessibilité TalkBack, grandes polices, contrastes.
   - Icône d'application, icône adaptive et splash BilanGo (images Expo temporaires ; le fond est déjà #0F6E56).
   - Réduire le poids : n'embarquer que la police Ionicons.
   - PDF « Télécharger le bilan » (§6.2) si la démonstration l'exige : texte pur, généré au clic (`expo-print` + partage).
2. **Backend** (Supabase prévu au cahier §9.6) : schéma (utilisateurs, business, rôles, membres, invitations, bilans + versions, stock, abonnements, paiements), **RLS stricte par business et par niveau**, fonctions transactionnelles (envoi / modification de bilan, acceptation d'invitation, prolongation d'abonnement), implémentation HTTP de `Services`, remplacement de `composition.ts`.
3. **Authentification réelle** : OTP via l'API WhatsApp Business (template « Authentication »), rate limiting (par numéro, par appareil/IP), CAPTCHA, jeton de session long, PIN stocké sous forme de verrou local (pas de secret serveur).
4. **Notifications push (FCM)** : rappel manager à l'heure du business, nouveau bilan, bilan modifié, expiration d'abonnement. Jetons d'appareil, tâche planifiée côté serveur.
5. **PDF du bilan** (§6.2) : texte pur, généré à la volée au clic (`expo-print` + partage), jamais stocké.
6. **Paiement et abonnement** (côté serveur uniquement, §9) : transaction Fedapay avec `merchant_reference` unique et `custom_metadata`, lien envoyé par WhatsApp, webhook signé, rattrapage horaire, règle de prolongation (déjà codée dans `domain/subscription.ts`). L'app reste en lecture seule.
7. **Essai gratuit anti-fraude** : durée à fixer (5–7 j recommandés), identifiant d'appareil en plus du numéro.
8. **Publication Play Store** : EAS Build `.aab`, politique de confidentialité publiée (§9.6), test fermé (12 testeurs / 14 jours), fiche et visuels.
9. **Réglages manquants** : édition du business (nom, module Stock, suppression), rôles (renommer / supprimer), réapprovisionnement de stock, pagination de l'historique (aujourd'hui l'historique complet est chargé), mode hors-ligne minimal.

## Questions ouvertes pour le client (à valider — aucune n'est tranchée)

Les trois premières portent sur des interprétations déjà implémentées dans la démo ; leur choix actuel est provisoire.

1. **Numéro déjà invité** (cahier §3.3 vs §4.2bis). Implémenté : le compte arrive sur l'écran Invitations et n'accède au business qu'après acceptation. Alternative : accès direct au dashboard dès l'inscription, sans acceptation.
2. **Un bilan par auteur et par jour.** Implémenté : un même auteur envoie un seul bilan par jour (puis « Modifier » pendant 24 h) ; plusieurs contributeurs possibles. Alternative : autoriser plusieurs bilans par personne (ex. deux postes).
3. **Nom demandé à la première connexion.** Implémenté : un écran demande le nom (affiché sur les bilans) après l'OTP, car l'inscription se fait par téléphone seul. Alternative : le propriétaire saisit le nom à l'invitation.

Autres points non spécifiés :

4. Comportement à l'expiration de l'abonnement : lecture seule, blocage de la saisie, période de grâce ? (aujourd'hui rien n'est bloqué)
5. Antidatage d'un bilan oublié la veille ? (aujourd'hui impossible)
6. La création de rôles reste-t-elle réservée au propriétaire ?
7. Durée exacte de l'essai gratuit.

## Hors périmètre de cette branche

Back-office web, programme d'affiliation (§12, suivi manuel au départ), V2 (§13). Le **backend réel n'est pas commencé** (lots 2 à 8 ci-dessus) : la priorité est de stabiliser l'application Android et de préparer une démonstration client. La branche `feat/android-foundation` est publiée sur GitHub ; elle n'est pas fusionnée dans `main`.
