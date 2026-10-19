# Modèle de sécurité
- PIN/mots de passe : scrypt + pepper HMAC ; OTP et jetons de session stockés hachés.
- Verrouillage PIN : 4 erreurs → 5 min, doublé à chaque série. OTP : 4 saisies/code, 2 codes/24 h, 10 min.
- Isolation multi-business : `requireAccess` répond 404 aux non-membres.
- Données de versement : AES-256-GCM.
- Journaux commissions/admin : append-only par triggers ; trigger `forbid_double_payout`.
- Webhook FedaPay : HMAC, idempotence, re-vérification passerelle.
- CSRF : en-tête + Origin sur méthodes mutantes ; **les GET ne sont pas contrôlés** (ne doivent rien modifier).
- Cookies par audience ; partenaires/admin sur hôtes distincts obligatoires en production.
## Risques connus
CAPTCHA, envoi e-mail/WhatsApp réels, double authentification admin par e-mail réelle, sauvegardes/restauration, rate-limit distribué (Redis), gestion des secrets et revue juridique non faits. Concurrence réelle PostgreSQL non testée (PGlite uniquement).
