import { COUNTRIES, formatFcfa, type CountryCode } from '@gobilan/domain';
import { acceptanceText, AGREEMENT_ROLE_LABEL, AGREEMENT_VERSION, AgreementView, ApiError, createClient, LegalPage, Logo, type AgreementRole } from '@gobilan/ui';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { BrowserRouter, Link, Navigate, Route, Routes, useNavigate, useSearchParams } from 'react-router-dom';

const api = createClient(import.meta.env.VITE_API_URL ?? '');

interface Partner { id: string; email: string; name: string; role: AgreementRole; country: CountryCode; agreementAccepted: boolean }
interface Referral { businessName: string; registeredAt: string; status: 'trial' | 'paid' | 'expired'; daysLeft: number }
type Dash =
  | { role: 'agent'; promoCode: string; referralLink: string; counters: { referrals: number; paid: number; earned: number; paidOut: number; pending: number }; referrals: Referral[] }
  | { role: 'manager'; counters: { trialsStarted: number; paid: number; earned: number; paidOut: number; pending: number }; team: { name: string; promoCode: string | null; status: string; referrals: number; paid: number; conversion: number }[]; referrals: Referral[] }
  | { role: 'influencer'; promoCode: string; counters: { signups: number; activeSubscriptions: number; validatedRevenue: number }; subscribers: { businessName: string; month: number; gainThisMonth: number; totalCumulated: number }[] };

const STATUS: Record<Referral['status'], string> = { paid: 'Payé', trial: 'En essai', expired: 'Expiré' };
const errText = (e: unknown) => (e instanceof ApiError ? e.message : 'Une erreur est survenue.');

function Frame({ children, partner, onLogout }: { children: ReactNode; partner?: Partner | null; onLogout?: () => void }) {
  return (
    <>
      <header className="topbar">
        <div className="wrap">
          <Logo size={34} />
          <strong style={{ flex: 1 }}>GoBilan · Portail partenaires</strong>
          {partner && <span className="muted" style={{ fontSize: 14 }}>{partner.name} · {AGREEMENT_ROLE_LABEL[partner.role]}</span>}
          {partner && <button className="link" onClick={onLogout}>Se déconnecter</button>}
        </div>
      </header>
      <div className="wrap" style={{ paddingTop: 24 }}>{children}</div>
      <footer className="wrap faint" style={{ fontSize: 13, textAlign: 'center' }}><Link to="/legal">Mentions légales & Politiques de confidentialité</Link></footer>
    </>
  );
}

