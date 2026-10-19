import { can } from '@gobilan/domain';
import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useStore } from '../app/useStore';
import type { BizCtx } from './BusinessShell';

export function StockScreen() {
  const s = useStore();
  const { business: b } = useOutletContext<BizCtx>();
  const [name, setName] = useState('');
  const [qty, setQty] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const user = s.user;
  const a = user && s.accessOf(user.id, b.id);
  if (!a || !can(a, 'viewStock') || !b.stockEnabled) return <main className="pad"><p className="muted" style={{ paddingTop: 22 }}>Le module Stock n’est pas activé.</p></main>;
  const levels = s.stockLevelsOf(b.id);
  return (
    <main className="pad stack" style={{ flex: 1, paddingTop: 22, gap: 18 }}>
      <h1 className="h1">Stock</h1>
      {levels.length === 0 ? <p className="muted">Aucun article pour le moment.</p> : (
        <ul className="list">{levels.map((l) => <li key={l.item.id}><span className="k">{l.item.name}</span><span className="v">{l.remaining} <span className="faint">/ {l.item.initialQuantity}</span></span></li>)}</ul>
      )}
      {can(a, 'manageStock') && (
        <section className="stack" style={{ gap: 10 }}>
          <h2 className="h2">Ajouter un article</h2>
          <input className="gb-input" placeholder="Nom de l’article" value={name} onChange={(e) => setName(e.target.value)} aria-label="Nom de l’article" />
          <input className="gb-input" inputMode="numeric" placeholder="Quantité de départ" value={qty} onChange={(e) => setQty(e.target.value.replace(/\D/g, ''))} aria-label="Quantité de départ" />
          {err && <p className="gb-error" role="alert" style={{ margin: 0 }}>{err}</p>}
          <button className="gb-btn" onClick={async () => { const r = await s.addStockItem(b.id, name, Number.parseInt(qty || '-1', 10)); if (!r.ok) return setErr(r.error); setErr(null); setName(''); setQty(''); }}>Ajouter</button>
        </section>
      )}
    </main>
  );
}
