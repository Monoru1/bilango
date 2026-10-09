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

1. **Finitions de la fondation**
   - Retirer les reliquats du template Expo (`src/components`, `src/constants`, `src/hooks`, `src/app/explore.tsx`, `scripts/`, `assets/` du template) puis les dépendances devenues inutiles (`@expo/ui`, `expo-glass-effect`, `expo-symbols`, `expo-web-browser`, `expo-device`, `expo-image`, `react-dom`, `react-native-web`) et lever les exclusions de `tsconfig.json` / `eslint.config.js`.
   - Icône d'application, icône adaptive et splash BilanGo (le splash natif est vert #0F6E56 mais utilise encore l'image Expo).
   - Réduire le poids : n'embarquer que la police Ionicons.
   - Essai sur appareil / émulateur Android (non réalisé dans cet environnement) ; accessibilité TalkBack ; grandes polices.
2. **Backend** (Supabase prévu au cahier §9.6) : schéma (utilisateurs, business, rôles, membres, invitations, bilans + versions, stock, abonnements, paiements), **RLS stricte par business et par niveau**, fonctions transactionnelles (envoi / modification de bilan, acceptation d'invitation, prolongation d'abonnement), implémentation HTTP de `Services`, remplacement de `composition.ts`.
3. **Authentification réelle** : OTP via l'API WhatsApp Business (template « Authentication »), rate limiting (par numéro, par appareil/IP), CAPTCHA, jeton de session long, PIN stocké sous forme de verrou local (pas de secret serveur).
4. **Notifications push (FCM)** : rappel manager à l'heure du business, nouveau bilan, bilan modifié, expiration d'abonnement. Jetons d'appareil, tâche planifiée côté serveur.
5. **PDF du bilan** (§6.2) : texte pur, généré à la volée au clic (`expo-print` + partage), jamais stocké.
6. **Paiement et abonnement** (côté serveur uniquement, §9) : transaction Fedapay avec `merchant_reference` unique et `custom_metadata`, lien envoyé par WhatsApp, webhook signé, rattrapage horaire, règle de prolongation (déjà codée dans `domain/subscription.ts`). L'app reste en lecture seule.
7. **Essai gratuit anti-fraude** : durée à fixer (5–7 j recommandés), identifiant d'appareil en plus du numéro.
8. **Publication Play Store** : EAS Build `.aab`, politique de confidentialité publiée (§9.6), test fermé (12 testeurs / 14 jours), fiche et visuels.
9. **Réglages manquants** : édition du business (nom, module Stock, suppression), rôles (renommer / supprimer), réapprovisionnement de stock, pagination de l'historique (aujourd'hui l'historique complet est chargé), mode hors-ligne minimal.

## Questions ouvertes pour le client

1. Numéro déjà invité : l'écran Invitations (choix retenu) convient-il, ou l'accès doit-il être automatique à l'inscription ? (cahier §3.3 vs §4.2bis)
2. Que se passe-t-il à l'expiration de l'abonnement : lecture seule, blocage de la saisie, période de grâce ?
3. Un même auteur peut-il envoyer plusieurs bilans le même jour (ex. deux postes) ou un seul, modifiable 24 h (choix retenu) ?
4. Peut-on antidater un bilan (oubli de la veille) ? Aujourd'hui non.
5. La création de rôles doit-elle rester réservée au propriétaire ?
6. Durée exacte de l'essai gratuit.
7. Faut-il demander le nom à la première connexion (choix retenu) ou le faire saisir par le propriétaire à l'invitation ?

## Hors périmètre de cette branche

Back-office web, programme d'affiliation (§12, suivi manuel au départ), V2 (§13). Rien n'a été poussé ni fusionné.
