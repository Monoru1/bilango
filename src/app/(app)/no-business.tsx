import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { useBusiness } from '@/state/business';
import { useSessionController } from '@/state/session';
import { Logo } from '@/ui/logo';
import { Button, Screen, Text } from '@/ui/primitives';
import { colors, spacing } from '@/ui/theme';

/** Compte sans business ni invitation : un seul choix clair (cahier §3.3). */
export default function NoBusinessScreen() {
  const router = useRouter();
  const session = useSessionController();
  const { user } = useBusiness();
  return (
      <Screen
        topInset
        scroll={false}
        footer={
          <>
            <Button label="+ Créer mon business" onPress={() => router.push('/business/new')} />
            <Button variant="ghost" label="Se déconnecter" onPress={() => session.lock()} />
          </>
        }
      >
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.lg }}>
          <Logo size={72} />
          <Text variant="title" align="center" style={{ color: colors.primaryDark }}>
            Bienvenue {user.name.split(' ')[0]}
          </Text>
          <Text tone="secondary" align="center">
            Créez votre premier business pour suivre votre activité. Si quelqu'un vous invite sur le sien, l'invitation apparaîtra dans le menu.
          </Text>
        </View>
      </Screen>
  );
}
