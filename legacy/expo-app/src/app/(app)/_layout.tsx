import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { can } from '@/domain/permissions';
import { SideMenu } from '@/features/menu/SideMenu';
import { BusinessProvider, useBusiness } from '@/state/business';
import { useSessionState } from '@/state/session';
import { ErrorState, LoadingState } from '@/ui/feedback';
import { colors } from '@/ui/theme';

export default function AppLayout() {
  const session = useSessionState();
  if (session.status !== 'ready') return null;
  return (
    <BusinessProvider user={session.user}>
      <AppNavigator />
    </BusinessProvider>
  );
}

function AppNavigator() {
  const { current, overviews, error, reload } = useBusiness();
  if (overviews === undefined) return error ? <ErrorState error={error} onRetry={reload} /> : <LoadingState />;
  const allowed = (capability: Parameters<typeof can>[1]) => current !== null && can(current.access, capability);
  return (
    <>
      {/* En-têtes verts : icônes de barre d'état claires. */}
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.primary },
          headerTintColor: colors.textOnPrimary,
          headerTitleStyle: { fontWeight: '700' },
          headerShadowVisible: false,
          headerBackButtonDisplayMode: 'minimal',
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="no-business" options={{ headerShown: false }} />
        <Stack.Protected guard={allowed('submitReport')}>
          <Stack.Screen name="report/new" options={{ title: 'Bilan du jour' }} />
          <Stack.Screen name="report/[id]/edit" options={{ title: 'Modifier le bilan' }} />
        </Stack.Protected>
        <Stack.Protected guard={current !== null}>
          <Stack.Screen name="report/[id]/index" options={{ title: 'Détail du bilan' }} />
          <Stack.Screen name="day/[day]" options={{ title: 'Bilan du jour' }} />
        </Stack.Protected>
        <Stack.Screen name="invitations" options={{ title: 'Invitations' }} />
        <Stack.Protected guard={allowed('viewSubscription')}>
          <Stack.Screen name="subscription" options={{ title: 'Mon abonnement' }} />
        </Stack.Protected>
        <Stack.Screen name="help" options={{ title: "Comment utiliser l'application" }} />
        <Stack.Screen name="business/new" options={{ title: 'Nouveau business' }} />
        <Stack.Protected guard={allowed('manageTeam')}>
          <Stack.Screen name="team/invite" options={{ title: 'Inviter quelqu’un' }} />
        </Stack.Protected>
        <Stack.Protected guard={allowed('createRoles')}>
          <Stack.Screen name="team/role-new" options={{ title: 'Nouveau rôle' }} />
        </Stack.Protected>
        <Stack.Protected guard={allowed('manageStock') && current?.business.stockEnabled === true}>
          <Stack.Screen name="stock/new" options={{ title: 'Nouvel article' }} />
        </Stack.Protected>
      </Stack>
      <SideMenu />
    </>
  );
}
