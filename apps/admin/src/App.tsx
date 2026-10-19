import { PayoutCorrection, ReferralExclusions, SubscriptionsView } from './Operations';
import { formatFcfa, nextPayoutDate, toDayKey, type CountryCode } from '@gobilan/domain';
import { ApiError, createClient, Logo } from '@gobilan/ui';
import { useCallback, useEffect, useState, type ReactNode } from 'react';

const api = createClient(import.meta.env.VITE_API_URL ?? '');
const errText = (e: unknown) => (e instanceof ApiError ? e.message : 'Une erreur est survenue.');

interface PartnerRow { id: string; name: string; email: string; role: string; country: string; status: string; createdAt: string; referrals: number; earned: number }
interface CalRow { partnerId: string; name: string; email: string; role: string; gross: number; payable: boolean; carriedOver: number; network: string | null; hasPayoutBlock: boolean }
interface Audit { id: number; at: string; actor: string; action: string; target: string | null; newValue: unknown }
interface Stats { users: number; businesses: number; subscriptions: Record<string, number>; partners: number; confirmedRevenue: number; commissionsDue: number }

function Login({ onDone }: { onDone: (email: string) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [challenge, setChallenge] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const step1 = () => api<{ challengeId: string }>('/v1/admin/login', { method: 'POST', body: { email, password } }).then((r) => { setErr(null); setChallenge(r.challengeId); }, (e) => setErr(errText(e)));
  const step2 = () => api<{ admin: { email: string } }>('/v1/admin/login/verify', { method: 'POST', body: { challengeId: challenge, code } }).then((r) => onDone(r.admin.email), (e) => setErr(errText(e)));
  return (
    <div className="card narrow stack">
      <h1 className="h1">Administration</h1>
      {!challenge ? (
        <>
          <input className="gb-input" type="email" autoComplete="username" placeholder="E-mail" aria-label="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className="gb-input" type="password" autoComplete="current-password" placeholder="Mot de passe" aria-label="Mot de passe" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button className="gb-btn" disabled={!email || !password} onClick={() => void step1()}>Continuer</button>
        </>
      ) : (
        <>
          <p className="muted" style={{ margin: 0 }}>Un code à 6 chiffres vient d’être envoyé par e-mail. Il est demandé à chaque connexion.</p>
          <input className="gb-input" inputMode="numeric" maxLength={6} placeholder="Code à 6 chiffres" aria-label="Code à 6 chiffres" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
          <button className="gb-btn" disabled={code.length !== 6} onClick={() => void step2()}>Se connecter</button>
        </>
      )}
      {err && <p className="gb-error" role="alert" style={{ margin: 0 }}>{err}</p>}
    </div>
  );
}

function StatsView() {
  const [s, setS] = useState<Stats | null>(null);
  useEffect(() => { api<Stats>('/v1/admin/stats').then(setS, () => undefined); }, []);
  if (!s) return <p className="muted">Chargement…</p>;
  const Stat = ({ l, v }: { l: string; v: string | number }) => <div className="card"><div className="gb-label">{l}</div><div className="gb-amount gb-amount--md" style={{ marginTop: 8 }}>{v}</div></div>;
  return (
    <div className="grid3">
      <Stat l="Utilisateurs" v={s.users} /><Stat l="Business" v={s.businesses} /><Stat l="Partenaires actifs" v={s.partners} />
      <Stat l="Essai / Actif" v={`${s.subscriptions.trial ?? 0} / ${s.subscriptions.active ?? 0}`} /><Stat l="Grâce / Bloqués" v={`${s.subscriptions.grace ?? 0} / ${s.subscriptions.blocked ?? 0}`} />
      <Stat l="Encaissé (abonnements)" v={formatFcfa(s.confirmedRevenue)} /><Stat l="Commissions dues (brut)" v={formatFcfa(s.commissionsDue)} />
    </div>
  );
}

function PartnersView() {
  const [rows, setRows] = useState<PartnerRow[]>([]);
  const [country, setCountry] = useState('');
  const [f, setF] = useState({ name: '', email: '', country: 'CI' as CountryCode, role: 'manager' as 'manager' | 'influencer', promoCode: '' });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const load = useCallback(() => { api<{ partners: PartnerRow[] }>(`/v1/admin/partners${country ? `?country=${country}` : ''}`).then((r) => setRows(r.partners), () => undefined); }, [country]);
  useEffect(load, [load]);
  const setStatus = (id: string, status: string) => api(`/v1/admin/partners/${id}/status`, { method: 'POST', body: { status } }).then(load, (e) => setMsg({ ok: false, text: errText(e) }));
  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="card stack">
        <h2 className="h2">Créer un manager ou un influenceur</h2>
        <p className="muted" style={{ margin: 0, fontSize: 14 }}>Un agent n’est jamais créé ici : il est enregistré par son manager.</p>
        <div className="grid3">
          <input className="gb-input" placeholder="Nom" aria-label="Nom" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          <input className="gb-input" type="email" placeholder="E-mail" aria-label="E-mail" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
          <select className="gb-input" aria-label="Pays" value={f.country} onChange={(e) => setF({ ...f, country: e.target.value as CountryCode })}><option value="BJ">Bénin</option><option value="CI">Côte d’Ivoire</option><option value="TG">Togo</option></select>
          <select className="gb-input" aria-label="Rôle" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as 'manager' | 'influencer' })}><option value="manager">Manager</option><option value="influencer">Influenceur</option></select>
          {f.role === 'influencer' && <input className="gb-input" placeholder="Code promo" aria-label="Code promo" value={f.promoCode} onChange={(e) => setF({ ...f, promoCode: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })} />}
        </div>
        {msg && <p className={msg.ok ? 'demo-note' : 'gb-error'} role="status" style={{ margin: 0 }}>{msg.text}</p>}
        <button className="gb-btn btn-sm" style={{ alignSelf: 'flex-start' }} disabled={!f.name || !f.email || (f.role === 'influencer' && !f.promoCode)} onClick={() => api('/v1/admin/partners', { method: 'POST', body: { name: f.name, email: f.email, country: f.country, role: f.role, ...(f.role === 'influencer' ? { promoCode: f.promoCode } : {}) } }).then(() => { setMsg({ ok: true, text: 'Partenaire créé. Un e-mail d’activation (lien à usage unique) lui est envoyé.' }); load(); }, (e) => setMsg({ ok: false, text: errText(e) }))}>Créer</button>
      </div>
      <div className="card stack">
        <div className="row"><h2 className="h2">Partenaires</h2><select className="gb-input" style={{ width: 'auto', minHeight: 40 }} aria-label="Filtrer par pays" value={country} onChange={(e) => setCountry(e.target.value)}><option value="">Tous les pays</option><option value="BJ">Bénin</option><option value="CI">Côte d’Ivoire</option><option value="TG">Togo</option></select></div>
        <div className="scroll"><table><thead><tr><th>Nom</th><th>Rôle</th><th>Pays</th><th>Statut</th><th>Parrainages</th><th>Gains (brut)</th><th /></tr></thead>
          <tbody>{rows.map((p) => (
            <tr key={p.id}><td>{p.name}<br /><span className="faint">{p.email}</span></td><td>{p.role}</td><td>{p.country}</td><td>{p.status}</td><td>{p.referrals}</td><td>{formatFcfa(p.earned)}</td>
              <td>{p.status === 'active' ? <button className="link" onClick={() => void setStatus(p.id, 'suspended')}>Suspendre</button> : p.status === 'suspended' ? <button className="link" onClick={() => void setStatus(p.id, 'active')}>Réactiver</button> : null}</td></tr>
          ))}</tbody></table>{rows.length === 0 && <p className="muted">Aucun partenaire.</p>}</div>
      </div>
      <ReferralExclusions />
    </div>
  );
}

