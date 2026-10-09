import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';

import { formatDayFull, formatTime, toDayKey } from '@/domain/dates';
import { formatFcfa, groupThousands } from '@/domain/money';
import { editWindowEnd, canEditReport, can, roleLabel } from '@/domain/permissions';
import { currentVersion } from '@/domain/reports';
import type { Access, Business } from '@/domain/types';
import { editHint } from '@/features/reports/format';
import { useBusiness } from '@/state/business';
import { useDeadlineClock, useQuery, useServices } from '@/state/services';
import { AsyncBoundary, Banner } from '@/ui/feedback';
import { Button, Row, Screen, Text } from '@/ui/primitives';
import { homeColors, MIN_TOUCH } from '@/ui/theme';

export function ManagerHome({ userId, business, access }: { userId: string; business: Business; access: Access }) {
  const router = useRouter();
  const services = useServices();
  const { user } = useBusiness();
  const query = useQuery(['managerHome', business.id, userId], () => services.reports.managerHome(business.id, userId));
  const history = useQuery(['managerHistory', business.id, userId], () => services.reports.list(business.id, userId, { mineOnly: true }));
  const now = useDeadlineClock(query.data?.myReportToday ? [editWindowEnd(query.data.myReportToday)] : []);
  const today = toDayKey(now);
  const canSubmit = can(access, 'submitReport');

  return <Screen backgroundColor={homeColors.background}>
    <View style={{ gap: 8, marginVertical: 8 }}>
      <Text variant="title" style={{ color: homeColors.text }}>Bonjour, {user.name.split(' ')[0]}</Text>
      <View style={{ alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 4, backgroundColor: homeColors.roleTint }}><Text variant="caption" style={{ color: homeColors.roleText, fontWeight: '600' }}>{roleLabel(access)}</Text></View>
    </View>
    <AsyncBoundary query={query}>{home => {
      const mine = home.myReportToday;
      const editable = mine ? canEditReport(access, mine, userId, now) : false;
      const label = mine ? editable ? 'Modifier mon bilan' : 'Voir mon bilan' : 'Faire le bilan du jour';
      return <>
        {canSubmit || mine ? <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityHint={mine ? 'Ouvre votre bilan du jour' : 'Ouvre le formulaire de saisie du bilan'} onPress={() => mine ? router.push({ pathname: editable ? '/report/[id]/edit' : '/report/[id]', params: { id: mine.id } }) : router.push('/report/new')}
          style={({ pressed }) => ({ backgroundColor: homeColors.text, borderRadius: 16, padding: 24, gap: 12, minHeight: 140, opacity: pressed ? 0.9 : 1 })}>
          <Text variant="caption" style={{ color: '#D0D3D1', textTransform: 'uppercase', letterSpacing: 1 }}>Aujourd'hui · {formatDayFull(today)}</Text>
          <Row style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}><Text variant="title" tone="onPrimary">{label}</Text><Text tone="onPrimary">→</Text></Row>
          <Text variant="caption" style={{ color: '#D0D3D1' }}>{mine ? `Bilan du jour envoyé à ${formatTime(mine.submittedAt)}` : 'Pas encore envoyé'}</Text>
        </Pressable> : null}
        {mine && editable ? <View style={{ gap: 8 }}><Text variant="caption" style={{ color: homeColors.secondary }}>{editHint(mine, now)}</Text><Button label="Voir mon bilan" variant="ghost" onPress={() => router.push({ pathname: '/report/[id]', params: { id: mine.id } })} /></View> : null}
        {home.openingCashMissing && canSubmit ? <Banner>Comptez la caisse : le montant de départ sera demandé une seule fois, avec votre premier bilan.</Banner> : null}
        <View style={{ gap: 8, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: homeColors.separator }}>
          <Text variant="caption" style={{ color: homeColors.secondary, textTransform: 'uppercase', letterSpacing: 1 }}>Caisse disponible</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', gap: 8 }}><Text style={{ fontSize: 40, lineHeight: 50, fontWeight: '700', color: homeColors.text }}>{home.cash ? groupThousands(home.cash.closing) : 'À déclarer'}</Text>{home.cash ? <Text style={{ color: homeColors.secondary }}>FCFA</Text> : null}</View>
          <Text variant="caption" style={{ color: homeColors.secondary }}>Solde théorique pour vos contrôles</Text>
        </View>
      </>;
    }}</AsyncBoundary>
    <Row style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}><Text variant="heading" style={{ color: homeColors.text }}>Mes bilans précédents</Text><Pressable accessibilityRole="button" accessibilityLabel="Voir mes bilans précédents" onPress={() => router.navigate('/reports')} style={{ minHeight: MIN_TOUCH, justifyContent: 'center' }}><Text variant="caption" style={{ color: homeColors.secondary }}>Tout voir  →</Text></Pressable></Row>
    <AsyncBoundary query={history}>{reports => {
      const previous = reports.filter(r => r.day < today).slice(0, 3);
      return previous.length ? previous.map(r => <Pressable key={r.id} accessibilityRole="button" accessibilityLabel={`Bilan du ${formatDayFull(r.day)}, ${formatFcfa(currentVersion(r).content.revenue.total)}`} onPress={() => router.push({ pathname: '/report/[id]', params: { id: r.id } })} style={{ minHeight: MIN_TOUCH, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: homeColors.separator }}>
        <Row style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}><Text variant="caption" style={{ color: homeColors.secondary }}>{formatDayFull(r.day)}</Text><Text variant="label" style={{ color: homeColors.text }}>{formatFcfa(currentVersion(r).content.revenue.total)}</Text></Row>
      </Pressable>) : <Text variant="caption" style={{ color: homeColors.secondary }}>Aucun bilan précédent.</Text>;
    }}</AsyncBoundary>
    <Text variant="caption" style={{ color: homeColors.secondary }}>Rappel prévu à {business.reminderTime.replace(':', 'h')}. Aucune notification envoyée dans cette démonstration.</Text>
  </Screen>;
}
