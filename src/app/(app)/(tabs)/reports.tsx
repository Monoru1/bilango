import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { formatDayLong, formatDayRelative, formatTime, toDayKey } from '@/domain/dates';
import { formatFcfa } from '@/domain/money';
import { can, canEditReport } from '@/domain/permissions';
import { currentVersion, isEdited, totalsOfDay } from '@/domain/reports';
import type { Report } from '@/domain/types';
import { useCurrentBusiness } from '@/state/business';
import { useQuery, useServices } from '@/state/services';
import { AsyncBoundary, EmptyState } from '@/ui/feedback';
import { Badge, Card, Divider, ListItem, Screen, Text } from '@/ui/primitives';
import { spacing } from '@/ui/theme';

/** Historique : complet pour propriétaire / gestion / lecture seule, limité à ses bilans pour "Saisie seule" (§5.4). */
export default function ReportsTab() {
  const router = useRouter();
  const services = useServices();
  const { user, overview } = useCurrentBusiness();
  const { business, access } = overview;
  const all = can(access, 'viewAllReports');
  const query = useQuery(['reports', business.id, user.id], () => services.reports.list(business.id, user.id));
  const now = services.now();
  const today = toDayKey(now);

  return (
    <Screen>
      <AsyncBoundary query={query}>
        {(reports) => {
          if (reports.length === 0) {
            return (
              <EmptyState
                icon="document-text-outline"
                title={all ? 'Aucun bilan reçu' : "Vous n'avez pas encore envoyé de bilan"}
                message={
                  all
                    ? "Les bilans de votre équipe apparaîtront ici dès qu'ils seront envoyés."
                    : 'Vos bilans envoyés apparaîtront ici, pour vérifier ce que vous avez déclaré.'
                }
              />
            );
          }
          const days = groupByDay(reports);
          return (
            <>
              {days.map(({ day, items }) => {
                const totals = totalsOfDay(items, business.id, day);
                return (
                  <Card key={day} style={{ gap: spacing.xs }}>
                    <ListItem
                      title={formatDayRelative(day, today) === formatDayLong(day) ? formatDayLong(day) : `${formatDayRelative(day, today)} · ${formatDayLong(day)}`}
                      subtitle={
                        all
                          ? `${items.length} bilan${items.length > 1 ? 's' : ''} · CA ${formatFcfa(totals.revenue)}`
                          : undefined
                      }
                      onPress={all ? () => router.push({ pathname: '/day/[day]', params: { day } }) : undefined}
                      chevron={all}
                    />
                    <Divider />
                    {items.map((r) => (
                      <ReportRow key={r.id} report={r} editable={canEditReport(access, r, user.id, now)} showAuthor={all} />
                    ))}
                  </Card>
                );
              })}
            </>
          );
        }}
      </AsyncBoundary>
    </Screen>
  );
}

function ReportRow({ report, editable, showAuthor }: { report: Report; editable: boolean; showAuthor: boolean }) {
  const router = useRouter();
  const c = currentVersion(report).content;
  return (
    <ListItem
      title={showAuthor ? report.authorName : `Envoyé à ${formatTime(report.submittedAt)}`}
      subtitle={showAuthor ? `Envoyé à ${formatTime(report.submittedAt)}` : formatFcfa(c.revenue.total)}
      onPress={() => router.push({ pathname: '/report/[id]', params: { id: report.id } })}
      right={
        <View style={{ alignItems: 'flex-end', gap: spacing.xs }}>
          {showAuthor ? <Text variant="bodyStrong">{formatFcfa(c.revenue.total)}</Text> : null}
          {isEdited(report) ? <Badge label="Modifié" tone="info" /> : null}
          {editable ? <Badge label="Modifiable" tone="positive" /> : null}
        </View>
      }
      chevron
    />
  );
}

function groupByDay(reports: Report[]): { day: string; items: Report[] }[] {
  const map = new Map<string, Report[]>();
  for (const r of reports) map.set(r.day, [...(map.get(r.day) ?? []), r]);
  return [...map.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([day, items]) => ({ day, items: items.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)) }));
}
