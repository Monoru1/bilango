import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { SideMenu } from '@/features/menu/SideMenu';
import { BusinessProvider } from '@/state/business';
import { useSessionState } from '@/state/session';
import { colors } from '@/ui/theme';

export default function AppLayout() {
  const session = useSessionState();
  if (session.status !== 'ready') return null;
  return (
    <BusinessProvider user={session.user}>
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
        <Stack.Screen name="report/new" options={{ title: 'Bilan du jour' }} />
        <Stack.Screen name="report/[id]/index" options={{ title: 'Détail du bilan' }} />
        <Stack.Screen name="report/[id]/edit" options={{ title: 'Modifier le bilan' }} />
        <Stack.Screen name="day/[day]" options={{ title: 'Bilan du jour' }} />
        <Stack.Screen name="invitations" options={{ title: 'Invitations' }} />
        <Stack.Screen name="subscription" options={{ title: 'Mon abonnement' }} />
        <Stack.Screen name="help" options={{ title: "Comment utiliser l'application" }} />
        <Stack.Screen name="business/new" options={{ title: 'Nouveau business' }} />
        <Stack.Screen name="team/invite" options={{ title: 'Inviter quelqu’un' }} />
        <Stack.Screen name="team/role-new" options={{ title: 'Nouveau rôle' }} />
        <Stack.Screen name="stock/new" options={{ title: 'Nouvel article' }} />
      </Stack>
      <SideMenu />
    </BusinessProvider>
  );
}