function Login({ onDone }: { onDone: (p: Partner) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    setErr(null);
    try {
      onDone((await api<{ partner: Partner }>('/v1/partner/login', { method: 'POST', body: { email, password } })).partner);
    } catch (e) {
      setErr(errText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="card narrow stack">
      <h1 className="h1">Connexion</h1>
      <input className="gb-input" type="email" autoComplete="username" placeholder="Adresse e-mail" aria-label="Adresse e-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input className="gb-input" type="password" autoComplete="current-password" placeholder="Mot de passe" aria-label="Mot de passe" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void submit()} />
      {err && <p className="gb-error" role="alert" style={{ margin: 0 }}>{err}</p>}
      <button className="gb-btn" disabled={busy || !email || !password} onClick={() => void submit()}>Se connecter</button>
      <Link className="link" to="/mot-de-passe-oublie">Mot de passe oublié ?</Link>
    </div>
  );
}

function Forgot() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [pw, setPw] = useState('');
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const run = async (fn: () => Promise<unknown>, ok: () => void) => {
    setErr(null);
    try {
      await fn();
      ok();
    } catch (e) {
      setErr(errText(e));
    }
  };
  return (
    <div className="card narrow stack">
      <h1 className="h1">Mot de passe oublié</h1>
      {done ? (
        <><p className="muted">Mot de passe modifié. Vous pouvez vous connecter.</p><Link className="gb-btn" style={{ textDecoration: 'none' }} to="/">Connexion</Link></>
      ) : !sent ? (
        <>
          <input className="gb-input" type="email" placeholder="Adresse e-mail" aria-label="Adresse e-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
          <button className="gb-btn" disabled={!email} onClick={() => void run(() => api('/v1/partner/forgot', { method: 'POST', body: { email } }), () => setSent(true))}>Recevoir un code</button>
        </>
      ) : (
        <>
          <p className="muted" style={{ margin: 0 }}>Si cette adresse correspond à un compte, un code à 6 chiffres vient d’être envoyé (valable 10 minutes).</p>
          <input className="gb-input" inputMode="numeric" maxLength={6} placeholder="Code à 6 chiffres" aria-label="Code à 6 chiffres" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
          <input className="gb-input" type="password" autoComplete="new-password" placeholder="Nouveau mot de passe (8 caractères minimum)" aria-label="Nouveau mot de passe" value={pw} onChange={(e) => setPw(e.target.value)} />
          <button className="gb-btn" disabled={code.length !== 6 || pw.length < 8} onClick={() => void run(() => api('/v1/partner/reset', { method: 'POST', body: { email, code, password: pw } }), () => setDone(true))}>Changer le mot de passe</button>
        </>
      )}
      {err && <p className="gb-error" role="alert" style={{ margin: 0 }}>{err}</p>}
    </div>
  );
}

/** Activation : lien à usage unique reçu par e-mail → mot de passe + accord (une case) (§10.2, §10.3). */
function Activate({ onDone }: { onDone: (p: Partner) => void }) {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const nav = useNavigate();
  const [info, setInfo] = useState<{ name: string; role: AgreementRole } | null>(null);
  const [bad, setBad] = useState<string | null>(null);
  const [pw, setPw] = useState('');
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    api<{ name: string; role: AgreementRole }>(`/v1/partner/activation?token=${encodeURIComponent(token)}`).then(setInfo, (e) => setBad(errText(e)));
  }, [token]);
  if (bad) return <div className="card narrow stack"><h1 className="h1">Lien indisponible</h1><p className="gb-error" style={{ margin: 0 }}>{bad}</p></div>;
  if (!info) return <p className="muted">Chargement…</p>;
  const submit = async () => {
    setErr(null);
    try {
      onDone((await api<{ partner: Partner }>('/v1/partner/activate', { method: 'POST', body: { token, password: pw, acceptedAgreementVersion: AGREEMENT_VERSION } })).partner);
      nav('/', { replace: true });
    } catch (e) {
      setErr(errText(e));
    }
  };
  return (
    <div className="card stack">
      <h1 className="h1">Bienvenue, {info.name}</h1>
      <p className="muted" style={{ margin: 0 }}>Créez votre mot de passe, puis acceptez votre accord pour accéder à votre tableau de bord.</p>
      <input className="gb-input" type="password" autoComplete="new-password" placeholder="Mot de passe (8 caractères minimum)" aria-label="Mot de passe" value={pw} onChange={(e) => setPw(e.target.value)} />
      <div style={{ maxHeight: 340, overflowY: 'auto', border: '1px solid var(--sep)', borderRadius: 12, padding: 16 }}><AgreementView role={info.role} /></div>
      <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}><input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} style={{ marginTop: 4 }} /><span>{acceptanceText(info.role)}</span></label>
      {err && <p className="gb-error" role="alert" style={{ margin: 0 }}>{err}</p>}
      <button className="gb-btn" disabled={!ok || pw.length < 8} onClick={() => void submit()}>Activer mon accès</button>
    </div>
  );
}

const Stat = ({ label, value }: { label: string; value: string | number }) => (
  <div className="card"><div className="gb-label">{label}</div><div className="gb-amount gb-amount--md" style={{ marginTop: 8 }}>{value}</div></div>
);

function ReferralTable({ rows }: { rows: Referral[] }) {
  if (rows.length === 0) return <p className="muted">Aucun parrainage pour le moment.</p>;
  // Aucun numéro de téléphone : seuls le nom du business, la date et le statut (§10.6).
  return (
    <div className="scroll"><table><thead><tr><th>Business</th><th>Inscription</th><th>Statut</th><th>Jours restants</th></tr></thead>
      <tbody>{rows.map((r, i) => <tr key={i}><td>{r.businessName}</td><td>{r.registeredAt.slice(0, 10)}</td><td><span className={`status ${r.status}`}>{STATUS[r.status]}</span></td><td>{r.status === 'trial' ? r.daysLeft : '—'}</td></tr>)}</tbody></table></div>
  );
}

function PromoCode({ code, link }: { code: string; link?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* presse-papiers indisponible */
    }
  };
  return (
    <div className="card stack">
      <div className="gb-label">Mon code promo</div>
      <div className="code">{code}</div>
      <div className="row" style={{ justifyContent: 'flex-start' }}>
        <button className="gb-btn gb-btn--ghost btn-sm" onClick={() => void copy(code)}>{copied ? 'Copié ✓' : 'Copier le code'}</button>
        {link && <button className="gb-btn gb-btn--ghost btn-sm" onClick={() => void copy(link)}>Copier mon lien</button>}
      </div>
    </div>
  );
}