function PayoutsView() {
  const [cycle, setCycle] = useState(() => nextPayoutDate(toDayKey(Date.now(), 0)));
  const [rows, setRows] = useState<CalRow[]>([]);
  const [fees, setFees] = useState<Record<string, string>>({});
  const [ref, setRef] = useState<Record<string, string>>({});
  const [reveal, setReveal] = useState<Record<string, { phone: string; network: string | null; displayName: string }>>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [rev, setRev] = useState({ payoutId: '', reason: '' });
  const load = useCallback(() => { api<{ partners: CalRow[] }>(`/v1/admin/payouts/calendar?cycleDate=${cycle}`).then((r) => setRows(r.partners), (e) => setMsg({ ok: false, text: errText(e) })); }, [cycle]);
  useEffect(load, [load]);
  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="card stack">
        <div className="row"><h2 className="h2">Calendrier des versements</h2><input className="gb-input" style={{ width: 'auto', minHeight: 40 }} type="date" aria-label="Date du cycle" value={cycle} onChange={(e) => setCycle(e.target.value)} /></div>
        <p className="muted" style={{ margin: 0, fontSize: 14 }}>Versements les 1er et 15 de chaque mois, effectués manuellement hors application puis validés ici. Seuil : 2 000 FCFA ; en dessous, le solde est reporté. Le montant est recalculé par le serveur.</p>
        {msg && <p className={msg.ok ? 'demo-note' : 'gb-error'} role="status" style={{ margin: 0 }}>{msg.text}</p>}
        <div className="scroll"><table><thead><tr><th>Partenaire</th><th>Brut dû</th><th>État</th><th>Coordonnées</th><th>Frais / Référence</th><th /></tr></thead>
          <tbody>{rows.map((r) => {
            const rv = reveal[r.partnerId];
            return (
              <tr key={r.partnerId}>
                <td>{r.name}<br /><span className="faint">{r.role} · {r.email}</span></td><td>{formatFcfa(r.gross)}</td>
                <td>{r.payable ? <strong>À verser</strong> : `Reporté (${formatFcfa(r.carriedOver)})`}</td>
                <td>{rv ? <span>{rv.displayName}<br />{rv.phone} · {rv.network}</span> : r.hasPayoutBlock ? <button className="link" onClick={() => api<{ phone: string; network: string | null; displayName: string }>(`/v1/admin/partners/${r.partnerId}/payout-block`).then((b) => setReveal({ ...reveal, [r.partnerId]: b }), (e) => setMsg({ ok: false, text: errText(e) }))}>Afficher (journalisé)</button> : <span className="faint">Non renseignées</span>}</td>
                <td>{r.payable && <div className="stack" style={{ gap: 6 }}><input className="gb-input" style={{ minHeight: 36 }} inputMode="numeric" placeholder="Frais (FCFA)" aria-label={`Frais ${r.name}`} value={fees[r.partnerId] ?? ''} onChange={(e) => setFees({ ...fees, [r.partnerId]: e.target.value.replace(/\D/g, '') })} /><input className="gb-input" style={{ minHeight: 36 }} placeholder="Référence du virement" aria-label={`Référence ${r.name}`} value={ref[r.partnerId] ?? ''} onChange={(e) => setRef({ ...ref, [r.partnerId]: e.target.value })} /></div>}</td>
                <td>{r.payable && <button className="gb-btn btn-sm" onClick={() => { if (!window.confirm(`Confirmer que ${r.name} a bien été payé hors application ?`)) return; void api<{ payoutId: string; gross: number; fees: number; net: number }>('/v1/admin/payouts/validate', { method: 'POST', body: { partnerId: r.partnerId, cycleDate: cycle, fees: Number(fees[r.partnerId] || 0), ...(ref[r.partnerId] ? { transferReference: ref[r.partnerId] } : {}) } }).then((res) => { setMsg({ ok: true, text: `Versement validé : brut ${formatFcfa(res.gross)}, frais ${formatFcfa(res.fees)}, net ${formatFcfa(res.net)} (id ${res.payoutId}).` }); load(); }, (e) => setMsg({ ok: false, text: errText(e) })); }}>Valider</button>}</td>
              </tr>
            );
          })}</tbody></table>{rows.length === 0 && <p className="muted">Aucun solde dû à cette date.</p>}</div>
      </div>
      <div className="card stack">
        <h2 className="h2">Annuler un versement</h2>
        <p className="muted" style={{ margin: 0, fontSize: 14 }}>Virement échoué ou erreur : le versement est annulé (jamais modifié) ; les lignes sont reportées au cycle suivant et le partenaire est prévenu.</p>
        <input className="gb-input" placeholder="Identifiant du versement" aria-label="Identifiant du versement" value={rev.payoutId} onChange={(e) => setRev({ ...rev, payoutId: e.target.value.trim() })} />
        <input className="gb-input" placeholder="Motif" aria-label="Motif" value={rev.reason} onChange={(e) => setRev({ ...rev, reason: e.target.value })} />
        <button className="gb-btn gb-btn--ghost btn-sm" style={{ alignSelf: 'flex-start' }} disabled={!rev.payoutId || rev.reason.length < 3} onClick={() => api('/v1/admin/payouts/reverse', { method: 'POST', body: rev }).then(() => { setMsg({ ok: true, text: 'Versement annulé.' }); load(); }, (e) => setMsg({ ok: false, text: errText(e) }))}>Annuler le versement</button>
      </div>
      <PayoutCorrection />
    </div>
  );
}

