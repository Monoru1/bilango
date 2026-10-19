import { can } from '@/domain/permissions';
import { Dashboard } from '@/features/dashboard/Dashboard';
import { ManagerHome } from '@/features/home/ManagerHome';
import { useCurrentBusiness } from '@/state/business';

/** Propriétaire / gestion complète / lecture seule : tableau de bord. Saisie seule : accueil manager. */
export default function HomeTab() {
  const { user, overview } = useCurrentBusiness();
  const { business, access } = overview;
  return can(access, 'viewDashboard') ? (
    <Dashboard key={business.id} userId={user.id} business={business} access={access} />
  ) : (
    <ManagerHome key={business.id} userId={user.id} business={business} access={access} />
  );
}
