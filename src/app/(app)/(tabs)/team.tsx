import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';

import { formatDayShort, toDayKey } from '@/domain/dates';
import { formatPhone } from '@/domain/money';
import { can, canGrantLevel, canManageMember, LEVEL_LABELS } from '@/domain/permissions';
import type { Access } from '@/domain/types';
import { errorMessage, type MemberView } from '@/services/types';
import { useCurrentBusiness } from '@/state/business';
import { useQuery, useServices } from '@/state/services';
import { AsyncBoundary, Banner } from '@/ui/feedback';
import { Avatar, Badge, Button, Card, Divider, ListItem, Screen, SectionTitle, Text } from '@/ui/primitives';
import { BottomSheet } from '@/ui/sheet';
import { spacing } from '@/ui/theme';

const REMINDER_CHOICES = ['18:00', '19:00', '19:30', '20:00', '21:00', '22:00'];

export default function TeamTab() {
  const router = useRouter();
  const services = useServices();
  const { user, overview } = useCurrentBusiness();
  const { business, access } = overview;
  const [selected, setSelected] = useState<MemberView | null>(null);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [actionError, setActionError] = useState<string>();

  const members = useQuery(['members', business.id, user.id], () => services.team.listMembers(business.id, user.id));
  const roles = useQuery(['roles', business.id, user.id], () => services.team.listRoles(business.id, user.id));
  const pending = useQuery(['pendingInvitations', business.id, user.id], () =>
    services.team.listPendingInvitations(business.id, user.id),
  );
  const today = toDayKey(services.now());

  function accessOfMember(m: MemberView): Access {
    return { businessId: business.id, userId: m.user.id, isOwner: m.isOwner, role: m.role };
  }

  async function run(action: () => Promise<void>) {
    setActionError(undefined);
    try {
      await action();
      setSelected(null);
      setReminderOpen(false);
    } catch (e) {
      setActionError(errorMessage(e));
      setSelected(null);
      setReminderOpen(false);
    }
  }

  function confirmRemove(m: MemberView) {
    Alert.alert(
      `Retirer ${m.user.name} ?`,
      'Cette personne perd son accès futur. Ses bilans passés restent conservés avec son nom.',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Retirer', style: 'destructive', onPress: () => run(() => services.team.removeMember(m.member.id, user.id)) },
      ],
    );
  }

  return (
    <Screen>
      {actionError ? <Banner tone="negative">{actionError}</Banner> : null}
      <Button label="Inviter quelqu'un" icon="person-add-outline" onPress={() => router.push('/team/invite')} />

      <AsyncBoundary query={members}>
        {(list) => {
          const active = list.filter((m) => m.member.status === 'active');
          const removed = list.filter((m) => m.member.status === 'removed');
          return (
            <>
              <SectionTitle>Membres</SectionTitle>
              <Card style={{ gap: 0 }}>
                {active.map((m, i) => {
                  const manageable = canManageMember(access, accessOfMember(m));
                  return (
                    <View key={m.member.id}>
                      {i > 0 ? <Divider /> : null}
                      <ListItem
                        title={m.user.name + (m.user.id === user.id ? ' (vous)' : '')}
                        subtitle={`${m.isOwner ? 'Propriétaire' : `${m.role?.name} · ${m.role ? LEVEL_LABELS[m.role.level] : ''}`}\n${formatPhone(m.user.phone)}`}
                        icon={undefined}
                        right={<Avatar name={m.user.name} />}
                        onPress={manageable ? () => setSelected(m) : undefined}
                        chevron={manageable}
                      />
                    </View>
                  );
                })}
              </Card>

              {removed.length > 0 ? (
                <>
                  <SectionTitle>Anciens membres</SectionTitle>
                  <Card style={{ gap: 0 }}>
                    {removed.map((m, i) => (
                      <View key={m.member.id}>
                        {i > 0 ? <Divider /> : null}
                        <ListItem
                          title={m.user.name}
                          subtitle={`Retiré le ${formatDayShort(toDayKey(m.member.removedAt ?? today))} · ses bilans sont conservés`}
                        />
                      </View>
                    ))}
                  </Card>
                </>
              ) : null}
            </>
          );
        }}
      </AsyncBoundary>

      <SectionTitle>Invitations en attente</SectionTitle>
      <AsyncBoundary query={pending}>
        {(list) =>
          list.length === 0 ? (
            <Text tone="secondary">Aucune invitation en attente.</Text>
          ) : (
            <Card style={{ gap: 0 }}>
              {list.map((inv, i) => (
                <View key={inv.id}>
                  {i > 0 ? <Divider /> : null}
                  <ListItem
                    title={formatPhone(inv.phone)}
                    subtitle={`${inv.roleName} · ${LEVEL_LABELS[inv.level]}`}
                    right={
                      canGrantLevel(access, inv.level) ? (
                        <Button
                          label="Annuler"
                          variant="ghost"
                          compact
                          onPress={() => run(() => services.team.cancelInvitation(inv.id, user.id))}
                        />
                      ) : (
                        <Badge label="En attente" />
                      )
                    }
                  />
                </View>
              ))}
            </Card>
          )
        }
      </AsyncBoundary>

      <SectionTitle
        action={
          can(access, 'createRoles') ? (
            <Button label="Ajouter un rôle" icon="add" variant="secondary" compact onPress={() => router.push('/team/role-new')} />
          ) : undefined
        }
      >
        Rôles
      </SectionTitle>
      <AsyncBoundary query={roles}>
        {(list) => (
          <Card style={{ gap: 0 }}>
            {list.map((r, i) => (
              <View key={r.id}>
                {i > 0 ? <Divider /> : null}
                <ListItem title={r.name} subtitle={LEVEL_LABELS[r.level]} />
              </View>
            ))}
          </Card>
        )}
      </AsyncBoundary>

      <SectionTitle>Rappel automatique</SectionTitle>
      <Card>
        <Text>
          Les managers reçoivent un rappel à <Text variant="bodyStrong">{business.reminderTime.replace(':', 'h')}</Text> s'ils n'ont pas envoyé leur bilan.
        </Text>
        <Text variant="caption" tone="muted">
          Heure fixée par le propriétaire. Les notifications push ne sont pas encore actives dans cette démonstration.
        </Text>
        {access.isOwner ? (
          <Button label="Changer l'heure" variant="secondary" compact onPress={() => setReminderOpen(true)} />
        ) : null}
      </Card>

      <BottomSheet visible={selected !== null} title={selected?.user.name ?? ''} onClose={() => setSelected(null)}>
        {selected ? (
          <>
            <Text variant="label" tone="secondary">
              CHANGER LE RÔLE
            </Text>
            {(roles.data ?? [])
              .filter((r) => canGrantLevel(access, r.level))
              .map((r) => (
                <ListItem
                  key={r.id}
                  title={r.name}
                  subtitle={LEVEL_LABELS[r.level]}
                  right={r.id === selected.role?.id ? <Badge label="Actuel" tone="positive" /> : undefined}
                  onPress={() => run(() => services.team.changeMemberRole(selected.member.id, r.id, user.id))}
                />
              ))}
            <Divider />
            <ListItem title="Retirer l'accès" icon="person-remove-outline" tone="negative" onPress={() => confirmRemove(selected)} />
          </>
        ) : null}
      </BottomSheet>

      <BottomSheet visible={reminderOpen} title="Heure du rappel" onClose={() => setReminderOpen(false)}>
        <View style={{ gap: spacing.xs }}>
          {REMINDER_CHOICES.map((time) => (
            <ListItem
              key={time}
              title={time.replace(':', 'h')}
              right={time === business.reminderTime ? <Badge label="Actuelle" tone="positive" /> : undefined}
              onPress={() => run(async () => void (await services.businesses.updateReminderTime(business.id, user.id, time)))}
            />
          ))}
        </View>
      </BottomSheet>
    </Screen>
  );
}