function AuditView() {
  const [rows, setRows] = useState<Audit[]>([]);
  useEffect(() => { api<{ entries: Audit[] }>('/v1/admin/audit').then((r) => setRows(r.entries), () => undefined); }, []);
  return (
    <div className="card scroll"><h2 className="h2" style={{ marginBottom: 8 }}>Journal d’audit (lecture seule)</h2>
      <table><thead><tr><th>Date</th><th>Acteur</th><th>Action</th><th>Cible</th></tr></thead><tbody>{rows.map((r) => <tr key={r.id}><td>{r.at.replace('T', ' ').slice(0, 19)}</td><td>{r.actor}</td><td>{r.action}</td><td className="faint">{r.target}</td></tr>)}</tbody></table></div>
  );
}

function AllowlistView() {
  const [rows, setRows] = useState<{ email: string; active: boolean }[]>([]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [action, setAction] = useState<'add' | 'remove'>('add');
  const [requestId, setRequestId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const load = useCallback(() => { void api<{ admins: typeof rows }>('/v1/admin/allowlist').then(r => setRows(r.admins), e => setMessage(errText(e))); }, []);
  useEffect(load, [load]);
  return <section className="card stack">
    <h2 className="h2">Administrateurs autorisés</h2>
    <p>Conservez une adresse principale et une adresse de secours. Chaque modification exige un code envoyé à votre adresse.</p>
    <ul>{rows.map(r => <li key={r.email}>{r.email} — {r.active ? 'Actif' : 'Révoqué'}</li>)}</ul>
    {!requestId ? <>
      <label>Action<select className="gb-input" value={action} onChange={e => setAction(e.target.value as 'add' | 'remove')}><option value="add">Ajouter</option><option value="remove">Retirer</option></select></label>
      <label>Adresse administrateur<input className="gb-input" type="email" value={email} onChange={e => setEmail(e.target.value)} /></label>
      {action === 'add' && <label>Mot de passe initial<input className="gb-input" type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} /><span className="muted">12 caractères minimum. Il ne sera pas envoyé par e-mail.</span></label>}
      <button className="gb-btn" disabled={!email || (action === 'add' && password.length < 12)} onClick={() => void api<{ requestId: string }>('/v1/admin/allowlist/request', { method: 'POST', body: { email, action, ...(action === 'add' ? { password } : {}) } }).then(r => { setRequestId(r.requestId); setPassword(''); setMessage('Code de confirmation envoyé à votre adresse.'); }, e => setMessage(errText(e)))}>Demander la modification</button>
    </> : <>
      <label>Code de confirmation<input className="gb-input" inputMode="numeric" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} /></label>
      <button className="gb-btn" disabled={code.length !== 6} onClick={() => void api('/v1/admin/allowlist/confirm', { method: 'POST', body: { requestId, code } }).then(() => { setRequestId(null); setCode(''); setMessage('Modification confirmée.'); load(); }, e => setMessage(errText(e)))}>Confirmer la modification</button>
      <button className="link" onClick={() => { setRequestId(null); setCode(''); }}>Abandonner</button>
    </>}
    {message && <p role="status">{message}</p>}
  </section>;
}

