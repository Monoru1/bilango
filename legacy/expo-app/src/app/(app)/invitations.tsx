import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { formatDayShort, toDayKey } from '@/domain/dates';
import { LEVEL_LABELS } from '@/domain/permissions';
import type { Invitation } from '@/domain/types';
import { errorMessage } from '@/services/types';
import { useBusiness } from '@/state/business';
import { useQuery, useServices } from '@/state/services';
import { AsyncBoundary, Banner, EmptyState } from '@/ui/feedback';
import { Button, Card, Row, Screen, Text } from '@/ui/primitives';
import { spacing } from '@/ui/theme';

/** Invitations reçues : l'accès n'est effectif qu'après acceptation (cahier §4.2bis). */
export default function InvitationsScreen() {
  const router = useRouter();
  const services = useServices();
  const { user, overviews, select } = useBusiness();
  const query = useQuery(['myInvitations', user.id], () => services.team.listMyInvitations(user.id));
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string>();

  async function respond(inv: Invitation, accept: boolean) {
    setBusyId(inv.id);
    setError(undefined);
    try {
      await services.team.respondToInvitation(inv.id, user.id, accept);
      if (accept) {
        select(inv.businessId);
        router.replace('/home');
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusyId(null);
    }
  }

  const hasBusiness = (overviews?.length ?? 0) > 0;

  return (
    <Screen>
      {error ? <Banner tone="negative">{error}</Banner> : null}
      <AsyncBoundary query={query}>
        {(list) =>
          list.length === 0 ? (
            <EmptyState
              icon="mail-open-outline"
              title="Aucune invitation"
              message="Quand un propriétaire vous invite sur son business, l'invitation apparaît ici. Vous choisissez de l'accepter ou de la refuser."
              action={
                !hasBusiness ? <Button label="Créer mon business" onPress={() => router.replace('/business/new')} /> : undefined
              }
            />
          ) : (
            <>
              <Text tone="secondary">Vous n'aurez accès au business qu'après avoir accepté l'invitation.</Text>
              {list.map((inv) => (
                <Card key={inv.id}>
                  <Text variant="title">{inv.businessName}</Text>
                  <Text>
                    Rôle proposé : <Text variant="bodyStrong">{inv.roleName}</Text> ({LEVEL_LABELS[inv.level]})
                  </Text>
                  <Text variant="caption" tone="secondary">
                    Invité par {inv.invitedByName} · {formatDayShort(toDayKey(inv.createdAt))}
                  </Text>
                  <View style={{ marginTop: spacing.sm }}>
                    <Row>
                      <Button
                        label="Refuser"
                        variant="secondary"
                        style={{ flex: 1 }}
                        disabled={busyId !== null}
                        onPress={() => respond(inv, false)}
                      />
                      <Button
                        label="Accepter"
                        style={{ flex: 1 }}
                        loading={busyId === inv.id}
                        disabled={busyId !== null}
                        onPress={() => respond(inv, true)}
                      />
                    </Row>
                  </View>
                </Card>
              ))}
            </>
          )
        }
      </AsyncBoundary>
    </Screen>
  );
}
