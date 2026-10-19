import { ReportForm } from '@/features/report/ReportForm';
import { useCurrentBusiness } from '@/state/business';

export default function NewReport() {
  const { user, overview } = useCurrentBusiness();
  return <ReportForm key={overview.business.id} business={overview.business} userId={user.id} />;
}
