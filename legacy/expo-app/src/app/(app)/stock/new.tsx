import { useRouter } from 'expo-router';
import { useState } from 'react';

import { errorMessage } from '@/services/types';
import { useCurrentBusiness } from '@/state/business';
import { useServices } from '@/state/services';
import { Banner } from '@/ui/feedback';
import { AmountField, TextField } from '@/ui/forms';
import { Button, Screen } from '@/ui/primitives';

export default function NewStockItem() {
  const router = useRouter();
  const services = useServices();
  const { user, overview } = useCurrentBusiness();
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [nameError, setNameError] = useState<string>();
  const [quantityError, setQuantityError] = useState<string>();
  const [submitError, setSubmitError] = useState<string>();
  const [loading, setLoading] = useState(false);

  async function submit() {
    setNameError(name.trim().length >= 2 ? undefined : "Indiquez le nom de l'article.");
    setQuantityError(quantity === '' ? 'Indiquez la quantité de départ.' : undefined);
    setSubmitError(undefined);
    if (name.trim().length < 2 || quantity === '') return;
    setLoading(true);
    try {
      await services.stock.addItem(overview.business.id, user.id, { name, initialQuantity: Number(quantity) });
      router.back();
    } catch (e) {
      setSubmitError(errorMessage(e));
      setLoading(false);
    }
  }

  return (
    <Screen keyboardPersist footer={<Button label="Ajouter l'article" loading={loading} onPress={submit} />}>
      <TextField
        label="Nom de l'article"
        value={name}
        onChangeText={(t) => {
          setName(t);
          setNameError(undefined);
        }}
        placeholder="Ex. Bière locale 33 cl"
        error={nameError}
        maxLength={60}
      />
      <AmountField
        label="Quantité de départ"
        value={quantity}
        onChange={(v) => {
          setQuantity(v);
          setQuantityError(undefined);
        }}
        error={quantityError}
        suffix=""
        hint="Nombre d'unités actuellement en stock."
      />
      {submitError ? <Banner tone="negative">{submitError}</Banner> : null}
    </Screen>
  );
}
