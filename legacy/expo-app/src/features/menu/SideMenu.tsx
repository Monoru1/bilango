import { useRouter, type Href } from 'expo-router';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatFcfa, formatPhone } from '@/domain/money';
import { can, roleLabel } from '@/domain/permissions';
import { useBusiness } from '@/state/business';
import { useQuery, useServices } from '@/state/services';
import { useSessionController } from '@/state/session';
import { Logo } from '@/ui/logo';
import { Avatar, Badge, Divider, Icon, ListItem, Row, Text } from '@/ui/primitives';
import { colors, radius, spacing } from '@/ui/theme';

/**
 * Menu latéral (hamburger, cahier §4.5) : business du compte avec CA du jour, business courant
 * marqué, accès rapide au bilan du jour, jours d'abonnement restants et "+ Ajouter un business".
 */
export function SideMenu() {
  const router = useRouter();
  const services = useServices();
  const session = useSessionController();
  const insets = useSafeAreaInsets();
  const { user, overviews, current, select, menuOpen, setMenuOpen } = useBusiness();

  const invitations = useQuery(['myInvitations', user.id], () => services.team.listMyInvitations(user.id));
  const subscription = useQuery(
    ['subscription', current?.business.id, user.id],
    () => services.subscriptions.get(current!.business.id, user.id),
    current !== null,
  );

  function go(href: Href) {
    setMenuOpen(false);
    router.push(href);
  }

  const days = subscription.data?.daysRemaining;
  const status = subscription.data?.status;
  const subscriptionLabel =
    status === undefined
      ? undefined
      : status === 'expired'
        ? 'Abonnement expiré'
        : `${days} jour${days === 1 ? '' : 's'} restant${days === 1 ? '' : 's'}${status === 'trial' ? " d'essai" : ''}`;

  return (
    <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)} statusBarTranslucent>
      <View style={styles.root}>
        <View style={[styles.panel, { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.md }]}>
          <ScrollView contentContainerStyle={{ gap: spacing.lg, paddingBottom: spacing.lg }} showsVerticalScrollIndicator={false}>
            <Row>
              <Logo size={44} />
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong" numberOfLines={1}>
                  {user.name}
                </Text>
                <Text variant="caption" tone="secondary">
                  {formatPhone(user.phone)}
                </Text>
              </View>
            </Row>

            <View style={{ gap: spacing.xs }}>
              <Text variant="label" tone="secondary">
                MES BUSINESS
              </Text>
              {(overviews ?? []).map((o) => {
                const active = o.business.id === current?.business.id;
                return (
                  <Pressable
                    key={o.business.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={`${o.business.name}, ${roleLabel(o.access)}${
                      o.todayRevenue !== null ? `, chiffre d'affaires du jour ${formatFcfa(o.todayRevenue)}` : ''
                    }${active ? ', affiché' : ''}`}
                    onPress={() => {
                      select(o.business.id);
                      setMenuOpen(false);
                      router.navigate('/home');
                    }}
                    style={[styles.business, active && styles.businessActive]}
                  >
                    <Avatar name={o.business.name} size={36} />
                    <View style={{ flex: 1 }}>
                      <Text variant="bodyStrong" numberOfLines={1}>
                        {o.business.name}
                      </Text>
                      <Text variant="caption" tone="secondary">
                        {roleLabel(o.access)}
                      </Text>
                    </View>
                    {o.todayRevenue !== null ? (
                      <Text variant="label" tone="primary">
                        {formatFcfa(o.todayRevenue)}
                      </Text>
                    ) : null}
                    {active ? <Icon name="checkmark-circle" size={20} color={colors.primary} /> : null}
                  </Pressable>
                );
              })}
              <ListItem title="Ajouter un business" icon="add" onPress={() => go('/business/new')} />
            </View>

            <Divider />

            {current && can(current.access, 'submitReport') ? (
              <ListItem title="Faire le bilan du jour" icon="create-outline" onPress={() => go('/report/new')} />
            ) : null}
            <ListItem
              title="Invitations"
              icon="mail-unread-outline"
              onPress={() => go('/invitations')}
              right={(invitations.data?.length ?? 0) > 0 ? <Badge tone="positive" label={String(invitations.data?.length)} /> : undefined}
            />
            {current && can(current.access, 'viewSubscription') ? (
              <ListItem
                title="Mon abonnement"
                subtitle={subscriptionLabel}
                icon="card-outline"
                onPress={() => go('/subscription')}
              />
            ) : subscriptionLabel ? (
              <ListItem title="Abonnement du business" subtitle={subscriptionLabel} icon="card-outline" />
            ) : null}
            <ListItem title="Comment utiliser l'application" icon="help-circle-outline" onPress={() => go('/help')} />
            <Divider />
            <ListItem
              title="Se déconnecter"
              subtitle="Votre PIN suffira pour revenir"
              icon="log-out-outline"
              tone="negative"
              onPress={() => {
                setMenuOpen(false);
                session.lock();
              }}
            />
          </ScrollView>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Fermer le menu"
          style={styles.scrim}
          onPress={() => setMenuOpen(false)}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row' },
  panel: { width: '82%', maxWidth: 340, backgroundColor: colors.surface, paddingHorizontal: spacing.lg },
  scrim: { flex: 1, backgroundColor: colors.overlay },
  business: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.sm,
    minHeight: 56,
    borderRadius: radius.md,
  },
  businessActive: { backgroundColor: colors.primaryTint },
});
