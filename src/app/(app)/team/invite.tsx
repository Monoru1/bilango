import { useRouter } from 'expo-router';
import { useState } from 'react';

import { normalizeBeninPhone } from '@/domain/money';
import { canGrantLevel, LEVEL_LABELS } from '@/domain/permissions';
import { errorMessage } from '@/services/types';
import { useCurrentBusiness } from '@/state/business';
import { useQuery, useServices } from '@/state/services';
import { AsyncBoundary, Banner, EmptyState } from '@/ui/feedback';
import { ChoiceList, TextField } from '@/ui/forms';
import { Button, Screen, Text } from '@/ui/primitives';

/** Invitation : le rôle choisi doit être de niveau strictement inférieur à celui de l'invitant (cahier §4.3). */
export default function InviteScreen() {
  const router = useRouter();
  const services = useServices();
  const { user, overview } = useCurrentBusiness();
  const { business, access } = overview;
  const roles = useQuery(['roles', business.id, user.id], () => services.team.listRoles(business.id, user.id));
  const [phone, setPhone] = useState('');
  const [roleId, setRoleId] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string>();
  const [roleError, setRoleError] = useState<string>();
  const [submitError, setSubmitError] = useState<string>();
  const [loading, setLoading] = useState(false);

  async function submit() {
    const normalized = normalizeBeninPhone(phone);
    setPhoneError(normalized ? undefined : 'Entrez un numéro à 10 chiffres, ex. 01 97 00 00 01.');
    setRoleError(roleId ? undefined : 'Choisissez un rôle.');
    setSubmitError(undefined);
    if (!normalized || !roleId) return;
    setLoading(true);
    try {
      await services.team.invite(business.id, user.id, { phone: normalized, roleId });
      router.back();
    } catch (e) {
      setSubmitError(errorMessage(e));
      setLoading(false);
    }
  }

  return (
    <Screen keyboardPersist footer={<Button label="Envoyer l'invitation" icon="send-outline" loading={loading} onPress={submit} />}>
      <Text tone="secondary">
        La personne reçoit une invitation dans l'application. Elle n'aura accès à « {business.name} » qu'après l'avoir acceptée.
      </Text>
      <TextField
        label="Numéro de téléphone"
        value={phone}
        onChangeText={(t) => {
          setPhone(t);
          setPhoneError(undefined);
        }}
        keyboardType="phone-pad"
        placeholder="01 97 00 00 01"
        error={phoneError}
      />
      <AsyncBoundary query={roles}>
        {(list) => {
          const allowed = list.filter((r) => canGrantLevel(access, r.level));
          if (allowed.length === 0) {
            return (
              <EmptyState
                icon="people-outline"
                title="Aucun rôle disponible"
                message={
                  access.isOwner
                    ? "Créez d'abord un rôle dans l'onglet Équipe."
                    : "Vous ne pouvez inviter qu'à un niveau inférieur au vôtre, et aucun rôle de ce niveau n'existe."
                }
              />
            );
          }
          return (
            <>
              <Text variant="label">Rôle</Text>
              <ChoiceList
                options={allowed.map((r) => ({ value: r.id, label: r.name, description: LEVEL_LABELS[r.level] }))}
                value={roleId}
                onChange={(id) => {
                  setRoleId(id);
                  setRoleError(undefined);
                }}
              />
              {roleError ? (
                <Text variant="caption" tone="negative">
                  {roleError}
                </Text>
              ) : null}
            </>
          );
        }}
      </AsyncBoundary>
      {submitError ? <Banner tone="negative">{submitError}</Banner> : null}
    </Screen>
  );
}
