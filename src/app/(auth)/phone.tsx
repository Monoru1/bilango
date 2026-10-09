import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { formatPhone, normalizeBeninPhone } from '@/domain/money';
import { DEMO_ACCOUNTS, DEMO_OTP_CODE } from '@/services/mock/seed';
import { errorMessage } from '@/services/types';
import { useSessionController } from '@/state/session';
import { TextField } from '@/ui/forms';
import { Banner } from '@/ui/feedback';
import { Button, Card, Screen, Text } from '@/ui/primitives';
import { colors, radius, spacing } from '@/ui/theme';

export default function PhoneScreen() {
  const router = useRouter();
  const session = useSessionController();
  const [value, setValue] = useState('');
  const [fieldError, setFieldError] = useState<string>();
  const [serviceError, setServiceError] = useState<string>();
  const [loading, setLoading] = useState(false);

  async function submit() {
    const phone = normalizeBeninPhone(value);
    if (!phone) {
      setFieldError('Entrez un numéro béninois à 10 chiffres, ex. 01 97 00 00 01.');
      return;
    }
    setFieldError(undefined);
    setServiceError(undefined);
    setLoading(true);
    try {
      await session.requestOtp(phone);
      router.push({ pathname: '/otp', params: { phone } });
    } catch (e) {
      setServiceError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen
      keyboardPersist
      footer={<Button label="Recevoir le code sur WhatsApp" icon="logo-whatsapp" loading={loading} onPress={submit} />}
    >
      <View style={{ gap: spacing.sm }}>
        <Text variant="title">Votre numéro WhatsApp</Text>
        <Text tone="secondary">
          Pas de mot de passe : nous vous envoyons un code de vérification. Le numéro doit être actif sur WhatsApp.
        </Text>
      </View>

      <TextField
        label="Numéro de téléphone"
        value={value}
        onChangeText={(t) => {
          setValue(t);
          setFieldError(undefined);
        }}
        keyboardType="phone-pad"
        autoComplete="tel"
        placeholder="01 97 00 00 01"
        error={fieldError}
        autoFocus
        returnKeyType="done"
        onSubmitEditing={submit}
      />
      {serviceError ? <Banner tone="negative">{serviceError}</Banner> : null}

      <Card tone="tint">
        <Text variant="label" tone="primary">
          Mode démonstration
        </Text>
        <Text variant="caption" tone="secondary">
          Aucun message n'est envoyé. Le code est toujours {DEMO_OTP_CODE}. Touchez un compte pour pré-remplir le numéro :
        </Text>
        {DEMO_ACCOUNTS.map((a) => (
          <Pressable
            key={a.phone}
            accessibilityRole="button"
            accessibilityLabel={`${a.label}, ${formatPhone(a.phone)}`}
            onPress={() => {
              setValue(formatPhone(a.phone).replace('+229 ', ''));
              setFieldError(undefined);
            }}
            style={({ pressed }) => ({
              paddingVertical: spacing.sm,
              paddingHorizontal: spacing.md,
              borderRadius: radius.md,
              backgroundColor: pressed ? colors.primaryLight : colors.surface,
              gap: 2,
            })}
          >
            <Text variant="label">{a.label}</Text>
            <Text variant="caption" tone="secondary">
              {formatPhone(a.phone)}
            </Text>
          </Pressable>
        ))}
      </Card>
    </Screen>
  );
}
