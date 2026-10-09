import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';

import { formatDayFull, formatDayRelative, formatTime, periodRange, toDayKey } from '@/domain/dates';
import { groupThousands } from '@/domain/money';
import { can } from '@/domain/permissions';
import type { Access, Business } from '@/domain/types';
import { useBusiness } from '@/state/business';
import { useQuery, useServices } from '@/state/services';
import { AsyncBoundary, EmptyState } from '@/ui/feedback';
import { Badge, Button, Row, Screen, Text } from '@/ui/primitives';
import { colors, homeColors, MIN_TOUCH } from '@/ui/theme';
import { PeriodPicker } from './PeriodPicker';

const QUICK = [{ value: 1, label: "Aujourd'hui" }, { value: 7, label: '7 jours' }, { value: 30, label: '30 jours' }] as const;

export function Dashboard({ userId, business, access }: { userId: string; business: Business; access: Access }) {
  const router = useRouter();
  const services = useServices();
  const { dashboardPeriod: period, setDashboardPeriod: setPeriod } = useBusiness();
  const [picker, setPicker] = useState(false);
  const today = toDayKey(services.now());
  const query = useQuery(['dashboard', business.id, userId, period], () => services.reports.dashboard(business.id, userId, period));
  const { fontScale, width } = useWindowDimensions();
  const stacked = fontScale > 1.2 || width < 360;
  const custom = typeof period !== 'number';

  return <Screen backgroundColor={homeColors.background} footer={can(access, 'submitReport') ? <Button label="Faire le bilan du jour" onPress={() => router.push('/report/new')} style={{ backgroundColor: homeColors.text }} /> : undefined}>
    <View style={styles.periods}>
      {QUICK.map(p => <Pressable key={p.value} accessibilityRole="tab" accessibilityLabel={p.label} accessibilityState={{ selected: period === p.value }} onPress={() => setPeriod(p.value)} style={[styles.tab, period === p.value && styles.active]}>
        <Text variant="caption" style={{ color: period === p.value ? homeColors.text : homeColors.secondary, fontWeight: period === p.value ? '700' : '400' }}>{p.label}</Text>
      </Pressable>)}
      <Pressable accessibilityRole="tab" accessibilityLabel="Personnalisée" accessibilityState={{ selected: custom }} onPress={() => setPicker(true)} style={[styles.tab, custom && styles.active]}><Text variant="caption" style={{ color: custom ? homeColors.text : homeColors.secondary }}>Personnalisée</Text></Pressable>
    </View>
    {custom ? <Text variant="caption" style={{ color: homeColors.secondary }}>{formatDayFull(period.from)} → {formatDayFull(period.to)} · inclus</Text> : null}
    <AsyncBoundary query={query}>{data => {
      if (data.isFirstUse || (period !== 1 && data.period.reportCount === 0)) return <EmptyState icon="document-text-outline" title={data.isFirstUse ? 'Pas encore de bilan' : 'Aucun bilan sur cette période'} message={data.isFirstUse ? "Votre équipe n'a pas encore fait son premier bilan." : 'Choisissez une autre période pour consulter les données disponibles.'} />;
      const one = period === 1;
      const h = data.headline;
      const totals = one ? data.headlineTotals! : data.period;
      const title = one && h.day ? `Chiffre d'affaires — ${formatDayRelative(h.day, today)}` : "Chiffre d'affaires sur la période";
      return <>
        <View style={{ gap: 12 }}>
          <Text variant="label" style={styles.sectionLabel}>{title}</Text>
          <View style={{ flexDirection: stacked ? 'column' : 'row', gap: 12, alignItems: stacked ? 'flex-start' : 'center' }}>
            <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', gap: 8 }}>
              <Text style={styles.headline}>{groupThousands(totals.revenue)}</Text><Text style={{ fontSize: 18, color: homeColors.secondary }}>FCFA</Text>
            </View>
            {data.trend.length >= 2 ? <Trend points={data.trend.map(p => ({ day: p.day, value: p.revenue }))} /> : null}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
            <View style={{ borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4, backgroundColor: data.deltaPercent === null ? homeColors.roleTint : data.deltaPercent < 0 ? homeColors.negativeTint : homeColors.positiveTint }}>
              <Text variant="caption" style={{ fontWeight: '600', color: data.deltaPercent === null ? homeColors.roleText : data.deltaPercent < 0 ? homeColors.negative : colors.primary }}>{data.deltaPercent === null ? 'Non comparable' : `${data.deltaPercent > 0 ? '↑ +' : data.deltaPercent < 0 ? '↓ ' : ''}${data.deltaPercent} %`}</Text>
            </View>
            <Text variant="caption" style={{ color: homeColors.secondary }}>{one ? 'vs la veille' : 'vs la période précédente de même durée'}</Text>
          </View>
          <Text variant="caption" style={{ color: homeColors.secondary }}>{one && h.day ? `${h.kind === 'last' ? 'Dernier bilan reçu : ' : ''}${formatDayFull(h.day)}` : `${data.period.reportCount} bilans reçus · jours renseignés uniquement`}</Text>
          {one && h.awaitingToday ? <Badge label="En attente du bilan" /> : null}
          {one && h.day ? <Pressable accessibilityRole="button" accessibilityLabel="Voir le détail" onPress={() => router.push({ pathname: '/day/[day]', params: { day: h.day! } })} style={{ alignSelf: 'flex-start', minHeight: MIN_TOUCH, justifyContent: 'center' }}><Text variant="label" style={{ color: homeColors.text }}>Voir le détail  →</Text></Pressable> : null}
        </View>
        <View style={[styles.stats, { flexDirection: stacked ? 'column' : 'row' }]}>
          <View style={{ flex: 1, gap: 8 }}><Text variant="caption" style={styles.sectionLabel}>Caisse théorique</Text><Text style={styles.statAmount}>{data.cash ? groupThousands(data.cash.closing) : 'À déclarer'}</Text><Text variant="caption" style={{ color: homeColors.secondary }}>{one ? 'FCFA · solde courant' : `FCFA · au ${formatDayFull(data.range.to)}`}</Text></View>
          <View style={{ width: stacked ? '100%' : 1, height: stacked ? 1 : undefined, backgroundColor: homeColors.separator }} />
          <View style={{ flex: 1, gap: 8 }}><Text variant="caption" style={styles.sectionLabel}>Dépenses</Text><Text style={styles.statAmount}>{groupThousands(totals.expenses)}</Text><Text variant="caption" style={{ color: homeColors.secondary }}>FCFA</Text></View>
        </View>
        <Text variant="heading" style={{ color: homeColors.text }}>{one ? 'Détail du jour' : 'Détail de la période'}</Text>
        <Detail label="Ajouts à la caisse" value={`${groupThousands(totals.cashIn)} FCFA`} />
        {one && data.cash ? <Detail label="Caisse de la veille" value={`${groupThousands(data.cash.opening)} FCFA`} /> : null}
        <Detail label="Bilans reçus" value={String(totals.reportCount)} />
        {one ? data.headlineContributors.map((c, i) => <Detail key={i} label="Contributeur" value={`${c.name} · ${formatTime(c.submittedAt)}`} />) : null}
        {one && data.cash && h.day !== today ? <Text variant="caption" style={{ color: homeColors.secondary }}>Le détail du CA concerne le dernier bilan ; la caisse reste le solde courant.</Text> : null}
      </>;
    }}</AsyncBoundary>
    {picker ? <PeriodPicker initial={periodRange(period, today)} today={today} onClose={() => setPicker(false)} onApply={range => { setPeriod(range); setPicker(false); }} /> : null}
  </Screen>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <Row style={{ justifyContent: 'space-between', flexWrap: 'wrap', paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: homeColors.separator }}><Text variant="caption" style={{ color: homeColors.secondary }}>{label}</Text><Text variant="label" style={{ color: homeColors.text }}>{value}</Text></Row>;
}

