# Contrôles avant intégration finale

Date du relevé : 12 novembre 2026. La branche distante de livraison et le déploiement Render actif sont à `8a3ad832858b5283812d9eeee525721a902e7b8f` (déploiement `dep-dbqt3q67bikc738av85g`). Les réponses HTTP ont été mesurées sans cookie.

| Interface | URL de base | Accueil ou disponibilité | Route de session | Provenance |
| --- | --- | --- | --- | --- |
| PWA | https://deploy-preview-12--gobilan-pwa.netlify.app | `/ → 200 HTML` | `/v1/me → 401 JSON` | SHA frontend non établi par ce contrôle |
| Administration | https://gobilan-admin-recette.netlify.app | `/ → 200 HTML` | `/v1/admin/me → 401 JSON` | Déploiement Netlify `6af5d011f727d4912434dab1`, branche et SHA absents des métadonnées |
| Partenaires | https://gobilan-partenaires-recette.netlify.app | `/ → 200 HTML` | `/v1/partner/me → 401 JSON` | Déploiement Netlify `6af5cfec76e222320380b099`, branche et SHA absents des métadonnées |
| API Render | https://gobilan-recette-api.onrender.com | `/ready → 200 JSON` | — | `8a3ad83` selon Render |

Ces contrôles attestent l’accessibilité et le refus sans session. Les parcours authentifiés, l’isolation des sessions entre origines, le CSV hébergé et les fournisseurs attendent une nouvelle recette sur des déploiements identifiés avec comptes autorisés. Les branches d’intégration et la migration ne sont pas déployées. Le connecteur SQL Render ne peut pas inspecter le schéma car les connexions externes sont bloquées. Aucune archive de la base hébergée n’a été transférée ni restaurée lors de ces contrôles.

Sur la preview PWA, `/v1/auth/config` annonce `captcha.provider=dev`, `demo.whatsappSimulated=true`, `payments.enabled=false` et `payments.mode=sandbox`. Ce sont les réglages exposés par le déploiement actuel. Les réglages SMTP et VAPID ne sont pas établis par cette route.
