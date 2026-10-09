import { Redirect, Tabs } from 'expo-router';
import { View } from 'react-native';

import { can } from '@/domain/permissions';
import { useBusiness } from '@/state/business';
import { useQuery, useServices } from '@/state/services';
import { ErrorState, LoadingState } from '@/ui/feedback';
import { headerOptions } from '@/ui/navigation';
import { IconButton, Row, Text } from '@/ui/primitives';
import { Logo } from '@/ui/logo';
import { colors, homeColors } from '@/ui/theme';

/** Indicateur d'onglet actif de la maquette client : un point au-dessus du libellé (aucune icône). */
function TabDot({ focused }: { focused: boolean }) {
  return <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: focused ? homeColors.text : 'transparent' }} />;
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
        ...headerOptions,
        headerLeft: () => <IconButton name="menu" label="Ouvrir le menu" color={homeColors.text} onPress={() => setMenuOpen(true)} />,
        // Cache les onglets quand le clavier s'ouvre (recommandation Expo, évite qu'ils remontent au-dessus).
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: homeColors.text,
        tabBarInactiveTintColor: homeColors.secondary,
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
        tabBarIcon: ({ focused }) => <TabDot focused={focused} />,
        tabBarStyle: { backgroundColor: 'white', borderTopColor: homeColors.separator, minHeight: 64, paddingBottom: 8 },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: current.business.name,
          tabBarLabel: 'Accueil',
          headerTitle: () => (
            <Row style={{ gap: 10, flex: 1 }}>
              <Logo size={32} />
              <View style={{ flexShrink: 1 }}>
                <Text variant="label" numberOfLines={1} style={{ color: homeColors.text }}>
                  {current.business.name}
                </Text>
                <Text variant="caption" style={{ color: homeColors.secondary, fontSize: 11 }}>
                  BilanGo
                </Text>
              </View>
            </Row>
          ),
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: can(access, 'viewAllReports') ? 'Historique des bilans' : 'Mes bilans',
          tabBarLabel: can(access, 'viewAllReports') ? 'Bilans' : 'Historique',
        }}
      />
      <Tabs.Screen name="team" options={{ title: 'Équipe', href: can(access, 'viewTeam') ? undefined : null }} />
      <Tabs.Screen
        name="stock"
        options={{
          title: 'Stock',
          href: current.business.stockEnabled && can(access, 'viewStock') && can(access, 'viewDashboard') ? undefined : null,
        }}
      />
    </Tabs>
  );
}
