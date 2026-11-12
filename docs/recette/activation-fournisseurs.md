# Recette des fournisseurs et préparation commerciale

Les noms ci-dessous proviennent de la configuration GoBilan. Les valeurs sensibles doivent être injectées par les responsables dans l'environnement serveur autorisé. Les preuves de recette contiennent seulement le résultat, la date, le SHA et l'environnement. Aucune activation réelle n'a été effectuée dans ce lot.

| Fournisseur | Configuration à obtenir | Preuve à produire en recette |
| --- | --- | --- |
| Meta WhatsApp | Accès au compte Business et au numéro d'envoi de recette, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_GRAPH_VERSION`, `WHATSAPP_OTP_TEMPLATE`, `WHATSAPP_TEMPLATE_LANGUAGE`, `TEST_WHATSAPP_RECIPIENTS` | Recevoir un OTP sur un destinataire autorisé, achever l'inscription et vérifier les quotas sans journaliser le code. Rappels et rapport du soir attendent l'arbitrage V1, le consentement révocable, les modèles dédiés et le budget. |
| SMTP | Serveur TLS et expéditeur validés, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`, `TEST_EMAIL_RECIPIENTS` | Recevoir et utiliser les liens partenaire et le second facteur admin avec des boîtes de test. |
| Turnstile | Site key PWA autorisée sur le domaine de recette, `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, `TURNSTILE_HOSTNAME` | Réussir un défi réel puis constater le rejet d'un jeton non valable. |
| FedaPay | Compte et clés sandbox, `FEDAPAY_MODE=sandbox`, `FEDAPAY_ACCOUNT_ID`, `FEDAPAY_SECRET_KEY`, `FEDAPAY_WEBHOOK_SECRET`, URL HTTPS de recette `/v1/webhooks/fedapay`, destinataires de test ci-dessus | Checkout sandbox, confirmation vérifiée, rejet d'un événement inadéquat, renouvellement et réconciliation d'un paiement sandbox. Aucun basculement Live. |
| Web Push | `VAPID_SUBJECT`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `TEST_PUSH_ENDPOINTS` | Réception sur Android et iOS installés et éligibles, puis révocation. Les URL d'abonnement restent privées. |

Le mode `PROVIDER_MODE=configured` initialise les cinq adaptateurs. La recette doit réunir leurs paramètres avant de sélectionner ce mode. Le trafic sortant reste soumis à `EXTERNAL_DELIVERY_ENABLED` et `EXTERNAL_PAYMENTS_ENABLED`. Vérifier d'abord les listes de test et ne retirer l'OTP de démonstration qu'au moment de la bascule de recette autorisée.

## Sauvegarde, restauration et supervision

- Les jobs PostgreSQL et conteneur vérifient des restaurations isolées sur des données synthétiques. Réutiliser `scripts/acceptance-backup.sh` comme référence pour contrôler l'archive et restaurer dans une base jetable.
- Valider l'hôte et la région de l'API et de PostgreSQL, le budget, le coffre de secrets, la destination chiffrée hors hôte, les droits d'écriture et de restauration distincts, ainsi que la rétention, le RPO et le RTO. Aucun compte ni stockage payant n'est créé par ce lot.
- Avant la bascule commerciale, produire une sauvegarde chiffrée, vérifier son intégrité, restaurer dans une base isolée sans ordonnanceur ni fournisseurs actifs, puis consigner la durée et les contrôles métier. Confirmer que les clés nécessaires à la restauration sont disponibles par un canal séparé.
- Préparer la supervision de `/ready`, des erreurs API, de l'âge de la dernière sauvegarde et des échecs de l'ordonnanceur. Tester la réception des alertes sur un canal approuvé. Le domaine commercial, la destination des alertes et l'autorisation de bascule restent à confirmer.
