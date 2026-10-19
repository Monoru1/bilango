import { currentVersion, emptyContent, formatFcfa, parseAmount, sumLines, type ReportAmount, type ReportContent } from '@gobilan/domain';
import { useState } from 'react';
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { useStore } from '../app/useStore';
import type { BizCtx } from './BusinessShell';

type Key = 'revenue' | 'expenses' | 'cashIn';
const LABELS: Record<Key, string> = { revenue: 'Chiffre d’affaires', expenses: 'Dépenses du jour', cashIn: 'Ajout à la caisse' };
const HELP: Record<Key, string> = { revenue: 'Le total des ventes du jour.', expenses: 'Le total des dépenses du jour.', cashIn: 'Argent déposé dans la caisse hors vente.' };

interface Line { id: string; label: string; amount: string }
interface FieldState { total: string; lines: Line[]; detail: boolean }
const blank = (): FieldState => ({ total: '', lines: [], detail: false });
const fromAmount = (a: ReportAmount): FieldState => ({ total: a.total ? String(a.total) : '', lines: a.lines.map((l) => ({ id: l.id, label: l.label, amount: String(l.amount) })), detail: a.lines.length > 0 });

/** Saisie du bilan quotidien (§6.2) — création, ou modification quand `:reportId` est présent (§6.6). */
export function ReportForm() {
  const s = useStore();
  const { business: b, base } = useOutletContext<BizCtx>();
  const { reportId } = useParams();
  const nav = useNavigate();
  const editing = reportId ? s.state.reports.find((r) => r.id === reportId && r.businessId === b.id) : undefined;
  const initial = editing ? currentVersion(editing).content : emptyContent();
  const [f, setF] = useState<Record<Key, FieldState>>({ revenue: fromAmount(initial.revenue), expenses: fromAmount(initial.expenses), cashIn: fromAmount(initial.cashIn) });
  const [qty, setQty] = useState<Record<string, string>>(() => Object.fromEntries(initial.stockSales.map((x) => [x.itemId, String(x.quantity)])));
  const [note, setNote] = useState(initial.note);
  const [opening, setOpening] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const stock = b.stockEnabled ? s.stockLevelsOf(b.id) : [];
  const needsOpening = !editing && b.openingCash === null;

  const toAmount = (k: Key): ReportAmount => {
    const st = f[k];
    if (st.detail && st.lines.length > 0) {
      const lines = st.lines.map((l) => ({ id: l.id, label: l.label.trim(), amount: parseAmount(l.amount) ?? 0 }));
      return { total: sumLines(lines), lines };
    }
    return { total: parseAmount(st.total) ?? 0, lines: [] };
  };
  const build = (): ReportContent => ({
    revenue: toAmount('revenue'), expenses: toAmount('expenses'), cashIn: toAmount('cashIn'),
    stockSales: Object.entries(qty).map(([itemId, q]) => ({ itemId, quantity: Number.parseInt(q || '0', 10) || 0 })), note,
  });

  const submit = () => {
    const content = build();
    const r = editing ? s.editReport(editing.id, content) : s.submitReport(b.id, content, needsOpening ? parseAmount(opening) : null);
    if (!r.ok) return setErr(r.error);
    nav(base, { replace: true, state: { sent: true } });
  };
  const set = (k: Key, patch: Partial<FieldState>) => setF((p) => ({ ...p, [k]: { ...p[k], ...patch } }));
  const total = toAmount('revenue').total;

  return (
    <main className="pad stack" style={{ flex: 1, paddingTop: 16, paddingBottom: 24, gap: 18 }}>
      <Link to={base} className="link" style={{ alignSelf: 'flex-start' }}>← Retour</Link>
      <h1 className="h1">{editing ? 'Modifier le bilan' : 'Bilan du jour'}</h1>
      {needsOpening && (
        <div className="field">
          <label htmlFor="opening">Caisse de départ (à déclarer une seule fois)</label>
          <input id="opening" className="gb-input" inputMode="numeric" value={opening} onChange={(e) => setOpening(e.target.value)} placeholder="Montant compté dans la caisse" />
        </div>
      )}
      {(['revenue', 'expenses', 'cashIn'] as const).map((k) => (
        <section key={k} className="field">
          <label htmlFor={`f-${k}`}>{LABELS[k]} <span className="faint">— {HELP[k]}</span></label>
          {f[k].detail ? (
            <div className="stack" style={{ gap: 8 }}>
              {f[k].lines.map((l, i) => (
                <div key={l.id} className="phone">
                  <input className="gb-input" placeholder="Nom" aria-label={`Nom ligne ${i + 1}`} value={l.label} onChange={(e) => set(k, { lines: f[k].lines.map((x) => (x.id === l.id ? { ...x, label: e.target.value } : x)) })} />
                  <input className="gb-input" style={{ maxWidth: 130 }} inputMode="numeric" placeholder="Montant" aria-label={`Montant ligne ${i + 1}`} value={l.amount} onChange={(e) => set(k, { lines: f[k].lines.map((x) => (x.id === l.id ? { ...x, amount: e.target.value } : x)) })} />
                </div>
              ))}
              <button className="link" onClick={() => set(k, { lines: [...f[k].lines, { id: `l${Date.now()}${f[k].lines.length}`, label: '', amount: '' }] })}>+ Ajouter une ligne</button>
              <span className="muted" style={{ fontSize: 14 }}>Total : {formatFcfa(toAmount(k).total)}</span>
            </div>
          ) : (
            <>
              <input id={`f-${k}`} className="gb-input" inputMode="numeric" placeholder="0" value={f[k].total} onChange={(e) => set(k, { total: e.target.value })} />
              {k !== 'cashIn' && <button className="link" style={{ alignSelf: 'flex-start' }} onClick={() => set(k, { detail: true, lines: f[k].lines.length ? f[k].lines : [{ id: `l${Date.now()}`, label: '', amount: '' }] })}>Détailler (optionnel)</button>}
            </>
          )}
        </section>
      ))}
      {stock.length > 0 && (
        <section className="stack" style={{ gap: 8 }}>
          <span className="gb-label">Stock — quantités vendues</span>
          {stock.map((lv) => (
            <div key={lv.item.id} className="row">
              <span>{lv.item.name} <span className="faint">(reste {lv.remaining})</span></span>
              <input className="gb-input" style={{ maxWidth: 100 }} inputMode="numeric" aria-label={`Quantité vendue ${lv.item.name}`} value={qty[lv.item.id] ?? ''} onChange={(e) => setQty({ ...qty, [lv.item.id]: e.target.value.replace(/\D/g, '') })} />
            </div>
          ))}
        </section>
      )}
      <div className="field">
        <label htmlFor="note">Note du jour (facultatif)</label>
        <textarea id="note" className="gb-input" style={{ minHeight: 80, padding: 14 }} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      {err && <p className="gb-error" role="alert" style={{ margin: 0 }}>{err}</p>}
      <button className="gb-btn" onClick={submit}>{editing ? 'Enregistrer la modification' : `Envoyer le bilan${total ? ` · ${formatFcfa(total)}` : ''}`}</button>
    </main>
  );
}
