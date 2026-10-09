import { useState } from 'react';
import { View } from 'react-native';

import { useSessionController, useSessionState } from '@/state/session';
import { Logo } from '@/ui/logo';
import { PinPad } from '@/ui/pinpad';
import { Button, Screen, Text } from '@/ui/primitives';
import { spacing } from '@/ui/theme';

export default function UnlockScreen() {
  const session = useSessionController();
  const state = useSessionState();
  const [error, setError] = useState<string>();
  const [resetToken, setResetToken] = useState(0);

  if (state.status !== 'locked') return null;
  const firstName = state.user.name.split(' ')[0];

  async function onComplete(pin: string) {
    const result = await session.unlock(pin);
    if (!result.ok) {
      setError(
        result.attemptsLeft > 0
          ? `PIN incorrect. Il vous reste ${result.attemptsLeft} essai${result.attemptsLeft > 1 ? 's' : ''}.`
          : 'Trop d’essais. Reconnectez-vous avec un code WhatsApp.',
      );
      setResetToken((t) => t + 1);
    }
  }

  return (
    <Screen
      topInset
      scroll={false}
      footer={
        <Button
          variant="ghost"
          label="PIN oublié ou autre numéro"
          onPress={() => session.forgetDevice()}
          accessibilityHint="Vous devrez recevoir un nouveau code sur WhatsApp"
        />
      }
    >
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.xl }}>
        <Logo size={64} />
        <View style={{ gap: spacing.xs, alignItems: 'center' }}>
          <Text variant="title">Bonjour {firstName}</Text>
          <Text tone="secondary">Entrez votre code PIN</Text>
        </View>
        <PinPad key={resetToken} onComplete={onComplete} />
        <View style={{ minHeight: 24 }}>
          {error ? (
            <Text tone="negative" align="center" accessibilityLiveRegion="polite">
              {error}
            </Text>
          ) : null}
        </View>
      </View>
    </Screen>
  );
}
