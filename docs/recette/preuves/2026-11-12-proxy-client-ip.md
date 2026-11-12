# Quotas réseau et proxy Netlify

Base de livraison vérifiée avant modification — `13d63a0e2084e3e4c7d5d858b8f520112a5584c8`.

- `npm run check` a réussi avec 395 tests exécutés et 11 tests PostgreSQL réseau ignorés localement. Les quatre applications compilent.
- Les tests de régression utilisent le code de signature Edge et Fastify avec une base isolée. Ils couvrent IPv4 et IPv6, la durée de validité et l’intégrité des preuves, les en-têtes malformés, les requêtes concurrentes, l’isolation entre deux clients et le plafond journalier des requêtes directes. Aucun de ces tests n’envoie de demande OTP à la recette hébergée.
- `npm audit --omit=dev --audit-level=high` a renvoyé zéro vulnérabilité au moment du contrôle.
- Vérifications de la recette existante — la page d’accueil Netlify et `/ready` Render ont répondu HTTP 200. Le bouton d’installation affiche les instructions Chrome et la navigation vers les mentions légales fonctionne dans Chrome cloud.
- Le chemin Edge signé reste à vérifier sur la recette, après intégration et activation des variables décrites dans le modèle de sécurité. Les vérifications HTTP et Chrome ci-dessus concernent la version déjà hébergée.