function RegisterAgent({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: '', email: '', promoCode: '' });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  if (!open) return <button className="gb-btn btn-sm" onClick={() => setOpen(true)}>+ Enregistrer un agent</button>;
  return (
    <div className="card stack">
      <h2 className="h2">Enregistrer un agent</h2>
      <input className="gb-input" placeholder="Nom" aria-label="Nom de l’agent" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      <input className="gb-input" type="email" placeholder="E-mail" aria-label="E-mail de l’agent" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
      <input className="gb-input" placeholder="Code promo — [PRÉNOM][CODE PAYS], ex. KOFFI225" aria-label="Code promo" value={f.promoCode} onChange={(e) => setF({ ...f, promoCode: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })} />
      {msg && <p className={msg.ok ? 'demo-note' : 'gb-error'} role="status" style={{ margin: 0 }}>{msg.text}</p>}
      <div className="row"><button className="link" onClick={() => setOpen(false)}>Annuler</button><button className="gb-btn btn-sm" disabled={!f.name || !f.email || !f.promoCode} onClick={() => api('/v1/partner/agents', { method: 'POST', body: f }).then(() => { setMsg({ ok: true, text: 'Agent enregistré : il reçoit son e-mail d’activation.' }); setF({ name: '', email: '', promoCode: '' }); onDone(); }, (e) => setMsg({ ok: false, text: errText(e) }))}>Enregistrer</button></div>
    </div>
  );
}

function PayoutBlock({ partner }: { partner: Partner }) {
  const [f, setF] = useState({ phone: '', network: '', displayName: '' });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const networks = COUNTRIES[partner.country].networks;
  useEffect(() => {
    api<{ block: { phone: string; network: string; displayName: string } | null }>('/v1/partner/payout-block').then((r) => r.block && setF(r.block), () => undefined);
  }, []);
  return (
    <div className="card stack">
      <h2 className="h2">Mes coordonnées de paiement</h2>
      <p className="muted" style={{ margin: 0, fontSize: 14 }}>Utilisées pour vos versements (les 1er et 15 de chaque mois). Enregistrées chiffrées.</p>
      <input className="gb-input" inputMode="tel" placeholder="Numéro Mobile Money (+22507…)" aria-label="Numéro de paiement" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value.replace(/[^\d+]/g, '') })} />
      <select className="gb-input" aria-label="Réseau" value={f.network} onChange={(e) => setF({ ...f, network: e.target.value })}>
        <option value="">Réseau…</option>
        {networks.map((n) => <option key={n} value={n}>{n}</option>)}
      </select>
      <input className="gb-input" placeholder="Nom affiché" aria-label="Nom affiché" value={f.displayName} onChange={(e) => setF({ ...f, displayName: e.target.value })} />
      {msg && <p className={msg.ok ? 'demo-note' : 'gb-error'} role="status" style={{ margin: 0 }}>{msg.text}</p>}
      <button className="gb-btn btn-sm" disabled={!f.phone || !f.network || !f.displayName} onClick={() => api('/v1/partner/payout-block', { method: 'PUT', body: f }).then(() => setMsg({ ok: true, text: 'Coordonnées enregistrées.' }), (e) => setMsg({ ok: false, text: errText(e) }))}>Enregistrer</button>
    </div>
  );
}

function PayoutHistory() {
  const [rows, setRows] = useState<{ validatedAt: string; cycleDate: string; gross: number; fees: number; net: number }[]>([]);
  useEffect(() => { api<{ payouts: typeof rows }>('/v1/partner/payouts').then((r) => setRows(r.payouts), () => undefined); }, []);
  return (
    <div className="card stack">
      <h2 className="h2">Mes versements</h2>
      {rows.length === 0 ? <p className="muted" style={{ margin: 0 }}>Aucun versement pour le moment. Un versement est effectué dès 2 000 FCFA cumulés.</p> : (
        <div className="scroll"><table><thead><tr><th>Cycle</th><th>Brut</th><th>Frais</th><th>Net</th></tr></thead><tbody>{rows.map((r, i) => <tr key={i}><td>{r.cycleDate}</td><td>{formatFcfa(r.gross)}</td><td>{formatFcfa(r.fees)}</td><td><strong>{formatFcfa(r.net)}</strong></td></tr>)}</tbody></table></div>
      )}
    </div>
  );
}

