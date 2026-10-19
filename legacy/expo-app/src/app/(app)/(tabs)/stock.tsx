import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { can } from '@/domain/permissions';
import { useCurrentBusiness } from '@/state/business';
import { useQuery, useServices } from '@/state/services';
import { AsyncBoundary, EmptyState } from '@/ui/feedback';
import { Badge, Button, Card, Divider, ListItem, Screen, Text } from '@/ui/primitives';

/** Module Stock facultatif : le restant se déduit des ventes déclarées dans les bilans. */
export default function StockTab() {
  const router = useRouter();
  const services = useServices();
  const { user, overview } = useCurrentBusiness();
  const { business, access } = overview;
  const query = useQuery(['stock', business.id, user.id], () => services.stock.list(business.id, user.id));

  return (
    <Screen>
      {can(access, 'manageStock') ? (
        <Button label="Ajouter un article" icon="add" onPress={() => router.push('/stock/new')} />
      ) : null}
      <AsyncBoundary query={query}>
        {(levels) =>
          levels.length === 0 ? (
            <EmptyState
              icon="cube-outline"
              title="Aucun article"
              message="Ajoutez vos articles : le restant se mettra à jour à chaque bilan où des ventes sont déclarées."
            />
          ) : (
            <Card style={{ gap: 0 }}>
              {levels.map((l, i) => (
                <View key={l.item.id}>
                  {i > 0 ? <Divider /> : null}
                  <ListItem
                    title={l.item.name}
                    subtitle={`Départ ${l.item.initialQuantity} · vendus ${l.sold}`}
                    right={
                      <View style={{ alignItems: 'flex-end', gap: 4 }}>
                        <Text variant="heading">{l.remaining}</Text>
                        {l.remaining <= l.item.initialQuantity * 0.1 ? <Badge label="Stock bas" tone="negative" /> : null}
                      </View>
                    }
                  />
                </View>
              ))}
            </Card>
          )
        }
      </AsyncBoundary>
    </Screen>
  );
}