function Trend({ points }: { points: { day: string; value: number }[] }) {
  const min = Math.min(...points.map(p => p.value));
  const max = Math.max(...points.map(p => p.value));
  const first = Date.parse(points[0].day);
  const duration = Date.parse(points[points.length - 1].day) - first;
  const positions = points.map(p => `${4 + 92 * (Date.parse(p.day) - first) / (duration || 1)},${44 - 36 * (p.value - min) / (max - min || 1)}`).join(' ');
  return <View accessible accessibilityRole="image" accessibilityLabel={`Tendance du chiffre d'affaires, jours avec bilan uniquement : ${points.map(p => `${formatDayFull(p.day)}, ${p.value} FCFA`).join(' ; ')}`}><Svg width={100} height={52} viewBox="0 0 100 52"><Polyline points={positions} fill="none" stroke={colors.primary} strokeWidth={2} /></Svg></View>;
}

const styles = StyleSheet.create({
  periods: { flexDirection: 'row', flexWrap: 'wrap', borderBottomWidth: 1, borderBottomColor: homeColors.separator, gap: 8 },
  tab: { minHeight: MIN_TOUCH, paddingHorizontal: 4, justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  active: { borderBottomColor: colors.primary },
  sectionLabel: { color: homeColors.secondary, textTransform: 'uppercase', letterSpacing: 1, fontSize: 11 },
  headline: { fontSize: 48, lineHeight: 58, fontWeight: '700', color: homeColors.text },
  statAmount: { fontSize: 24, lineHeight: 32, fontWeight: '700', color: homeColors.text },
  stats: { gap: 16, paddingVertical: 20, borderTopWidth: 1, borderBottomWidth: 1, borderColor: homeColors.separator },
});