function Dashboard({ partner }: { partner: Partner }) {
  const [d, setD] = useState<Dash | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(() => { api<Dash>('/v1/partner/dashboard').then(setD, (e) => setErr(errText(e))); }, []);
  useEffect(load, [load]);
  if (err) return <p className="gb-error">{err}</p>;
  if (!d) return <p className="muted">Chargement…</p>;
  return (
    <div className="stack" style={{ gap: 18 }}>
      <h1 className="h1">Bonjour, {partner.name.split(' ')[0]}</h1>
      {d.role === 'agent' && (
        <>
          <PromoCode code={d.promoCode} link={d.referralLink} />
          <div className="grid3"><Stat label="Parrainages" value={d.counters.referrals} /><Stat label="Abonnements payés" value={d.counters.paid} /><Stat label="Gains" value={formatFcfa(d.counters.earned)} /></div>
          <div className="card"><h2 className="h2" style={{ marginBottom: 8 }}>Mes parrainages</h2><ReferralTable rows={d.referrals} /></div>
        </>
      )}
      {d.role === 'manager' && (
        <>
          <div className="row"><h2 className="h2">Mon équipe</h2><RegisterAgent onDone={load} /></div>
          <div className="grid3"><Stat label="Essais démarrés" value={d.counters.trialsStarted} /><Stat label="Abonnements payés" value={d.counters.paid} /><Stat label="Mes gains" value={formatFcfa(d.counters.earned)} /></div>
          <div className="card scroll"><table><thead><tr><th>Agent</th><th>Code</th><th>Statut</th><th>Parrainages</th><th>Payés</th><th>Conversion</th></tr></thead>
            <tbody>{d.team.map((a) => <tr key={a.name + a.promoCode}><td>{a.name}</td><td>{a.promoCode}</td><td>{a.status}</td><td>{a.referrals}</td><td>{a.paid}</td><td>{a.conversion} %</td></tr>)}</tbody></table>{d.team.length === 0 && <p className="muted">Aucun agent pour le moment.</p>}</div>
          <div className="card"><h2 className="h2" style={{ marginBottom: 8 }}>Parrainages de l’équipe</h2><ReferralTable rows={d.referrals} /></div>
        </>
      )}
      {d.role === 'influencer' && (
        <>
          <PromoCode code={d.promoCode} />
          <div className="grid3"><Stat label="Inscriptions via mon code" value={d.counters.signups} /><Stat label="Abonnements actifs" value={d.counters.activeSubscriptions} /><Stat label="Revenus validés" value={formatFcfa(d.counters.validatedRevenue)} /></div>
          <div className="card scroll"><h2 className="h2" style={{ marginBottom: 8 }}>Mes abonnés</h2><table><thead><tr><th>Business</th><th>Mois</th><th>Gain du mois</th><th>Total cumulé</th></tr></thead>
            <tbody>{d.subscribers.map((s, i) => <tr key={i}><td>{s.businessName}</td><td>{s.month || '—'} / 12</td><td>{formatFcfa(s.gainThisMonth)}</td><td>{formatFcfa(s.totalCumulated)}</td></tr>)}</tbody></table>{d.subscribers.length === 0 && <p className="muted">Aucun abonné pour le moment.</p>}</div>
        </>
      )}
      <PayoutHistory />
      <PayoutBlock partner={partner} />
    </div>
  );
}

export function App() {
  const [partner, setPartner] = useState<Partner | null | undefined>(undefined);
  useEffect(() => { api<{ partner: Partner }>('/v1/partner/me').then((r) => setPartner(r.partner), () => setPartner(null)); }, []);
  const logout = async () => {
    await api('/v1/partner/logout', { method: 'POST' }).catch(() => undefined);
    setPartner(null);
  };
  if (partner === undefined) return <div className="wrap" style={{ paddingTop: 80, textAlign: 'center' }}><Logo size={64} /></div>;
  return (
    <BrowserRouter>
      <Frame partner={partner} onLogout={() => void logout()}>
        <Routes>
          <Route path="/legal" element={<LegalPage />} />
          <Route path="/activer" element={<Activate onDone={setPartner} />} />
          <Route path="/mot-de-passe-oublie" element={<Forgot />} />
          <Route path="/" element={partner ? <Dashboard partner={partner} /> : <Login onDone={setPartner} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Frame>
    </BrowserRouter>
  );
}
