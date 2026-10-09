import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { errorMessage } from '@/services/types';
import { Button, Icon, Text, type IconName } from './primitives';
import { colors, radius, spacing } from './theme';

export function LoadingState({ label = 'Chargement…' }: { label?: string }) {
  return (
    <View style={styles.center} accessibilityRole="progressbar" accessibilityLabel={label}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text tone="secondary">{label}</Text>
    </View>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <View style={styles.center}>
      <View style={[styles.circle, { backgroundColor: colors.negativeTint }]}>
        <Icon name="alert-circle-outline" size={32} color={colors.negative} />
      </View>
      <Text variant="heading" align="center">
        Impossible de charger les données
      </Text>
      <Text tone="secondary" align="center">
        {errorMessage(error)}
      </Text>
      {onRetry ? <Button label="Réessayer" onPress={onRetry} variant="secondary" icon="refresh" /> : null}
    </View>
  );
}

export function EmptyState({
  icon = 'leaf-outline',
  title,
  message,
  action,
}: {
  icon?: IconName;
  title: string;
  message: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.center}>
      <View style={styles.circle}>
        <Icon name={icon} size={32} color={colors.primary} />
      </View>
      <Text variant="heading" align="center">
        {title}
      </Text>
      <Text tone="secondary" align="center">
        {message}
      </Text>
      {action}
    </View>
  );
}

type BannerTone = 'info' | 'negative' | 'positive';

export function Banner({ tone = 'info', icon, children }: { tone?: BannerTone; icon?: IconName; children: ReactNode }) {
  const palette = {
    info: { bg: colors.infoTint, fg: colors.info, icon: 'information-circle-outline' as IconName },
    negative: { bg: colors.negativeTint, fg: colors.negative, icon: 'alert-circle-outline' as IconName },
    positive: { bg: colors.primaryTint, fg: colors.primaryDark, icon: 'checkmark-circle-outline' as IconName },
  }[tone];
  return (
    <View
      accessibilityRole={tone === 'negative' ? 'alert' : undefined}
      style={{
        flexDirection: 'row',
        gap: spacing.md,
        backgroundColor: palette.bg,
        borderRadius: radius.md,
        padding: spacing.md,
        alignItems: 'flex-start',
      }}
    >
      <Icon name={icon ?? palette.icon} size={20} color={palette.fg} />
      <View style={{ flex: 1 }}>
        {typeof children === 'string' ? (
          <Text variant="caption" style={{ color: palette.fg }}>
            {children}
          </Text>
        ) : (
          children
        )}
      </View>
    </View>
  );
}

/** Contenu standard d'un écran qui charge des données asynchrones. */
export function AsyncBoundary<T>({
  query,
  children,
}: {
  query: { data: T | undefined; loading: boolean; error: unknown; reload: () => void };
  children: (data: T) => ReactNode;
}) {
  if (query.error && query.data === undefined) return <ErrorState error={query.error} onRetry={query.reload} />;
  if (query.data === undefined) return <LoadingState />;
  return <>{children(query.data)}</>;
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl, paddingVertical: spacing.xxl },
  circle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
