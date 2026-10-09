import { useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';

import { formatDayLong, formatTime } from '@/domain/dates';
import { formatFcfa } from '@/domain/money';
import { currentVersion } from '@/domain/reports';
import { useCurrentBusiness } from '@/state/business';
import { useQuery, useServices } from '@/state/services';
import { AsyncBoundary, EmptyState } from '@/ui/feedback';
import { AmountRow, BigAmount } from '@/ui/numbers';
import { Badge, Card, Divider, ListItem, Screen, Text } from '@/ui/primitives';
import { colors, spacing } from '@/ui/theme';

/** Détail d'une journée (cahier §6.2) : qui a rapporté quoi et quand, et décomposition de la caisse. */
export default function DayDetail() {
  const { day } = useLocalSearchParams<{ day: string }>();
  const router = useRouter();
  const services = useServices();
  const { user, overview } = useCurrentBusiness();
  const query = useQuery(['dayView', overview.business.id, user.id, day], () =>
    services.reports.dayView(overview.business.id, user.id, day),
  );

  return (
    <Screen>
      <Text variant="title">{formatDayLong(day)}</Text>
      <AsyncBoundary query={query}>
        {(view) => {
          if (view.reports.length === 0) {
            return <EmptyState icon="hourglass-outline" title="Aucun bilan ce jour-là" message="Aucun bilan n'a été reçu pour cette journée." />;
          }
          return (
            <>
              <Card tone="primary">
                <Text variant="label" tone="onPrimary">
                  Chiffre d'affaires du jour
                </Text>
                <BigAmount value={view.totals.revenue} tone="onPrimary" />
                <Text variant="caption" style={{ color: colors.primaryTint }}>
                  Somme de {view.reports.length} bilan{view.reports.length > 1 ? 's' : ''}
                </Text>
              </Card>

              <Card>
                <Text variant="heading">Par contributeur</Text>
                {view.reports.map((r, i) => {
                  const c = currentVersion(r).content;
                  return (
                    <View key={r.id}>
                      {i > 0 ? <Divider /> : null}
                      <ListItem
                        accessibilityLabel={`${r.authorName}, envoyé à ${formatTime(r.submittedAt)}, chiffre d'affaires ${formatFcfa(c.revenue.total)}${
                          r.versions.length > 1 ? ', modifié' : ''
                        }`}
                        title={r.authorName}
                        subtitle={`Envoyé à ${formatTime(r.submittedAt)}${
                          c.revenue.lines.length === 0 && c.revenue.total > 0 ? ' · non détaillé' : ''
                        }`}
                        right={
                          <View style={{ alignItems: 'flex-end', gap: spacing.xs }}>
                            <Text variant="bodyStrong">{formatFcfa(c.revenue.total)}</Text>
                            {r.versions.length > 1 ? <Badge label="Modifié" tone="info" /> : null}
                          </View>
                        }
                        onPress={() => router.push({ pathname: '/report/[id]', params: { id: r.id } })}
                        chevron
                      />
                    </View>
                  );
                })}
                {view.reports.some((r) => {
                  const c = currentVersion(r).content;
                  return c.revenue.lines.length === 0 && c.expenses.lines.length === 0 && c.cashIn.lines.length === 0;
                }) ? (
                  <Text variant="caption" tone="muted">
                    {view.reports.length > 1
                      ? "Certains contributeurs n'ont pas détaillé leur bilan."
                      : "Votre manager n'a pas détaillé le bilan aujourd'hui."}
                  </Text>
                ) : null}
              </Card>

              <Card tone="tint">
                <Text variant="heading" tone="primary">
                  Caisse théorique
                </Text>
                {view.cash ? (
                  <>
                    <AmountRow label="Caisse de la veille" value={view.cash.opening} />
                    <AmountRow label="+ Chiffre d'affaires" value={view.cash.revenue} />
                    <AmountRow label="+ Ajouts à la caisse" value={view.cash.cashIn} />
                    <AmountRow label="− Dépenses" value={view.cash.expenses} />
                    <Divider />
                    <AmountRow label="Caisse théorique" value={view.cash.closing} strong tone="primary" />
                    <Text variant="caption" tone="muted">
                      Calcul automatique : aucun écart n'est signalé. Seul un comptage physique de la caisse permet un vrai contrôle.
                    </Text>
                  </>
                ) : (
                  <Text tone="secondary">Caisse de départ non encore déclarée.</Text>
                )}
              </Card>
            </>
          );
        }}
      </AsyncBoundary>
    </Screen>
  );
}
