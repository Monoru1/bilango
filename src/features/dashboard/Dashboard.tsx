import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable } from 'react-native';

import { formatDayLong, formatDayRelative, toDayKey } from '@/domain/dates';
import { formatFcfa } from '@/domain/money';
import { can } from '@/domain/permissions';
import type { Access, Business } from '@/domain/types';
import { CashDayCard } from './CashDayCard';
import { useQuery, useServices } from '@/state/services';
import { AsyncBoundary, EmptyState } from '@/ui/feedback';
import { Segmented } from '@/ui/forms';
import { AmountRow, BigAmount } from '@/ui/numbers';
import { Badge, Button, Card, Icon, Row, Screen, Text } from '@/ui/primitives';
import { colors, spacing } from '@/ui/theme';

const PERIODS = [
  { value: 1, label: "Aujourd'hui" },
  { value: 7, label: '7 jours' },
  { value: 30, label: '30 jours' },
] as const;

type Period = (typeof PERIODS)[number]['value'];

export function Dashboard({ userId, business, access }: { userId: string; business: Business; access: Access }) {
  const router = useRouter();
  const services = useServices();
  const [period, setPeriod] = useState<Period>(1);
  const query = useQuery(['dashboard', business.id, userId, period], () =>
    services.reports.dashboard(business.id, userId, period),
  );
  const today = toDayKey(services.now());

  return (
    <Screen
      footer={
        can(access, 'submitReport') ? (
          <Button label="Faire le bilan du jour" icon="create-outline" onPress={() => router.push('/report/new')} />
        ) : undefined
      }
    >
      <Segmented options={[...PERIODS]} value={period} onChange={setPeriod} />
      <AsyncBoundary query={query}>
        {(data) => {
          if (data.isFirstUse) {
            return (
              <EmptyState
                icon="hourglass-outline"
                title="Pas encore de bilan"
                message="Votre équipe n'a pas encore fait son premier bilan. Dès qu'il sera envoyé, vous verrez tout apparaître ici."
              />
            );
          }
          const h = data.headline;
          const showToday = period === 1;
          const headlineDay = h.day;
          return (
            <>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Voir le détail du bilan"
                disabled={!showToday || !headlineDay}
                onPress={() => headlineDay && router.push({ pathname: '/day/[day]', params: { day: headlineDay } })}
              >
                <Card tone="primary" style={{ gap: spacing.sm }}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <Text variant="label" tone="onPrimary">
                      {showToday && headlineDay
                        ? `Chiffre d'affaires — ${formatDayRelative(headlineDay, today)}`
                        : `Chiffre d'affaires — ${period} derniers jours`}
                    </Text>
                    {showToday && h.awaitingToday ? <Badge label="En attente du bilan" tone="info" icon="time-outline" /> : null}
                  </Row>
                  <BigAmount value={showToday ? h.revenue : data.period.revenue} tone="onPrimary" />
                  {showToday && headlineDay ? (
                    <Text variant="caption" style={{ color: colors.primaryLight }}>
                      {h.kind === 'last' ? `Dernier bilan reçu : ${formatDayLong(headlineDay)}` : formatDayLong(headlineDay)}
                      {h.deltaPercent !== null
                        ? ` · ${h.deltaPercent >= 0 ? '+' : ''}${h.deltaPercent} % vs la veille`
                        : h.previousRevenue !== null
                          ? ` · veille : ${formatFcfa(h.previousRevenue)}`
                          : ''}
                    </Text>
                  ) : (
                    <Text variant="caption" style={{ color: colors.primaryLight }}>
                      {data.period.reportCount} bilan{data.period.reportCount > 1 ? 's' : ''} reçu
                      {data.period.reportCount > 1 ? 's' : ''}
                    </Text>
                  )}
                  {showToday && headlineDay ? (
                    <Row style={{ gap: spacing.xs }}>
                      <Text variant="caption" tone="onPrimary">
                        Voir le détail
                      </Text>
                      <Icon name="chevron-forward" size={14} color={colors.textOnPrimary} />
                    </Row>
                  ) : null}
                </Card>
              </Pressable>

              <CashDayCard cash={data.cash} missing={data.openingCashMissing} />

              <Card>
                <Text variant="heading">{showToday && headlineDay ? 'Détail du jour' : 'Sur la période'}</Text>
                <AmountRow label="Dépenses" value={(showToday ? data.headlineTotals : data.period)?.expenses ?? 0} />
                <AmountRow label="Ajouts à la caisse" value={(showToday ? data.headlineTotals : data.period)?.cashIn ?? 0} />
              </Card>
            </>
          );
        }}
      </AsyncBoundary>
    </Screen>
  );
}

