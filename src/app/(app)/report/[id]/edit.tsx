import { useLocalSearchParams } from 'expo-router';

import { editWindowEnd, canEditReport } from '@/domain/permissions';
import { ReportForm } from '@/features/report/ReportForm';
import { useCurrentBusiness } from '@/state/business';
import { useDeadlineClock, useQuery, useServices } from '@/state/services';
import { AsyncBoundary, EmptyState } from '@/ui/feedback';
import { Screen } from '@/ui/primitives';

export default function EditReport() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const services = useServices();
  const { user, overview } = useCurrentBusiness();
  const query = useQuery(['report', id, user.id], () => services.reports.get(id, user.id));

  const now = useDeadlineClock(query.data ? [editWindowEnd(query.data)] : []);

  return (
    <AsyncBoundary query={query}>
      {(report) =>
        canEditReport(overview.access, report, user.id, now) ? (
          <ReportForm business={overview.business} userId={user.id} editing={report} />
        ) : (
          <Screen>
            <EmptyState
              icon="lock-closed-outline"
              title="Modification impossible"
              message="Un bilan ne peut être modifié que par son auteur, pendant 24 h après son envoi."
            />
          </Screen>
        )
      }
    </AsyncBoundary>
  );
}
