import { useCallback, useEffect, useState } from 'react';
import { ApiError, createClient } from '@gobilan/ui';
const api = createClient();
const errorText = (e: unknown) => e instanceof ApiError ? e.message : 'Une erreur est survenue.';
export function SubscriptionsView() {
  const [rows, setRows] = useState<{ id: string; name: string; ownerName: string; country: string; status: string; trialEndsAt: string | null; paidUntil: string | null }[]>([]);
  const [page, setPage] = useState(0);
  const [error, setError] = useState('');
  useEffect(() => { let current = true; void api<{ subscriptions: typeof rows }>(`/v1/admin/subscriptions?limit=50&offset=${page * 50}`).then(r => { if (current) { setRows(r.subscriptions); setError(''); } }, e => { if (current) { setRows([]); setError(errorText(e)); } }); return () => { current = false; }; }, [page]);
  return <section className="card stack"><h2 className="h2">Abonnements par business</h2>
    {error && <p role="alert">{error}</p>}
    <div className="scroll"><table><thead><tr><th>Business</th><th>Propriétaire</th><th>Pays</th><th>Statut</th><th>Fin d’essai</th><th>Payé jusqu’au</th></tr></thead><tbody>{rows.map(r => <tr key={r.id}><td>{r.name}</td><td>{r.ownerName}</td><td>{r.country}</td><td>{r.status}</td><td>{r.trialEndsAt?.slice(0, 10) ?? '—'}</td><td>{r.paidUntil?.slice(0, 10) ?? '—'}</td></tr>)}</tbody></table></div>
    <div className="row"><button className="gb-btn gb-btn--ghost" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Précédent</button><span>Page {page + 1}</span><button className="gb-btn gb-btn--ghost" disabled={rows.length < 50} onClick={() => setPage(p => p + 1)}>Suivant</button></div>
  </section>;
}
export function ReferralExclusions() {
  const [rows, setRows] = useState<{ id: string; businessName: string; partnerName: string; excludedReason: string | null }[]>([]);
  const [id, setId] = useState(''); const [reason, setReason] = useState(''); const [message, setMessage] = useState('');
  const load = useCallback(() => { void api<{ referrals: typeof rows }>('/v1/admin/referrals').then(r => setRows(r.referrals), e => setMessage(errorText(e))); }, []);
  useEffect(load, [load]);
  return <section className="card stack"><h2 className="h2">Exclure un parrainage</h2>
    <p>Auto-parrainage, famille ou commerce du partenaire : les commissions concernées sont annulées par écriture inverse. Les versements déjà réalisés restent dans le journal.</p>
    <label>Parrainage<select className="gb-input" value={id} onChange={e => setId(e.target.value)}><option value="">Choisir un business…</option>{rows.filter(r => !r.excludedReason).map(r => <option key={r.id} value={r.id}>{r.businessName} — {r.partnerName}</option>)}</select></label>
    <label>Motif d’exclusion<input className="gb-input" value={reason} onChange={e => setReason(e.target.value)} /></label>
    <button className="gb-btn" disabled={!id || reason.trim().length < 3} onClick={() => void api('/v1/admin/referrals/exclude', { method: 'POST', body: { referralId: id, reason } }).then(() => { setMessage('Parrainage exclu ; correction enregistrée dans le journal.'); setId(''); setReason(''); load(); }, e => setMessage(errorText(e)))}>Exclure et journaliser</button>
    {message && <p role="status">{message}</p>}
  </section>;
}
export function PayoutCorrection() {
  const [partners, setPartners] = useState<{ id: string; name: string; email: string }[]>([]);
  const [id, setId] = useState(''); const [phone, setPhone] = useState(''); const [name, setName] = useState(''); const [network, setNetwork] = useState('MTN'); const [message, setMessage] = useState('');
  useEffect(() => { void api<{ partners: typeof partners }>('/v1/admin/partners').then(r => setPartners(r.partners), e => setMessage(errorText(e))); }, []);
  return <section className="card stack"><h2 className="h2">Corriger les coordonnées de versement</h2>
    <label>Partenaire<select className="gb-input" value={id} onChange={e => { setId(e.target.value); setPhone(''); setName(''); }}><option value="">Choisir un partenaire…</option>{partners.map(p => <option key={p.id} value={p.id}>{p.name} — {p.email}</option>)}</select></label>
    <label>Numéro de versement<input className="gb-input" type="tel" value={phone} onChange={e => setPhone(e.target.value)} /></label>
    <label>Réseau de versement<select className="gb-input" value={network} onChange={e => setNetwork(e.target.value)}>{['MTN', 'Moov', 'Orange', 'Wave', 'TMoney'].map(n => <option key={n}>{n}</option>)}</select></label>
    <label>Nom du compte Mobile Money<input className="gb-input" value={name} onChange={e => setName(e.target.value)} /></label>
    <button className="gb-btn" disabled={!id || !phone || name.trim().length < 2} onClick={() => void api(`/v1/admin/partners/${id}/payout-block`, { method: 'PUT', body: { phone, network, displayName: name } }).then(() => { setMessage('Coordonnées corrigées ; ancienne et nouvelle valeurs chiffrées dans le journal.'); setPhone(''); setName(''); }, e => setMessage(errorText(e)))}>Enregistrer la correction</button>
    {message && <p role="status">{message}</p>}
  </section>;
}
