import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';

import { formatFcfa } from '@/domain/money';
import { validateDraft, type DraftErrors } from '@/domain/reports';
import type { Business, Report } from '@/domain/types';
import { currentVersion } from '@/domain/reports';
import { errorMessage } from '@/services/types';
import { useQuery, useServices } from '@/state/services';
import { AsyncBoundary, Banner } from '@/ui/feedback';
import { AmountField, TextField } from '@/ui/forms';
import { Button, Card, Icon, IconButton, Row, Screen, Text } from '@/ui/primitives';
import { colors, radius, spacing } from '@/ui/theme';
import { useConfirmLeave } from './useConfirmLeave';
import {
  draftFromContent,
  draftOpeningCash,
  draftToContent,
  emptyDraft,
  newLine,
  type AmountKey,
  type Draft,
  type DraftAmount,
} from './draft';

interface Props {
  business: Business;
  userId: string;
  /** Présent en modification d'un bilan existant. */
  editing?: Report;
}

/** Saisie du bilan du jour (cahier §5.1) et modification dans la fenêtre de 24 h (§5.5). */
export function ReportForm({ business, userId, editing }: Props) {
  const router = useRouter();
  const services = useServices();
  const [initialDraft] = useState<Draft>(() => (editing ? draftFromContent(currentVersion(editing).content) : emptyDraft()));
  const [draft, setDraft] = useState<Draft>(initialDraft);
  const { allowLeave } = useConfirmLeave(JSON.stringify(draft) !== JSON.stringify(initialDraft));
  const [errors, setErrors] = useState<DraftErrors>({});
  const [submitError, setSubmitError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const stockQuery = useQuery(['stockForReport', business.id, userId], () => services.stock.forReport(business.id, userId), business.stockEnabled);

  const needsOpening = !editing && business.openingCash === null;

  function setAmount(key: AmountKey, patch: Partial<DraftAmount>) {
    setDraft((d) => ({ ...d, [key]: { ...d[key], ...patch } }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function validate() {
    const content = draftToContent(draft);
    const remaining: Record<string, number> = {};
    for (const l of stockQuery.data ?? []) {
      const own = editing ? (currentVersion(editing).content.stockSales.find((s) => s.itemId === l.item.id)?.quantity ?? 0) : 0;
      remaining[l.item.id] = l.remaining + own;
    }
    const result = validateDraft(content, {
      openingCashRequired: needsOpening,
      openingCash: draftOpeningCash(draft),
      remainingStock: business.stockEnabled ? remaining : undefined,
    });
    setErrors(result.errors);
    return { ok: result.ok, content };
  }

  function review() {
    setSubmitError(undefined);
    const { ok, content } = validate();
    if (!ok) return;
    Alert.alert(
      editing ? 'Enregistrer la modification ?' : 'Envoyer le bilan ?',
      `Chiffre d'affaires : ${formatFcfa(content.revenue.total)}\nDépenses : ${formatFcfa(content.expenses.total)}\nAjout à la caisse : ${formatFcfa(content.cashIn.total)}`,
      [
        { text: 'Vérifier', style: 'cancel' },
        { text: editing ? 'Enregistrer' : 'Envoyer', onPress: () => send(content) },
      ],
    );
  }

  async function send(content: ReturnType<typeof draftToContent>) {
    setSaving(true);
    try {
      if (editing) {
        await services.reports.edit(editing.id, userId, content);
        allowLeave();
        router.replace({ pathname: '/report/[id]', params: { id: editing.id } });
      } else {
        const opening = draftOpeningCash(draft);
        const report = await services.reports.submit(business.id, userId, {
          content,
          openingCash: needsOpening && opening !== null ? opening : undefined,
        });
        allowLeave();
        router.replace({ pathname: '/report/[id]', params: { id: report.id } });
      }
    } catch (e) {
      setSubmitError(errorMessage(e));
      setSaving(false);
    }
  }

  return (
    <Screen
      keyboardPersist
      footer={
        <Button
          label={editing ? 'Enregistrer la modification' : 'Envoyer le bilan'}
          icon="send-outline"
          loading={saving}
          onPress={review}
        />
      }
    >
      {editing ? (
        <Banner>La version d'origine est conservée : le propriétaire pourra consulter l'ancienne et la nouvelle version.</Banner>
      ) : null}

      {needsOpening ? (
        <Card tone="tint">
          <Text variant="heading">Caisse de départ</Text>
          <Text variant="caption" tone="secondary">
            Premier bilan de ce business : comptez l'argent présent dans la caisse et déclarez-le. Cette étape n'a lieu qu'une seule fois.
          </Text>
          <AmountField
            label="Montant compté en caisse"
            value={draft.openingCash}
            onChange={(v) => {
              setDraft((d) => ({ ...d, openingCash: v }));
              setErrors((e) => ({ ...e, openingCash: undefined }));
            }}
            error={errors.openingCash}
          />
        </Card>
      ) : null}

      <AmountSection
        title="Chiffre d'affaires"
        hint="Total des ventes du jour."
        value={draft.revenue}
        error={errors.revenue}
        onChange={(patch) => setAmount('revenue', patch)}
        examplePlaceholder="Ex. Chaussures"
      />
      <AmountSection
        title="Dépenses du jour"
        hint="Tout l'argent sorti de la caisse."
        value={draft.expenses}
        error={errors.expenses}
        onChange={(patch) => setAmount('expenses', patch)}
        examplePlaceholder="Ex. Achat ingrédients"
      />
      <AmountSection
        title="Ajout à la caisse"
        hint="Argent déposé en caisse hors vente. Il ne compte pas dans le chiffre d'affaires."
        value={draft.cashIn}
        error={errors.cashIn}
        onChange={(patch) => setAmount('cashIn', patch)}
        examplePlaceholder="Ex. Dépôt propriétaire"
      />

      {business.stockEnabled ? (
        <Card>
          <Text variant="heading">Stock — quantités vendues</Text>
          <AsyncBoundary query={stockQuery}>
            {(levels) =>
              levels.length === 0 ? (
                <Text tone="secondary">Aucun article. Le propriétaire ou le gérant peut en ajouter dans l'onglet Stock.</Text>
              ) : (
                <View style={{ gap: spacing.sm }}>
                  {levels.map((l) => {
                    const own = editing ? (currentVersion(editing).content.stockSales.find((s) => s.itemId === l.item.id)?.quantity ?? 0) : 0;
                    const max = l.remaining + own;
                    const qty = draft.quantities[l.item.id] ?? 0;
                    const setQty = (n: number) => {
                      setDraft((d) => ({ ...d, quantities: { ...d.quantities, [l.item.id]: Math.max(0, Math.min(max, n)) } }));
                      setErrors((e) => ({ ...e, stock: undefined }));
                    };
                    return (
                      <Row key={l.item.id} style={{ justifyContent: 'space-between' }}>
                        <View style={{ flex: 1 }}>
                          <Text variant="bodyStrong">{l.item.name}</Text>
                          <Text variant="caption" tone="secondary">
                            Restant : {max - qty}
                          </Text>
                        </View>
                        <Stepper value={qty} onChange={setQty} label={l.item.name} />
                      </Row>
                    );
                  })}
                </View>
              )
            }
          </AsyncBoundary>
          {errors.stock ? (
            <Text variant="caption" tone="negative">
              {errors.stock}
            </Text>
          ) : (
            <Text variant="caption" tone="muted">
              Facultatif. Le stock restant se met à jour automatiquement.
            </Text>
          )}
        </Card>
      ) : null}

      <TextField
        label="Note du jour"
        optional
        value={draft.note}
        onChangeText={(t) => {
          setDraft((d) => ({ ...d, note: t }));
          setErrors((e) => ({ ...e, note: undefined }));
        }}
        multiline
        maxLength={500}
        placeholder="Un événement, un incident, une remarque…"
        error={errors.note}
      />

      {submitError ? <Banner tone="negative">{submitError}</Banner> : null}
    </Screen>
  );
}

function AmountSection({
  title,
  hint,
  value,
  error,
  onChange,
  examplePlaceholder,
}: {
  title: string;
  hint: string;
  value: DraftAmount;
  error?: string;
  onChange: (patch: Partial<DraftAmount>) => void;
  examplePlaceholder: string;
}) {
  const detailTotal = value.lines.reduce((acc, l) => acc + Number(l.amount || '0'), 0);
  const updateLine = (id: string, patch: Partial<DraftAmount['lines'][number]>) =>
    onChange({ lines: value.lines.map((l) => (l.id === id ? { ...l, ...patch } : l)) });

  return (
    <Card>
      <Text variant="heading">{title}</Text>
      {value.detailOpen ? (
        <View style={{ gap: spacing.md }}>
          {value.lines.map((line) => (
            <View key={line.id} style={{ gap: spacing.xs, borderLeftWidth: 3, borderLeftColor: colors.primaryLight, paddingLeft: spacing.md }}>
              <Row style={{ alignItems: 'flex-start' }}>
                <View style={{ flex: 1, gap: spacing.sm }}>
                  <TextField
                    label="Nom / élément"
                    value={line.label}
                    onChangeText={(t) => updateLine(line.id, { label: t })}
                    placeholder={examplePlaceholder}
                    maxLength={60}
                  />
                  <AmountField label="Montant" value={line.amount} onChange={(v) => updateLine(line.id, { amount: v })} />
                </View>
                <IconButton
                  name="trash-outline"
                  label="Supprimer la ligne"
                  color={colors.negative}
                  onPress={() => onChange({ lines: value.lines.filter((l) => l.id !== line.id) })}
                />
              </Row>
            </View>
          ))}
          <Button
            label="Ajouter une ligne"
            icon="add"
            variant="secondary"
            compact
            onPress={() => onChange({ lines: [...value.lines, newLine()] })}
          />
          <Row style={{ justifyContent: 'space-between' }}>
            <Text variant="bodyStrong">Total</Text>
            <Text variant="heading" tone="primary">
              {formatFcfa(detailTotal)}
            </Text>
          </Row>
          {error ? (
            <Text variant="caption" tone="negative">
              {error}
            </Text>
          ) : null}
          <Pressable
            accessibilityRole="button"
            onPress={() => onChange({ detailOpen: false, total: detailTotal > 0 ? String(detailTotal) : value.total })}
            style={{ minHeight: 48, justifyContent: 'center' }}
          >
            <Row style={{ gap: spacing.xs }}>
              <Icon name="chevron-up" size={16} color={colors.primary} />
              <Text variant="label" tone="primary">
                Revenir au montant global
              </Text>
            </Row>
          </Pressable>
        </View>
      ) : (
        <>
          <AmountField label="Montant global" value={value.total} onChange={(v) => onChange({ total: v })} hint={hint} error={error} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Détailler ${title} (optionnel)`}
            onPress={() => onChange({ detailOpen: true, lines: value.lines.length > 0 ? value.lines : [newLine()] })}
            style={({ pressed }) => ({
              minHeight: 48,
              justifyContent: 'center',
              borderRadius: radius.md,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Row style={{ gap: spacing.xs }}>
              <Icon name="list-outline" size={18} color={colors.primary} />
              <Text variant="label" tone="primary">
                Détailler (optionnel)
              </Text>
            </Row>
          </Pressable>
        </>
      )}
    </Card>
  );
}

function Stepper({ value, onChange, label }: { value: number; onChange: (n: number) => void; label: string }) {
  return (
    <Row style={{ gap: spacing.xs }}>
      <IconButton name="remove-circle-outline" label={`Retirer un ${label}`} color={colors.primary} onPress={() => onChange(value - 1)} />
      <Text variant="heading" style={{ minWidth: 28 }} align="center" accessibilityLabel={`${value} vendus`}>
        {value}
      </Text>
      <IconButton name="add-circle-outline" label={`Ajouter un ${label}`} color={colors.primary} onPress={() => onChange(value + 1)} />
    </Row>
  );
}
