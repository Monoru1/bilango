import { View } from 'react-native';

import { formatFcfa } from '@/domain/money';
import type { CashDay } from '@/domain/reports';
import { BigAmount } from '@/ui/numbers';
import { Card, Icon, Row, Text } from '@/ui/primitives';
import { colors, spacing } from '@/ui/theme';

/**
 * Caisse théorique (cahier §5.3) : même niveau d'importance que le CA. Aucun écart ni alerte :
 * l'app donne la référence, le contrôle physique reste celui du propriétaire.
 */
export function CashDayCard({ cash, missing, emphasis = false }: { cash: CashDay | null; missing: boolean; emphasis?: boolean }) {
  const tone = emphasis ? 'onPrimary' : 'primary';
  const sub = emphasis ? 'onPrimary' : 'secondary';
  return (
    <Card tone={emphasis ? 'primary' : 'tint'} style={{ gap: spacing.sm }}>
      <Row>
        <Icon name="wallet-outline" color={emphasis ? colors.textOnPrimary : colors.primaryDark} />
        <Text variant="label" tone={tone}>
          Caisse théorique
        </Text>
      </Row>
      {cash ? (
        <>
          <BigAmount value={cash.closing} tone={tone} />
          <Text variant="caption" tone={sub}>
            Veille {formatFcfa(cash.opening)} + CA {formatFcfa(cash.revenue)} + ajouts {formatFcfa(cash.cashIn)} − dépenses{' '}
            {formatFcfa(cash.expenses)}
          </Text>
        </>
      ) : (
        <View style={{ gap: spacing.xs }}>
          <Text variant="bodyStrong" tone={tone}>
            Pas encore calculée
          </Text>
          {missing ? (
            <Text variant="caption" tone={sub}>
              La caisse de départ sera comptée et déclarée une seule fois, au premier bilan.
            </Text>
          ) : null}
        </View>
      )}
    </Card>
  );
}
