import { useRouter } from 'expo-router';
import { useState } from 'react';

import { LEVEL_DESCRIPTIONS, LEVEL_LABELS } from '@/domain/permissions';
import type { PermissionLevel } from '@/domain/types';
import { errorMessage } from '@/services/types';
import { useCurrentBusiness } from '@/state/business';
import { useServices } from '@/state/services';
import { Banner } from '@/ui/feedback';
import { ChoiceList, TextField } from '@/ui/forms';
import { Button, Screen, Text } from '@/ui/primitives';

const LEVELS: PermissionLevel[] = ['entry', 'full', 'readonly'];

/** Création d'un rôle personnalisé : nom libre + niveau de permission parmi la liste fixe (cahier §4.2). */
export default function NewRoleScreen() {
  const router = useRouter();
  const services = useServices();
  const { user, overview } = useCurrentBusiness();
  const [name, setName] = useState('');
  const [level, setLevel] = useState<PermissionLevel | null>(null);
  const [nameError, setNameError] = useState<string>();
  const [levelError, setLevelError] = useState<string>();
  const [submitError, setSubmitError] = useState<string>();
  const [loading, setLoading] = useState(false);

  async function submit() {
    setNameError(name.trim().length >= 2 ? undefined : 'Donnez un nom au rôle (2 caractères minimum).');
    setLevelError(level ? undefined : 'Choisissez un niveau de permission.');
    setSubmitError(undefined);
    if (name.trim().length < 2 || !level) return;
    setLoading(true);
    try {
      await services.team.createRole(overview.business.id, user.id, { name, level });
      router.back();
    } catch (e) {
      setSubmitError(errorMessage(e));
      setLoading(false);
    }
  }

  return (
    <Screen keyboardPersist footer={<Button label="Créer le rôle" loading={loading} onPress={submit} />}>
      <TextField
        label="Nom du rôle"
        value={name}
        onChangeText={(t) => {
          setName(t);
          setNameError(undefined);
        }}
        placeholder="Ex. Caissier, Comptable, DG…"
        maxLength={30}
        error={nameError}
      />
      <Text variant="label">Niveau de permission</Text>
      <ChoiceList
        options={LEVELS.map((l) => ({ value: l, label: LEVEL_LABELS[l], description: LEVEL_DESCRIPTIONS[l] }))}
        value={level}
        onChange={(l) => {
          setLevel(l);
          setLevelError(undefined);
        }}
      />
      {levelError ? (
        <Text variant="caption" tone="negative">
          {levelError}
        </Text>
      ) : null}
      {submitError ? <Banner tone="negative">{submitError}</Banner> : null}
    </Screen>
  );
}
