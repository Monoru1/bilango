import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { formatDateTime, formatDayLong } from '@/domain/dates';
import { editWindowEnd, canEditReport } from '@/domain/permissions';
import { isEdited } from '@/domain/reports';
import { ContentView } from '@/features/report/ContentView';
import { editHint } from '@/features/reports/format';
import { useCurrentBusiness } from '@/state/business';
import { useDeadlineClock, useQuery, useServices } from '@/state/services';
import { AsyncBoundary } from '@/ui/feedback';
import { Segmented } from '@/ui/forms';
import { Avatar, Badge, Button, Card, Row, Screen, Text } from '@/ui/primitives';
import { spacing } from '@/ui/theme';

/** Détail d'un bilan, avec accès aux versions originale et modifiée (cahier §5.5). */
export default function ReportDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const services = useServices();
  const { user, overview } = useCurrentBusiness();
  const [which, setWhich] = useState<'current' | 'original'>('current');
  const query = useQuery(['report', id, user.id], () => services.reports.get(id, user.id));
  const names = useQuery(['stockNames', overview.business.id, user.id], () => services.stock.names(overview.business.id, user.id));
  const now = useDeadlineClock(query.data ? [editWindowEnd(query.data)] : []);

  return (
    <Screen
      footer={
        query.data && canEditReport(overview.access, query.data, user.id, now) ? (
          <>
            <Text variant="caption" tone="secondary" align="center">
              {editHint(query.data, now)}
            </Text>
            <Button
              label="Modifier"
              icon="create-outline"
              onPress={() => router.push({ pathname: '/report/[id]/edit', params: { id } })}
            />
          </>
        ) : undefined
      }
    >
      <AsyncBoundary query={query}>
        {(report) => {
          const edited = isEdited(report);
          const version = which === 'original' ? report.versions[0] : report.versions[report.versions.length - 1];
          return (
            <>
              <Card>
                <Row>
                  <Avatar name={report.authorName} />
                  <View style={{ flex: 1 }}>
                    <Text variant="bodyStrong">{report.authorName}</Text>
                    <Text variant="caption" tone="secondary">
                      {formatDayLong(report.day)} · envoyé {formatDateTime(report.submittedAt)}
                    </Text>
                  </View>
                  {edited ? <Badge label="Modifié" tone="info" /> : null}
                </Row>
              </Card>

              {edited ? (
                <View style={{ gap: spacing.sm }}>
                  <Segmented
                    options={[
                      { value: 'current', label: 'Version modifiée' },
                      { value: 'original', label: "Version d'origine" },
                    ]}
                    value={which}
                    onChange={setWhich}
                  />
                  <Text variant="caption" tone="secondary" align="center">
                    {which === 'original' ? 'Envoyée' : 'Modifiée'} {formatDateTime(version.savedAt)}
                  </Text>
                </View>
              ) : null}

              <ContentView content={version.content} stockNames={names.data ?? {}} />
            </>
          );
        }}
      </AsyncBoundary>
    </Screen>
  );
}
