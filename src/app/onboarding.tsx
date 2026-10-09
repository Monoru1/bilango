import { useState } from 'react';
import { View } from 'react-native';

import { errorMessage } from '@/services/types';
import { useSessionController, useSessionState } from '@/state/session';
import { TextField } from '@/ui/forms';
import { PinPad } from '@/ui/pinpad';
import { Button, Screen, Text } from '@/ui/primitives';
import { spacing } from '@/ui/theme';

/** Première connexion : nom affiché sur les bilans, puis création du PIN local. */
export default function OnboardingScreen() {
  const state = useSessionState();
  if (state.status !== 'onboarding') return null;
  return state.step === 'name' ? <NameStep /> : <PinStep />;
}

function NameStep() {
  const session = useSessionController();
  const [name, setName] = useState('');
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  async function submit() {
    setError(undefined);
    setLoading(true);
    try {
      await session.saveName(name);
    } catch (e) {
      setError(errorMessage(e));
      setLoading(false);
    }
  }

  return (
    <Screen topInset keyboardPersist footer={<Button label="Continuer" loading={loading} onPress={submit} />}>
      <View style={{ gap: spacing.sm }}>
        <Text variant="title">Comment vous appelez-vous ?</Text>
        <Text tone="secondary">Ce nom apparaîtra sur les bilans que vous envoyez.</Text>
      </View>
      <TextField
        label="Votre nom"
        value={name}
        onChangeText={(t) => {
          setName(t);
          setError(undefined);
        }}
        autoFocus
        autoCapitalize="words"
        placeholder="Ex. Mireille Agbo"
        error={error}
        returnKeyType="done"
        onSubmitEditing={submit}
      />
    </Screen>
  );
}

function PinStep() {
  const session = useSessionController();
  const [first, setFirst] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const [resetToken, setResetToken] = useState(0);

  async function onComplete(pin: string) {
    if (first === null) {
      setFirst(pin);
      setError(undefined);
      setResetToken((t) => t + 1);
      return;
    }
    if (pin !== first) {
      setFirst(null);
      setError('Les deux codes sont différents. Recommencez.');
      setResetToken((t) => t + 1);
      return;
    }
    try {
      await session.setPin(pin);
    } catch (e) {
      setError(errorMessage(e));
      setFirst(null);
      setResetToken((t) => t + 1);
    }
  }

  return (
    <Screen topInset scroll={false}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.xl }}>
        <View style={{ gap: spacing.xs, alignItems: 'center' }}>
          <Text variant="title" align="center">
            {first === null ? 'Choisissez un code PIN' : 'Confirmez votre code PIN'}
          </Text>
          <Text tone="secondary" align="center">
            4 chiffres. Il vous servira à vous reconnecter vite sur ce téléphone, sans nouveau code WhatsApp.
          </Text>
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
