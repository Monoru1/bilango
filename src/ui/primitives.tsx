import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text as RNText,
  View,
  type StyleProp,
  type TextProps as RNTextProps,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, MIN_TOUCH, radius, spacing, typography, type TextVariant } from './theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export function Icon({ name, size = 22, color = colors.text }: { name: IconName; size?: number; color?: string }) {
  return <Ionicons name={name} size={size} color={color} />;
}

// --- Texte -------------------------------------------------------------------------

export type TextTone = 'default' | 'secondary' | 'muted' | 'primary' | 'onPrimary' | 'negative';

const TONES: Record<TextTone, string> = {
  default: colors.text,
  secondary: colors.textSecondary,
  muted: colors.textMuted,
  primary: colors.primaryDark,
  onPrimary: colors.textOnPrimary,
  negative: colors.negative,
};

interface TextProps extends RNTextProps {
  variant?: TextVariant;
  tone?: TextTone;
  align?: 'left' | 'center' | 'right';
}

export function Text({ variant = 'body', tone = 'default', align, style, ...rest }: TextProps) {
  return <RNText {...rest} style={[typography[variant], { color: TONES[tone] }, align && { textAlign: align }, style]} />;
}

// --- Écran -------------------------------------------------------------------------

interface ScreenProps {
  children: ReactNode;
  /** Désactive le défilement (écrans courts avec action en bas). */
  scroll?: boolean;
  /** Contenu fixé en bas (bouton principal). */
  footer?: ReactNode;
  padded?: boolean;
  keyboardPersist?: boolean;
  /** Marge haute (safe area) : désactivée quand un en-tête natif est déjà affiché. */
  topInset?: boolean;
}

export function Screen({ children, scroll = true, footer, padded = true, keyboardPersist, topInset = false }: ScreenProps) {
  const insets = useSafeAreaInsets();
  const pad = padded ? spacing.lg : 0;
  return (
    <View style={[styles.screen, topInset && { paddingTop: insets.top }]}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={{ padding: pad, paddingBottom: pad + spacing.xl, gap: spacing.lg }}
          keyboardShouldPersistTaps={keyboardPersist ? 'always' : 'handled'}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={{ flex: 1, padding: pad, gap: spacing.lg }}>{children}</View>
      )}
      {footer ? (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>{footer}</View>
      ) : null}
    </View>
  );
}

// --- Boutons -----------------------------------------------------------------------

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  loading = false,
  disabled = false,
  compact = false,
  style,
  accessibilityHint,
}: ButtonProps) {
  const inactive = disabled || loading;
  const fg =
    variant === 'primary' ? colors.textOnPrimary : variant === 'danger' ? colors.negative : colors.primary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      onPress={inactive ? undefined : onPress}
      style={({ pressed }) => [
        styles.button,
        compact && styles.buttonCompact,
        variant === 'primary' && { backgroundColor: colors.primary },
        variant === 'secondary' && { backgroundColor: colors.primaryTint },
        variant === 'danger' && { backgroundColor: colors.negativeTint },
        variant === 'ghost' && { backgroundColor: 'transparent' },
        pressed && !inactive && { opacity: 0.85 },
        disabled && { opacity: 0.45 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon ? <Icon name={icon} size={20} color={fg} /> : null}
          <RNText style={[typography.bodyStrong, { color: fg }]}>{label}</RNText>
        </>
      )}
    </Pressable>
  );
}

export function IconButton({
  name,
  onPress,
  label,
  color = colors.text,
}: {
  name: IconName;
  onPress: () => void;
  label: string;
  color?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.iconButton, pressed && { opacity: 0.6 }]}
    >
      <Icon name={name} size={26} color={color} />
    </Pressable>
  );
}

// --- Cartes et lignes ----------------------------------------------------------------

export function Card({
  children,
  style,
  tone = 'surface',
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  tone?: 'surface' | 'primary' | 'tint';
}) {
  return (
    <View
      style={[
        styles.card,
        tone === 'primary' && { backgroundColor: colors.primary, borderColor: colors.primary },
        tone === 'tint' && { backgroundColor: colors.primaryTint, borderColor: colors.primaryTint },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Row({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }, style]}>{children}</View>;
}

export function SectionTitle({ children, action }: { children: string; action?: ReactNode }) {
  return (
    <Row style={{ justifyContent: 'space-between' }}>
      <Text variant="heading">{children}</Text>
      {action}
    </Row>
  );
}

export function Divider() {
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border }} />;
}

interface ListItemProps {
  title: string;
  subtitle?: string;
  icon?: IconName;
  right?: ReactNode;
  onPress?: () => void;
  chevron?: boolean;
  tone?: 'default' | 'negative';
}

export function ListItem({ title, subtitle, icon, right, onPress, chevron, tone = 'default' }: ListItemProps) {
  const content = (
    <Row style={styles.listItem}>
      {icon ? (
        <View style={styles.listIcon}>
          <Icon name={icon} size={20} color={tone === 'negative' ? colors.negative : colors.primary} />
        </View>
      ) : null}
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="bodyStrong" tone={tone === 'negative' ? 'negative' : 'default'}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" tone="secondary">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
      {chevron ? <Icon name="chevron-forward" size={18} color={colors.textMuted} /> : null}
    </Row>
  );
  if (!onPress) return content;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
      onPress={onPress}
      style={({ pressed }) => pressed && { backgroundColor: colors.neutralTint }}
    >
      {content}
    </Pressable>
  );
}

// --- Badges et avatars ---------------------------------------------------------------

type BadgeTone = 'neutral' | 'positive' | 'negative' | 'info';

export function Badge({ label, tone = 'neutral', icon }: { label: string; tone?: BadgeTone; icon?: IconName }) {
  const palette: Record<BadgeTone, { bg: string; fg: string }> = {
    neutral: { bg: colors.neutralTint, fg: colors.textSecondary },
    positive: { bg: colors.primaryTint, fg: colors.primaryDark },
    negative: { bg: colors.negativeTint, fg: colors.negative },
    info: { bg: colors.infoTint, fg: colors.info },
  };
  const { bg, fg } = palette[tone];
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      {icon ? <Icon name={icon} size={13} color={fg} /> : null}
      <RNText style={[typography.caption, { color: fg, fontWeight: '600' }]}>{label}</RNText>
    </View>
  );
}

export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
  return (
    <View
      accessibilityElementsHidden
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.primaryTint,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <RNText style={[typography.label, { color: colors.primaryDark }]}>{initials || '?'}</RNText>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  button: {
    minHeight: MIN_TOUCH + 4,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  buttonCompact: { minHeight: MIN_TOUCH - 8, paddingHorizontal: spacing.md },
  iconButton: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  listItem: { minHeight: MIN_TOUCH + 8, paddingVertical: spacing.sm },
  listIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
});