type Tab = 'stats' | 'partners' | 'payouts' | 'audit' | 'allowlist' | 'subscriptions';
function Shell({ email, onLogout }: { email: string; onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>('stats');
  const tabs: [Tab, string][] = [['stats', 'Statistiques'], ['partners', 'Partenaires'], ['payouts', 'Versements'], ['audit', 'Audit'], ['allowlist', 'Administrateurs'], ['subscriptions', 'Abonnements']];
  const body: Record<Tab, ReactNode> = { stats: <StatsView />, partners: <PartnersView />, payouts: <PayoutsView />, audit: <AuditView />, allowlist: <AllowlistView />, subscriptions: <SubscriptionsView /> };
  return (
    <>
      <header className="topbar"><div className="wrap"><Logo size={34} /><strong style={{ flex: 1 }}>GoBilan · Administration</strong><span className="muted" style={{ fontSize: 14 }}>{email}</span><button className="link" onClick={onLogout}>Se déconnecter</button></div></header>
      <div className="wrap" style={{ paddingTop: 20 }}>
        <div className="row" style={{ justifyContent: 'flex-start', gap: 6, marginBottom: 18 }} role="tablist">{tabs.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'gb-btn btn-sm' : 'gb-btn gb-btn--ghost btn-sm'} onClick={() => setTab(k)}>{l}</button>)}</div>
        {body[tab]}
      </div>
    </>
  );
}

export function App() {
  const [admin, setAdmin] = useState<string | null | undefined>(undefined);
  useEffect(() => { api<{ admin: { email: string } }>('/v1/admin/me').then((r) => setAdmin(r.admin.email), () => setAdmin(null)); }, []);
  if (admin === undefined) return <div className="wrap" style={{ paddingTop: 80, textAlign: 'center' }}><Logo size={64} /></div>;
  if (!admin) return <Login onDone={setAdmin} />;
  return <Shell email={admin} onLogout={() => { void api('/v1/admin/logout', { method: 'POST' }).catch(() => undefined).then(() => setAdmin(null)); }} />;
}
