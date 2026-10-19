import { View } from 'react-native';

import { formatFcfa, formatSignedFcfa } from '@/domain/money';
import { Text, type TextTone } from './primitives';
import { spacing } from './theme';

/** Montant en grand : le "chiffre fort" de l'écran. */
export function BigAmount({ value, tone = 'default' }: { value: number; tone?: TextTone }) {
  return (
    <Text variant="display" tone={tone} adjustsFontSizeToFit numberOfLines={1} accessibilityLabel={formatFcfa(value)}>
      {formatFcfa(value)}
    </Text>
  );
}

/** Ligne libellé / montant, pour les décompositions (caisse, détail du bilan). */
export function AmountRow({
  label,
  value,
  signed = false,
  strong = false,
  tone = 'default',
}: {
  label: string;
  value: number;
  signed?: boolean;
  strong?: boolean;
  tone?: TextTone;
}) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, alignItems: 'baseline' }}>
      <Text variant={strong ? 'bodyStrong' : 'body'} tone={strong ? tone : 'secondary'} style={{ flexShrink: 1 }}>
        {label}
      </Text>
      <Text variant={strong ? 'bodyStrong' : 'body'} tone={tone}>
        {signed ? formatSignedFcfa(value) : formatFcfa(value)}
      </Text>
    </View>
  );
}
