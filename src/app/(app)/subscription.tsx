import { View } from 'react-native';

import { formatDateTime, formatDayFull, toDayKey } from '@/domain/dates';
import { formatFcfa } from '@/domain/money';
import { can } from '@/domain/permissions';
import { SUBSCRIPTION_DAYS, SUBSCRIPTION_PRICE_FCFA } from '@/domain/subscription';
import { useCurrentBusiness } from '@/state/business';
import { useQuery, useServices } from '@/state/services';
import { AsyncBoundary, Banner, EmptyState } from '@/ui/feedback';
import { Badge, Card, Divider, ListItem, Screen, SectionTitle, Text } from '@/ui/primitives';

/**
 * Abonnement en LECTURE SEULE (cahier §6.4 et §9.5) : statut, jours restants, historique.
 * Aucun bouton ni parcours de paiement : le renouvellement passe par un lien envoyé hors de l'app.
 */
export default function SubscriptionScreen() {
  const services = useServices();
  const { user, overview } = useCurrentBusiness();
  const { business, access } = overview;
  const query = useQuery(['subscription', business.id, user.id], () => services.subscriptions.get(business.id, user.id));

  if (!can(access, 'viewSubscription')) {
    return (
      <Screen>
        <EmptyState
          icon="lock-closed-outline"
          title="Réservé au propriétaire"
          message="Seul le propriétaire du business gère et consulte l'abonnement."
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <Text variant="title">{business.name}</Text>
      <AsyncBoundary query={query}>
        {(view) => {
          const end = view.endsAt ? formatDayFull(toDayKey(view.endsAt)) : null;
          const label =
            view.status === 'active'
              ? `Actif jusqu'au ${end}`
              : view.status === 'trial'
                ? `Essai gratuit jusqu'au ${end}`
                : end
                  ? `Expiré depuis le ${end}`
                  : 'Aucun abonnement';
          return (
            <>
              <Card tone={view.status === 'expired' ? 'surface' : 'primary'}>
                <Badge
                  label={view.status === 'active' ? 'Actif' : view.status === 'trial' ? 'Essai gratuit' : 'Expiré'}
                  tone={view.status === 'expired' ? 'negative' : 'positive'}
                />
                <Text variant="heading" tone={view.status === 'expired' ? 'default' : 'onPrimary'}>
                  {label}
                </Text>
                {view.status !== 'expired' ? (
                  <>
                    <Text variant="display" tone="onPrimary" accessibilityLabel={`${view.daysRemaining} jours restants`}>
                      {view.daysRemaining}
                    </Text>
                    <Text variant="caption" tone="onPrimary">
                      jour{view.daysRemaining > 1 ? 's' : ''} restant{view.daysRemaining > 1 ? 's' : ''}
                    </Text>
                  </>
                ) : null}
              </Card>

              <Banner>
                Abonnement : {formatFcfa(SUBSCRIPTION_PRICE_FCFA)} pour {SUBSCRIPTION_DAYS} jours, par Mobile Money. Le lien de paiement vous est envoyé sur WhatsApp ; rien ne se paie dans l'application. Si vous renouvelez avant l'échéance, les {SUBSCRIPTION_DAYS} jours s'ajoutent aux jours restants.
              </Banner>

              <SectionTitle>Historique des paiements</SectionTitle>
              {view.subscription.payments.length === 0 ? (
                <Text tone="secondary">Aucun paiement pour l'instant.</Text>
              ) : (
                <Card style={{ gap: 0 }}>
                  {view.subscription.payments.map((p, i) => (
                    <View key={p.id}>
                      {i > 0 ? <Divider /> : null}
                      <ListItem
                        title={formatFcfa(p.amount)}
                        subtitle={`${formatDateTime(p.paidAt)} · ${p.provider}\nRéf. ${p.reference}`}
                      />
                    </View>
                  ))}
                </Card>
              )}
            </>
          );
        }}
      </AsyncBoundary>
    </Screen>
  );
}
