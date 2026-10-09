import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { formatTime } from '@/domain/dates';
import { editWindowEnd, canEditReport, can } from '@/domain/permissions';
import type { Access, Business } from '@/domain/types';
import { CashDayCard } from '@/features/dashboard/CashDayCard';
import { editHint } from '@/features/reports/format';
import { useDeadlineClock, useQuery, useServices } from '@/state/services';
import { AsyncBoundary, Banner } from '@/ui/feedback';
import { Button, Card, Row, Screen, Text, Icon } from '@/ui/primitives';
import { colors, spacing } from '@/ui/theme';

/** Accueil du manager / employé (cahier §5.0) : caisse en évidence, bilan du jour, bilans précédents. */
export function ManagerHome({ userId, business, access }: { userId: string; business: Business; access: Access }) {
  const router = useRouter();
  const services = useServices();
  const query = useQuery(['managerHome', business.id, userId], () => services.reports.managerHome(business.id, userId));
  const now = useDeadlineClock(query.data?.myReportToday ? [editWindowEnd(query.data.myReportToday)] : []);
  const canSubmit = can(access, 'submitReport');

  return (
    <Screen>
      <AsyncBoundary query={query}>
        {(home) => {
          const mine = home.myReportToday;
          const editable = mine ? canEditReport(access, mine, userId, now) : false;
          return (
            <>
              <CashDayCard cash={home.cash} missing={home.openingCashMissing} emphasis />

              {home.openingCashMissing && canSubmit ? (
                <Banner>Comptez la caisse : le montant de départ sera demandé une seule fois, avec votre premier bilan.</Banner>
              ) : null}

              {mine ? (
                <Card tone="tint">
                  <Row>
                    <Icon name="checkmark-circle" color={colors.primary} />
                    <Text variant="bodyStrong" tone="primary">
                      Bilan du jour envoyé à {formatTime(mine.submittedAt)}
                    </Text>
                  </Row>
                  {editable ? (
                    <Text variant="caption" tone="secondary">
                      {editHint(mine, services.now())}
                    </Text>
                  ) : null}
                  <View style={{ gap: spacing.sm, marginTop: spacing.xs }}>
                    {editable ? (
                      <Button
                        label="Modifier mon bilan"
                        variant="secondary"
                        icon="create-outline"
                        onPress={() => router.push({ pathname: '/report/[id]/edit', params: { id: mine.id } })}
                      />
                    ) : null}
                    <Button
                      label="Voir mon bilan"
                      variant="ghost"
                      onPress={() => router.push({ pathname: '/report/[id]', params: { id: mine.id } })}
                    />
                  </View>
                </Card>
              ) : canSubmit ? (
                <Button label="Faire le bilan du jour" icon="create-outline" onPress={() => router.push('/report/new')} />
              ) : null}

              <Button
                label="Voir mes bilans précédents"
                variant="secondary"
                icon="time-outline"
                onPress={() => router.navigate('/reports')}
              />

              <Text variant="caption" tone="muted" align="center">
                Rappel prévu à {business.reminderTime.replace(':', 'h')}. Aucune notification envoyée dans cette démonstration.
              </Text>
            </>
          );
        }}
      </AsyncBoundary>
    </Screen>
  );
}
