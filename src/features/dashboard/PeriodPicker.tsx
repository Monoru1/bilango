import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { addDays, calendarDays, frenchDay, formatDayFull, parseFrenchDay, rangeError, type DateRange } from '@/domain/dates';
import { TextField } from '@/ui/forms';
import { BottomSheet } from '@/ui/sheet';
import { Button, IconButton, Row, Text } from '@/ui/primitives';
import { colors, homeColors, MIN_TOUCH } from '@/ui/theme';

/** Calendrier React Native sans dépendance : saisie directe pour les longues plages. */
export function PeriodPicker({ initial, today, onApply, onClose }: {
  initial: DateRange; today: string; onApply: (range: DateRange) => void; onClose: () => void;
}) {
  const [from, setFrom] = useState(frenchDay(initial.from));
  const [to, setTo] = useState(frenchDay(initial.to));
  const [field, setField] = useState<'from' | 'to'>('from');
  const [month, setMonth] = useState(`${initial.from.slice(0, 7)}-01`);
  const [error, setError] = useState<string>();
  const parsedFrom = parseFrenchDay(from);
  const parsedTo = parseFrenchDay(to);

  function apply() {
    const range = { from: parsedFrom ?? '', to: parsedTo ?? '' };
    const invalid = rangeError(range, today);
    if (invalid) { setError(invalid); return; }
    onApply(range);
  }

  function moveMonth(direction: number) {
    const next = direction < 0 ? `${addDays(month, -1).slice(0, 7)}-01` : addDays(month, 32).slice(0, 7) + '-01';
    if (next >= '0001-01-01' && next <= today) setMonth(next);
  }

  return <BottomSheet visible title="Période personnalisée" onClose={onClose}>
    <Text variant="caption" style={{ color: homeColors.secondary }}>Dates inclusives · heure de Porto-Novo. Aucune durée maximale.</Text>
    <TextField label="Date de début (JJ/MM/AAAA)" value={from} onChangeText={v => { setFrom(v); const parsed = parseFrenchDay(v); if (parsed && parsed <= today) setMonth(`${parsed.slice(0, 7)}-01`); setError(undefined); }} onFocus={() => setField('from')} placeholder="01/01/2025" keyboardType="numbers-and-punctuation" />
    <TextField label="Date de fin (JJ/MM/AAAA)" value={to} onChangeText={v => { setTo(v); setError(undefined); }} onFocus={() => setField('to')} placeholder="09/10/2026" keyboardType="numbers-and-punctuation" />
    <Row>
      <Button label="Choisir le début" variant={field === 'from' ? 'secondary' : 'ghost'} onPress={() => setField('from')} style={{ flex: 1 }} />
      <Button label="Choisir la fin" variant={field === 'to' ? 'secondary' : 'ghost'} onPress={() => setField('to')} style={{ flex: 1 }} />
    </Row>
    <Row style={{ justifyContent: 'space-between' }}>
      <IconButton name="chevron-back" label="Mois précédent" onPress={() => moveMonth(-1)} />
      <Text variant="label">{formatDayFull(month).replace(/^1 /, '')}</Text>
      <IconButton name="chevron-forward" label="Mois suivant" onPress={() => moveMonth(1)} />
    </Row>
    <ScrollView horizontal contentContainerStyle={{ minWidth: 7 * MIN_TOUCH, flexGrow: 1 }}>
      <View style={{ width: 7 * MIN_TOUCH, alignSelf: 'center' }}>
        <Row style={{ gap: 0 }}>{['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(d => <Text key={d} variant="caption" align="center" style={{ width: MIN_TOUCH }}>{d}</Text>)}</Row>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {calendarDays(month).map(day => {
            const disabled = day > today || day < '0001-01-01';
            const selected = day === parsedFrom || day === parsedTo;
            const inside = parsedFrom && parsedTo && day >= parsedFrom && day <= parsedTo;
            return <Pressable key={day} accessibilityRole="button" accessibilityLabel={`Choisir le ${formatDayFull(day)} comme ${field === 'from' ? 'début' : 'fin'}`} accessibilityState={{ selected, disabled }} disabled={disabled}
              onPress={() => { (field === 'from' ? setFrom : setTo)(frenchDay(day)); if (field === 'from') setField('to'); setError(undefined); }}
              style={{ width: MIN_TOUCH, minHeight: MIN_TOUCH, justifyContent: 'center', alignItems: 'center', backgroundColor: selected ? colors.primary : inside ? colors.primaryTint : 'white', borderRadius: 8 }}>
              <Text style={{ color: selected ? 'white' : homeColors.text, opacity: disabled ? 0.4 : 1 }}>{Number(day.slice(8))}</Text>
            </Pressable>;
          })}
        </View>
      </View>
    </ScrollView>
    <Text variant="caption">Sélection : {from} → {to}</Text>
    {error ? <Text tone="negative" accessibilityLiveRegion="polite">{error}</Text> : null}
    <Button label="Appliquer la période" onPress={apply} style={{ backgroundColor: homeColors.text }} />
  </BottomSheet>;
}
