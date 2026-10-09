import { View } from 'react-native';

import type { ReportAmount, ReportContent } from '@/domain/types';
import { AmountRow } from '@/ui/numbers';
import { Card, Divider, Text } from '@/ui/primitives';
import { spacing } from '@/ui/theme';

function AmountBlock({ title, amount, sign }: { title: string; amount: ReportAmount; sign: '+' | '−' }) {
  return (
    <Card>
      <AmountRow label={title} value={amount.total} strong tone="primary" />
      {amount.lines.length > 0 ? (
        <View style={{ gap: spacing.xs }}>
          <Divider />
          {amount.lines.map((l) => (
            <AmountRow key={l.id} label={l.label} value={l.amount} />
          ))}
        </View>
      ) : amount.total > 0 ? (
        <Text variant="caption" tone="muted">
          Montant global, non détaillé ({sign === '+' ? 'entrée' : 'sortie'} de caisse).
        </Text>
      ) : null}
    </Card>
  );
}

/** Lecture d'une version de bilan : montants, détails, ventes de stock, note. */
export function ContentView({ content, stockNames }: { content: ReportContent; stockNames: Record<string, string> }) {
  return (
    <View style={{ gap: spacing.md }}>
      <AmountBlock title="Chiffre d'affaires" amount={content.revenue} sign="+" />
      <AmountBlock title="Dépenses" amount={content.expenses} sign="−" />
      <AmountBlock title="Ajout à la caisse" amount={content.cashIn} sign="+" />
      {content.stockSales.length > 0 ? (
        <Card>
          <Text variant="heading">Stock vendu</Text>
          {content.stockSales.map((s) => (
            <View key={s.itemId} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text tone="secondary">{stockNames[s.itemId] ?? 'Article supprimé'}</Text>
              <Text variant="bodyStrong">{s.quantity}</Text>
            </View>
          ))}
        </Card>
      ) : null}
      {content.note ? (
        <Card>
          <Text variant="heading">Note du jour</Text>
          <Text>{content.note}</Text>
        </Card>
      ) : null}
    </View>
  );
}
