# Mesure d’audience GoBilan v1.2 §12

La collecte est désactivée par défaut dans la PWA et dans l’API. L’activation demande l’arbitrage de confidentialité (dont la vérification APDP prévue au §12), la validation de la notice et de la durée de conservation, la sauvegarde et l’autorisation d’appliquer `008_audience_events.sql`. Les tests utilisent une base isolée.

## Collecte et portée

- Après accord, la PWA enregistre un identifiant aléatoire dans le stockage du navigateur, sans cookie. L’API conserve uniquement ses dérivés HMAC, la date UTC, le type d’événement et les catégories de source et de système. Les identifiants d’audience et de comptes ne sont pas reliés en base. Ni adresse IP, ni user-agent, ni URL, ni code de parrainage ne figurent dans la table.
- Un visiteur est un navigateur distinct sur la période. Une visite utilise une clé d’onglet renouvelée après 30 minutes sans événement de visite. La même visite peut apparaître sur deux jours et n’est alors comptée qu’une fois dans le total de période. Un navigateur peut apparaître sous plusieurs sources. Le total ne s’obtient pas en additionnant ces lignes.
- L’origine s’appuie sur les sources sociales reconnues, le navigateur intégré et les codes `?ref=` d’agents et d’influenceurs actifs. Les autres campagnes sont regroupées sans conserver leurs paramètres. Une origine absente est classée « Direct » si aucun signal n’est disponible.
- Le clic et l’événement navigateur `appinstalled` sont distincts. Seul Android alimente la confirmation. La première ouverture est observée en mode installé avec accord et dédupliquée par stockage navigateur. Sur iOS, le stockage peut être distinct entre Safari et l’app installée. L’entonnoir compte des événements observés sur une période, sans reconstituer un parcours individuel entre ces contextes.
- Seule la création de compte confirmée après OTP et PIN alimente les inscriptions mesurées. Une récupération de PIN ne compte pas. Activation métier et conversion payante sont calculées séparément sur les données opérationnelles du §13 dans la PR #24. Il n’existe pas d’attribution individuelle des paiements à une visite.
- Les demandes GPC/DNT, les user-agents de robots reconnus et les IP d’équipe configurées sont écartés. L’exclusion des robots repose sur des signaux connus et les tests ne garantissent pas l’identification de tous les robots. Les membres de l’équipe en dehors des IP déclarées doivent refuser la mesure sur leurs navigateurs de test. En déploiement, l’IP servant à l’exclusion provient du proxy signé.
- L’utilisateur peut retirer son accord via les mentions légales. La PWA cesse l’envoi et demande l’effacement des événements de l’identifiant courant. Un effacement hors connexion est rejoué lors d’une prochaine ouverture. La proposition de conservation est de 90 jours calendaires, avec purge au démarrage et lors des cycles horaires de l’ordonnanceur pendant l’activation. Avant une désactivation durable, organiser la purge de la table et des sauvegardes selon la politique approuvée.

## Paramètres à appliquer après accord

| Où | Paramètre |
| --- | --- |
| Render | `GOBILAN_AUDIENCE_ENABLED=true`, `GOBILAN_AUDIENCE_KEY_HEX` (clé dédiée de 32 octets, côté serveur), `GOBILAN_AUDIENCE_EXCLUDED_IPS` (liste des IP de sortie d’équipe, côté serveur). Maintenir le proxy signé et l’ordonnanceur. |
| Netlify, build PWA autorisé | `VITE_AUDIENCE_ENABLED=true`. Ce drapeau est public. Aucune clé ou adresse d’équipe ne va dans le build. |
| Recette | Vérifier accord/refus/retrait, source connue et exclusion d’équipe, Android physique, iOS depuis l’icône, inscription et CSV admin. Vérifier aussi la politique de rétention des journaux de plateforme et des sauvegardes. |

L’admin dispose de périodes de 1, 7, 30 jours et d’une période personnalisée, d’agrégats journaliers, de sources et de systèmes. L’export CSV exige une session admin, une origine autorisée et l’en-tête CSRF. Il écrit une entrée d’audit et ne contient que les agrégats. Aucun chiffre de recette hébergée n’est disponible pour ce lot.
