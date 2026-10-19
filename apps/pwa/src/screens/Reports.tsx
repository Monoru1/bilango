import { can, canEditReport, canViewReport, currentVersion, formatFcfa, isEdited, originalVersion, totalsOfDay, type Report } from '@gobilan/domain';
import { Money } from '@gobilan/ui';
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { useStore } from '../app/useStore';
import { dayLong, firstName, hhmm } from '../lib/format';
import { downloadReportPdf } from '../lib/pdf';
import type { BizCtx } from './BusinessShell';

/** Liste des jours : « Bilans » (propriétaire, tous) ou « Historique » (employé : ses propres bilans, §6.5). */
export function ReportsList() {
  const s = useStore();
  const { business: b, base, isOwner } = useOutletContext<BizCtx>();
  const user = s.user;
  if (!user) return null;
  const access = s.accessOf(user.id, b.id);
  if (!access) return null;
  const visible = s.reportsOf(b.id).filter((r) => canViewReport(access, r, user.id));
  const days = [...new Set(visible.map((r) => r.day))].sort().reverse();
  return (
    <main className="pad stack" style={{ flex: 1, paddingTop: 22 }}>
      <h1 className="h1">{isOwner || can(access, 'viewAllReports') ? 'Bilans' : 'Historique'}</h1>
      {days.length === 0 ? <p className="muted">Aucun bilan pour le moment.</p> : (
        <ul className="list">
          {days.map((d) => (
            <li key={d}>
              <Link to={`${base}/bilans/${d}`} className="k" style={{ textDecoration: 'none' }}>{dayLong(d)}</Link>
              <span className="v">{formatFcfa(visible.filter((r) => r.day === d).reduce((t, r) => t + currentVersion(r).content.revenue.total, 0))}</span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

/** Détail d'un jour : par contributeur, versions originale/modifiée, modification 24 h, PDF (§7.2, §6.6). */
export function DayDetail() {
  const s = useStore();
  const { business: b, base, isOwner } = useOutletContext<BizCtx>();
  const { day = '' } = useParams();
  const nav = useNavigate();
  const user = s.user;
  const off = s.offsetOf(b);
  if (!user) return null;
  const access = s.accessOf(user.id, b.id);
  if (!access) return null;
  const all = s.reportsOf(b.id);
  const list = all.filter((r) => r.day === day && canViewReport(access, r, user.id)).sort((a, c) => a.submittedAt.localeCompare(c.submittedAt));
  const t = totalsOfDay(list, b.id, day);
  const now = s.now();

  return (
    <main className="pad stack" style={{ flex: 1, paddingTop: 16, gap: 18 }}>
      <button className="link" style={{ alignSelf: 'flex-start' }} onClick={() => nav(-1)}>← Retour</button>
      <h1 className="h1">{dayLong(day)}</h1>
      <div><div className="gb-label">Chiffre d’affaires</div><div style={{ marginTop: 8 }}><Money value={t.revenue} /></div></div>
      {list.length === 0 && <p className="muted">Aucun bilan ce jour.</p>}
      {list.map((r) => <ReportCard key={r.id} r={r} off={off} editable={canEditReport(access, r, user.id, now)} base={base} showDetailNote={isOwner} />)}
      {list.length > 0 && (can(access, 'viewDashboard') || list.length > 0) && (
        <button className="gb-btn gb-btn--ghost" onClick={() => void downloadReportPdf(b, day, list, off)}>Télécharger le bilan</button>
      )}
    </main>
  );
}

function ReportCard({ r, off, editable, base, showDetailNote }: { r: Report; off: number; editable: boolean; base: string; showDetailNote: boolean }) {
  const c = currentVersion(r).content;
  const hasDetail = c.revenue.lines.length + c.expenses.lines.length > 0;
  return (
    <section className="stack" style={{ gap: 6, borderTop: '1px solid var(--sep)', paddingTop: 16 }}>
      <div className="row"><strong>{firstName(r.authorName)} · {hhmm(r.submittedAt, off)}</strong>{isEdited(r) && <span className="badge-wait">Modifié</span>}</div>
      <ul className="list">
        <li><span className="k">Chiffre d’affaires</span><span className="v">{formatFcfa(c.revenue.total)}</span></li>
        <li><span className="k">Dépenses</span><span className="v">{formatFcfa(c.expenses.total)}</span></li>
        <li><span className="k">Ajout à la caisse</span><span className="v">{formatFcfa(c.cashIn.total)}</span></li>
      </ul>
      {[...c.revenue.lines.map((l) => ({ ...l, kind: 'CA' })), ...c.expenses.lines.map((l) => ({ ...l, kind: 'Dép.' }))].map((l) => (
        <div key={l.id} className="row muted" style={{ fontSize: 14 }}><span>{l.kind} · {l.label}</span><span>{formatFcfa(l.amount)}</span></div>
      ))}
      {!hasDetail && showDetailNote && <p className="faint" style={{ margin: 0, fontSize: 14 }}>Votre manager n’a pas détaillé le bilan aujourd’hui.</p>}
      {c.note && <p className="muted" style={{ margin: 0, fontSize: 14 }}>Note : {c.note}</p>}
      {isEdited(r) && (
        <details style={{ fontSize: 14 }}>
          <summary className="muted">Voir la version originale</summary>
          <div className="muted" style={{ marginTop: 6 }}>
            Original ({hhmm(originalVersion(r).savedAt, off)}) : CA {formatFcfa(originalVersion(r).content.revenue.total)}, dépenses {formatFcfa(originalVersion(r).content.expenses.total)}.<br />
            Modifié ({hhmm(currentVersion(r).savedAt, off)}) : CA {formatFcfa(c.revenue.total)}, dépenses {formatFcfa(c.expenses.total)}.
          </div>
        </details>
      )}
      {editable && <Link className="link" to={`${base}/bilan/${r.id}`}>Modifier (24 h maximum)</Link>}
    </section>
  );
}
