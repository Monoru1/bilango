import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { Logo } from '@/ui/logo';
import { Button, Card, Icon, Row, Screen, Text } from '@/ui/primitives';
import { colors, spacing } from '@/ui/theme';

const POINTS = [
  { icon: 'eye-outline', text: "Suivez l'activité de votre commerce, même à distance." },
  { icon: 'wallet-outline', text: 'Une caisse théorique fiable pour vos contrôles.' },
  { icon: 'people-outline', text: 'Vos équipes font un bilan simple en fin de journée.' },
] as const;

export default function Welcome() {
  const router = useRouter();
  return (
    <Screen
      topInset
      scroll={false}
      footer={<Button label="Commencer" icon="arrow-forward" onPress={() => router.push('/phone')} />}
    >
      <View style={{ flex: 1, justifyContent: 'center', gap: spacing.xl }}>
        <View style={{ alignItems: 'center', gap: spacing.md }}>
          <Logo size={96} />
          <Text variant="display" style={{ color: colors.primaryDark }}>
            BilanGo
          </Text>
          <Text tone="secondary" align="center">
            Le bilan du jour de votre business, dans votre poche.
          </Text>
        </View>
        <Card>
          {POINTS.map((p) => (
            <Row key={p.icon} style={{ alignItems: 'flex-start' }}>
              <Icon name={p.icon} color={colors.primary} />
              <Text style={{ flex: 1 }}>{p.text}</Text>
            </Row>
          ))}
        </Card>
        <Text variant="caption" tone="muted" align="center">
          Version de démonstration : données fictives, aucun message réel n'est envoyé.
        </Text>
      </View>
    </Screen>
  );
}
