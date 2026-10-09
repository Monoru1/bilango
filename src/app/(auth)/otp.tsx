import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { formatPhone } from '@/domain/money';
import { MOCK_OTP_COOLDOWN_SECONDS } from '@/services/mock';
import { errorMessage } from '@/services/types';
import { useSessionController } from '@/state/session';
import { Banner } from '@/ui/feedback';
import { TextField } from '@/ui/forms';
import { Button, Screen, Text } from '@/ui/primitives';
import { spacing } from '@/ui/theme';

export default function OtpScreen() {
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const session = useSessionController();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(MOCK_OTP_COOLDOWN_SECONDS);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function verify() {
    if (!/^\d{6}$/.test(code)) {
      setError('Entrez le code à 6 chiffres.');
      return;
    }
    setError(undefined);
    setLoading(true);
    try {
      // En cas de succès, l'état de session change et le navigateur racine redirige tout seul.
      await session.verifyOtp(phone, code);
    } catch (e) {
      setError(errorMessage(e));
      setLoading(false);
    }
  }

  async function resend() {
    setResending(true);
    setError(undefined);
    try {
      const { retryAfterSeconds } = await session.requestOtp(phone);
      setCooldown(retryAfterSeconds);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setResending(false);
    }
  }

  return (
    <Screen keyboardPersist footer={<Button label="Valider" loading={loading} onPress={verify} />}>
      <View style={{ gap: spacing.sm }}>
        <Text variant="title">Entrez le code</Text>
        <Text tone="secondary">Code envoyé sur WhatsApp au {formatPhone(phone ?? '')}.</Text>
      </View>
      <TextField
        label="Code de vérification"
        value={code}
        onChangeText={(t) => {
          setCode(t.replace(/\D/g, '').slice(0, 6));
          setError(undefined);
        }}
        keyboardType="number-pad"
        maxLength={6}
        placeholder="000000"
        autoFocus
        error={error}
        textContentType="oneTimeCode"
      />
      <Banner>Mode démonstration : le code est 123456.</Banner>
      <Button
        variant="ghost"
        label={cooldown > 0 ? `Renvoyer le code (${cooldown} s)` : 'Renvoyer le code'}
        disabled={cooldown > 0}
        loading={resending}
        onPress={resend}
      />
    </Screen>
  );
}
