import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import type { Sector } from '@/domain/types';
import { errorMessage } from '@/services/types';
import { useBusiness } from '@/state/business';
import { useServices } from '@/state/services';
import { Banner } from '@/ui/feedback';
import { ChoiceList, Segmented, SwitchRow, TextField } from '@/ui/forms';
import { Button, Screen, Text } from '@/ui/primitives';
import { spacing } from '@/ui/theme';

const SECTORS: { value: Sector; label: string; description: string }[] = [
  { value: 'bar_restaurant', label: 'Bar / Restaurant', description: 'Suggère les rôles Gérant, Serveur, Caissier.' },
  { value: 'boutique', label: 'Boutique', description: 'Suggère les rôles Gérant, Vendeur.' },
  { value: 'ecommerce', label: 'E-commerce', description: 'Suggère les rôles Livreur, Closer.' },
  { value: 'other', label: 'Autre activité', description: 'Suggère les rôles Responsable, Employé.' },
];

const REMINDERS = [
  { value: '19:00', label: '19h' },
  { value: '20:00', label: '20h' },
  { value: '21:00', label: '21h' },
  { value: '22:00', label: '22h' },
];

/** Création d'un business : nom, secteur, module Stock facultatif, heure du rappel (cahier §4.1). */
export default function NewBusinessScreen() {
  const router = useRouter();
  const services = useServices();
  const { user, select } = useBusiness();
  const [name, setName] = useState('');
  const [sector, setSector] = useState<Sector | null>(null);
  const [stockEnabled, setStockEnabled] = useState(false);
  const [reminderTime, setReminderTime] = useState('20:00');
  const [nameError, setNameError] = useState<string>();
  const [sectorError, setSectorError] = useState<string>();
  const [submitError, setSubmitError] = useState<string>();
  const [loading, setLoading] = useState(false);

  async function submit() {
    setNameError(name.trim().length >= 2 ? undefined : 'Indiquez le nom du business (2 caractères minimum).');
    setSectorError(sector ? undefined : "Choisissez un secteur d'activité.");
    setSubmitError(undefined);
    if (name.trim().length < 2 || !sector) return;
    setLoading(true);
    try {
      const business = await services.businesses.create(user.id, { name, sector, stockEnabled, reminderTime });
      select(business.id);
      router.replace('/home');
    } catch (e) {
      setSubmitError(errorMessage(e));
      setLoading(false);
    }
  }

  return (
    <Screen keyboardPersist footer={<Button label="Créer le business" icon="checkmark" loading={loading} onPress={submit} />}>
      <TextField
        label="Nom du business"
        value={name}
        onChangeText={(t) => {
          setName(t);
          setNameError(undefined);
        }}
        placeholder="Ex. Chez Maman Bar"
        maxLength={50}
        error={nameError}
      />

      <View style={{ gap: spacing.sm }}>
        <Text variant="label">Secteur d'activité</Text>
        <ChoiceList
          options={SECTORS}
          value={sector}
          onChange={(s) => {
            setSector(s);
            setSectorError(undefined);
          }}
        />
        {sectorError ? (
          <Text variant="caption" tone="negative">
            {sectorError}
          </Text>
        ) : null}
      </View>

      <SwitchRow
        label="Activer le module Stock"
        description="Facultatif : les équipes déclarent les quantités vendues, le restant se calcule seul."
        value={stockEnabled}
        onChange={setStockEnabled}
      />

      <View style={{ gap: spacing.sm }}>
        <Text variant="label">Heure du rappel de bilan</Text>
        <Segmented options={REMINDERS} value={reminderTime} onChange={setReminderTime} />
        <Text variant="caption" tone="secondary">
          Heure prévue pour les rappels, modifiable plus tard. Aucun rappel n'est envoyé dans cette démonstration.
        </Text>
      </View>

      {submitError ? <Banner tone="negative">{submitError}</Banner> : null}
    </Screen>
  );
}
