import {
  addDays, buildHeadline, can, currentVersion, eachDay, formatFcfa, roleLabel, subscriptionStatus,
  employeeBlockedMessage, theoreticalCash, totalsOfDay, totalsOfPeriod, type Report,
} from '@gobilan/domain';
import { amountParts, Money, Sparkline } from '@gobilan/ui';
import { useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { useStore } from '../app/useStore';
import { ArrowRight } from '../components/Icons';
import { cardDate, dayLong, firstName, hhmm, shortDate } from '../lib/format';
import type { BizCtx } from './BusinessShell';

type Period = 'today' | '7' | '30';

export function HomeRouter() {
  const ctx = useOutletContext<BizCtx>();
  return ctx.isOwner ? <OwnerHome /> : <ManagerHome />;
}

/** Tableau de bord propriétaire (CDC §7.1, annexe B.1). Jamais un écran à zéro. */
export function OwnerHome() {
  const s = useStore();
  const { business: b, base } = useOutletContext<BizCtx>();
  const [period, setPeriod] = useState<Period>('today');
  const reports = s.reportsOf(b.id);
  const off = s.offsetOf(b);
  const today = s.todayOf(b);
  const head = buildHeadline(reports, b.id, today);

  if (head.kind === 'none') {
    return (
      <main className="pad stack" style={{ flex: 1, paddingTop: 40, gap: 16 }}>
        <h1 className="h2">Aucun bilan pour le moment</h1>
        <p className="muted" style={{ margin: 0 }}>Ton manager n’a pas encore fait son premier bilan. Dès qu’il le fera, tu verras tout apparaître ici.</p>
        <span className="badge-wait" style={{ alignSelf: 'flex-start' }}>En attente du bilan</span>
        <div style={{ marginTop: 'auto', paddingBottom: 16 }}><Link className="gb-btn" to={`${base}/bilan`} style={{ textDecoration: 'none' }}>Faire le bilan du jour</Link></div>
      </main>
    );
  }

  const endDay = head.day ?? today;
  const days = period === 'today' ? 1 : Number(period);
  const cur = totalsOfPeriod(reports, b.id, endDay, days);
  const prev = totalsOfPeriod(reports, b.id, addDays(endDay, -days), days);
  const revenue = cur.revenue;
  const deltaPct = period === 'today' ? head.deltaPercent : prev.reportCount > 0 && prev.revenue > 0 ? Math.round(((cur.revenue - prev.revenue) / prev.revenue) * 100) : null;
  const spark = eachDay(addDays(endDay, -Math.max(days, 7) + 1), endDay).map((d) => totalsOfDay(reports, b.id, d).revenue);
  const cash = theoreticalCash(b, reports, endDay);
  const dayReports = reports.filter((r) => r.day === endDay).sort((a, c) => a.submittedAt.localeCompare(c.submittedAt));
  const last: Report | undefined = dayReports[dayReports.length - 1];
  const vs = period === 'today' ? `vs hier · ${shortDate(endDay)}` : `vs ${days} jours précédents`;
  const labelPeriod = head.kind === 'last' && period === 'today' ? `Dernier bilan · ${dayLong(endDay)}` : null;

  return (
    <>
      <div className="tabs" role="tablist" aria-label="Période">
        {([['today', 'Aujourd’hui'], ['7', '7 jours'], ['30', '30 jours']] as const).map(([k, label]) => (
          <button key={k} role="tab" className="tab" aria-selected={period === k} onClick={() => setPeriod(k)}>{label}</button>
        ))}
      </div>
      <main style={{ flex: 1 }}>
        <section className="section" style={{ borderBottom: 0 }}>
          <div className="row" style={{ alignItems: 'flex-start' }}>
            <div>
              <div className="gb-label">Chiffre d’affaires</div>
              <div style={{ marginTop: 12 }}><Money value={revenue} /></div>
            </div>
            <Sparkline values={spark} />
          </div>
          <div className="row" style={{ justifyContent: 'flex-start', marginTop: 14, gap: 12, flexWrap: 'wrap' }}>
            {deltaPct !== null && (
              <span className={`gb-pill ${deltaPct < 0 ? 'gb-pill--neg' : 'gb-pill--pos'}`}>{deltaPct < 0 ? '↓' : '↑'} {Math.abs(deltaPct)}%</span>
            )}
            {deltaPct !== null && <span className="muted" style={{ fontSize: 14 }}>{vs}</span>}
            {head.awaitingToday && period === 'today' && <span className="badge-wait">En attente du bilan</span>}
          </div>
          {labelPeriod && <p className="faint" style={{ margin: '10px 0 0', fontSize: 13 }}>{labelPeriod}</p>}
          <Link to={`${base}/bilans/${endDay}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 14, marginTop: 20, fontWeight: 600, textDecoration: 'none' }}>Voir le détail <span className="faint"><ArrowRight /></span></Link>
        </section>
        <hr className="gb-sep" style={{ margin: '0 24px' }} />
        <div className="kv2" style={{ borderBottom: '1px solid var(--sep)' }}>
          <div className="cell"><div className="gb-label">Caisse théorique</div><div className="gb-amount gb-amount--md" style={{ marginTop: 8 }}>{cash ? amountParts(cash.closing).number : '—'}</div></div>
          <div className="vsep" />
          <div className="cell"><div className="gb-label">Dépenses</div><div className="gb-amount gb-amount--md" style={{ marginTop: 8 }}>{amountParts(cur.expenses).number}</div></div>
        </div>
        <section className="section" style={{ borderBottom: 0 }}>
          <h2 className="h2" style={{ marginBottom: 6 }}>Détail du jour</h2>
          <ul className="list">
            <li><span className="k">Ajouts à la caisse</span><span className="v">{formatFcfa(totalsOfDay(reports, b.id, endDay).cashIn)}</span></li>
            <li><span className="k">Caisse de la veille</span><span className="v">{cash ? formatFcfa(cash.opening) : '—'}</span></li>
            <li><span className="k">Contributeur</span><span className="v">{last ? `${firstName(last.authorName)} · ${hhmm(last.submittedAt, off)}` : '—'}</span></li>
          </ul>
        </section>
      </main>
      <div className="pad" style={{ paddingBottom: 16 }}><Link className="gb-btn" to={`${base}/bilan`} style={{ textDecoration: 'none' }}>Faire le bilan du jour</Link></div>
    </>
  );
}

/** Accueil employé / manager (CDC §6.1, annexe B.2). */
export function ManagerHome() {
  const s = useStore();
  const { business: b, base } = useOutletContext<BizCtx>();
  const user = s.user;
  if (!user) return null;
  const access = s.accessOf(user.id, b.id);
  if (!access) return null;
  const today = s.todayOf(b);
  const off = s.offsetOf(b);
  const reports = s.reportsOf(b.id);
  const mine = reports.filter((r) => r.authorId === user.id).sort((a, c) => c.submittedAt.localeCompare(a.submittedAt));
  const sentToday = mine.find((r) => r.day === today);
  const cash = theoreticalCash(b, reports, today);
  const blocked = subscriptionStatus(s.subOf(b.id), s.now()) === 'blocked';
  const canSubmit = can(access, 'submitReport') && !blocked;
  const previous = mine.filter((r) => r.day !== today).slice(0, 3);

  return (
    <main className="pad stack" style={{ flex: 1, paddingTop: 22, gap: 18 }}>
      <div>
        <h1 className="h1">Bonjour, {firstName(user.name)}</h1>
        <span className="gb-chip" style={{ marginTop: 10 }}>{roleLabel(access)}</span>
      </div>
      {blocked ? (
        <div className="gb-error" role="alert" style={{ lineHeight: 1.5 }}>{employeeBlockedMessage(b.name)}</div>
      ) : canSubmit ? (
        <Link className="darkcard" to={`${base}/bilan`}>
          <div>
            <div className="kicker">Aujourd’hui · {cardDate(today)}</div>
            <div className="big">Faire le bilan du jour</div>
            <div className="small">{sentToday ? `Envoyé à ${hhmm(sentToday.submittedAt, off)} · en ajouter un autre` : 'Pas encore envoyé'}</div>
          </div>
          <ArrowRight />
        </Link>
      ) : null}
      {cash && (
        <div>
          <div className="gb-label">Caisse disponible</div>
          <div style={{ marginTop: 8 }}><Money value={cash.closing} /></div>
        </div>
      )}
      <hr className="gb-sep" />
      <div className="row"><h2 className="h2">Mes bilans précédents</h2><Link className="muted" style={{ textDecoration: 'none' }} to={`${base}/bilans`}>Tout voir →</Link></div>
      {previous.length === 0 ? <p className="muted" style={{ margin: 0 }}>Aucun bilan précédent.</p> : (
        <ul className="list">
          {previous.map((r) => (
            <li key={r.id}><Link to={`${base}/bilans/${r.day}`} className="k" style={{ textDecoration: 'none' }}>{dayLong(r.day)}</Link><span className="v">{formatFcfa(currentVersion(r).content.revenue.total)}</span></li>
          ))}
        </ul>
      )}
    </main>
  );
}
