import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, radius, spacing } from './theme';
import { Icon, Text } from './primitives';

const LENGTH = 4;
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'] as const;

/**
 * Pavé numérique pour le PIN local à 4 chiffres. Grandes cibles tactiles, pas de clavier
 * système (pas de suggestion ni de capture clavier tiers). Pour vider la saisie, remonter
 * le composant en changeant sa `key`.
 */
export function PinPad({ onComplete, disabled = false }: { onComplete: (pin: string) => void; disabled?: boolean }) {
  const [digits, setDigits] = useState('');

  function press(key: (typeof KEYS)[number]) {
    if (disabled || key === '') return;
    if (key === 'del') return setDigits((d) => d.slice(0, -1));
    if (digits.length >= LENGTH) return;
    const next = digits + key;
    setDigits(next);
    if (next.length === LENGTH) onComplete(next);
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.dots} accessibilityLabel={`${digits.length} chiffres saisis sur ${LENGTH}`} accessibilityLiveRegion="polite">
        {Array.from({ length: LENGTH }, (_, i) => (
          <View key={i} style={[styles.dot, i < digits.length && styles.dotFilled]} />
        ))}
      </View>
      <View style={styles.grid}>
        {KEYS.map((key, i) =>
          key === '' ? (
            <View key={i} style={styles.key} />
          ) : (
            <Pressable
              key={i}
              accessibilityRole="button"
              accessibilityLabel={key === 'del' ? 'Effacer' : key}
              onPress={() => press(key)}
              style={({ pressed }) => [styles.key, styles.keyActive, pressed && { backgroundColor: colors.primaryTint }]}
            >
              {key === 'del' ? <Icon name="backspace-outline" size={26} /> : <Text variant="title">{key}</Text>}
            </Pressable>
          ),
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: spacing.xl },
  dots: { flexDirection: 'row', gap: spacing.lg },
  dot: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: colors.primary },
  dotFilled: { backgroundColor: colors.primary },
  grid: { width: 280, flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, justifyContent: 'center' },
  key: { width: 80, height: 64, alignItems: 'center', justifyContent: 'center', borderRadius: radius.lg },
  keyActive: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
});
