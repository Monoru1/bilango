import { useState } from 'react';
import { Pressable, StyleSheet, Switch, TextInput, View, type TextInputProps } from 'react-native';

import { groupThousands } from '@/domain/money';
import { colors, MIN_TOUCH, radius, spacing, typography } from './theme';
import { Row, Text } from './primitives';

interface FieldShellProps {
  label: string;
  error?: string;
  hint?: string;
  optional?: boolean;
}

function FieldShell({ label, error, hint, optional, children }: FieldShellProps & { children: React.ReactNode }) {
  return (
    <View style={{ gap: spacing.xs }}>
      <Row style={{ gap: spacing.xs }}>
        <Text variant="label">{label}</Text>
        {optional ? (
          <Text variant="caption" tone="muted">
            (facultatif)
          </Text>
        ) : null}
      </Row>
      {children}
      {error ? (
        <Text variant="caption" tone="negative" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" tone="secondary">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

interface TextFieldProps extends Omit<TextInputProps, 'style'>, FieldShellProps {}

export function TextField({ label, error, hint, optional, ...input }: TextFieldProps) {
  const [focused, setFocused] = useState(false);
  return (
    <FieldShell label={label} error={error} hint={hint} optional={optional}>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.textMuted}
        {...input}
        onFocus={(e) => {
          setFocused(true);
          input.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          input.onBlur?.(e);
        }}
        style={[styles.input, focused && styles.inputFocused, !!error && styles.inputError, input.multiline && styles.multiline]}
      />
    </FieldShell>
  );
}

interface AmountFieldProps extends FieldShellProps {
  /** Chaîne de chiffres, sans espaces. */
  value: string;
  onChange: (digits: string) => void;
  placeholder?: string;
  editable?: boolean;
  /** Unité affichée à droite ; "FCFA" par défaut, vide pour une simple quantité. */
  suffix?: string;
}

/** Saisie d'un montant en FCFA : clavier numérique, groupement des milliers à l'affichage. */
export function AmountField({
  label,
  error,
  hint,
  optional,
  value,
  onChange,
  placeholder = '0',
  editable = true,
  suffix = 'FCFA',
}: AmountFieldProps) {
  const [focused, setFocused] = useState(false);
  return (
    <FieldShell label={label} error={error} hint={hint} optional={optional}>
      <View style={[styles.amountBox, focused && styles.inputFocused, !!error && styles.inputError, !editable && styles.disabled]}>
        <TextInput
          accessibilityLabel={suffix === 'FCFA' ? `${label}, en francs CFA` : label}
          keyboardType="number-pad"
          inputMode="numeric"
          editable={editable}
          value={value === '' ? '' : groupThousands(Number(value))}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          onChangeText={(t) => onChange(t.replace(/\D/g, '').slice(0, 12))}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[typography.heading, styles.amountInput]}
        />
        {suffix ? (
          <Text variant="label" tone="secondary">
            {suffix}
          </Text>
        ) : null}
      </View>
    </FieldShell>
  );
}

export function SwitchRow({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
      onPress={() => onChange(!value)}
      style={styles.switchRow}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="bodyStrong">{label}</Text>
        {description ? (
          <Text variant="caption" tone="secondary">
            {description}
          </Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: colors.primaryLight, false: colors.border }}
        thumbColor={value ? colors.primary : '#FFFFFF'}
      />
    </Pressable>
  );
}

interface SegmentedProps<T extends string | number> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}

export function Segmented<T extends string | number>({ options, value, onChange }: SegmentedProps<T>) {
  return (
    <View style={styles.segmented} accessibilityRole="tablist">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(o.value)}
            style={[styles.segment, active && styles.segmentActive]}
          >
            <Text variant="label" tone={active ? 'onPrimary' : 'secondary'}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Choix exclusif sous forme de cartes (secteur, rôle). */
export function ChoiceList<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; description?: string }[];
  value: T | null;
  onChange: (v: T) => void;
}) {
  return (
    <View style={{ gap: spacing.sm }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(o.value)}
            style={[styles.choice, active && styles.choiceActive]}
          >
            <View style={[styles.radio, active && styles.radioActive]}>
              {active ? <View style={styles.radioDot} /> : null}
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="bodyStrong">{o.label}</Text>
              {o.description ? (
                <Text variant="caption" tone="secondary">
                  {o.description}
                </Text>
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    minHeight: MIN_TOUCH + 4,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    color: colors.text,
    ...typography.body,
  },
  multiline: { minHeight: 96, textAlignVertical: 'top', paddingTop: spacing.md },
  inputFocused: { borderColor: colors.primary },
  inputError: { borderColor: colors.negative },
  disabled: { opacity: 0.5 },
  amountBox: {
    minHeight: MIN_TOUCH + 4,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  amountInput: { flex: 1, color: colors.text, paddingVertical: spacing.sm },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: MIN_TOUCH + 8,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segmented: {
    flexDirection: 'row',
    backgroundColor: colors.neutralTint,
    borderRadius: radius.pill,
    padding: 4,
  },
  segment: {
    flex: 1,
    minHeight: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentActive: { backgroundColor: colors.primary },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    minHeight: MIN_TOUCH + 8,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  choiceActive: { borderColor: colors.primary, backgroundColor: colors.primaryTint },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: { borderColor: colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
});
