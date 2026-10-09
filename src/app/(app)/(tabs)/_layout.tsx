import Ionicons from '@expo/vector-icons/Ionicons';
import { Redirect, Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';

import { can } from '@/domain/permissions';
import { useBusiness } from '@/state/business';
import { useQuery, useServices } from '@/state/services';
import { ErrorState, LoadingState } from '@/ui/feedback';
import { IconButton } from '@/ui/primitives';
import { colors } from '@/ui/theme';

function tabIcon(name: keyof typeof Ionicons.glyphMap) {
  function TabIcon({ color, size }: { color: ColorValue; size: number }) {
    return <Ionicons name={name} size={size} color={color as string} />;
  }
  return TabIcon;
}

export default function TabsLayout() {
  const services = useServices();
  const { user, overviews, current, error, reload, setMenuOpen } = useBusiness();
  const noBusiness = overviews !== undefined && current === null;
  const invitations = useQuery(['myInvitations', user.id], () => services.team.listMyInvitations(user.id), noBusiness);

  if (error && overviews === undefined) return <ErrorState error={error} onRetry={reload} />;
  if (overviews === undefined) return <LoadingState />;

  // Cahier §3.3 : numéro déjà invité -> on montre directement l'invitation ; sinon un seul choix : créer son business.
  if (current === null) {
    if (invitations.data === undefined && !invitations.error) return <LoadingState />;
    return <Redirect href={invitations.data && invitations.data.length > 0 ? '/invitations' : '/no-business'} />;
  }

  const access = current.access;
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.primary },
        headerTintColor: colors.textOnPrimary,
        headerTitleStyle: { fontWeight: '700' },
        headerShadowVisible: false,
        headerLeft: () => <IconButton name="menu" label="Ouvrir le menu" color={colors.textOnPrimary} onPress={() => setMenuOpen(true)} />,
        // Cache les onglets quand le clavier s'ouvre (recommandation Expo, évite qu'ils remontent au-dessus).
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{ title: current.business.name, tabBarLabel: 'Accueil', tabBarIcon: tabIcon('home-outline') }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: can(access, 'viewAllReports') ? 'Historique des bilans' : 'Mes bilans',
          tabBarLabel: can(access, 'viewAllReports') ? 'Bilans' : 'Mes bilans',
          tabBarIcon: tabIcon('document-text-outline'),
        }}
      />
      <Tabs.Screen
        name="team"
        options={{
          title: 'Équipe',
          tabBarIcon: tabIcon('people-outline'),
          href: can(access, 'viewTeam') ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="stock"
        options={{
          title: 'Stock',
          tabBarIcon: tabIcon('cube-outline'),
          href: current.business.stockEnabled && can(access, 'viewStock') ? undefined : null,
        }}
      />
    </Tabs>
  );
}
