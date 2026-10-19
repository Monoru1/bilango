import { COUNTRIES, COUNTRY_CODES, countryOfPhone, type CountryCode, type Sector } from '@gobilan/domain';
import { Logo } from '@gobilan/ui';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { RemoteWelcome } from './RemoteWelcome';
import { DEMO_PERSONAS } from '../demo/store';
import { useStore } from '../app/useStore';

function DemoTag() {
  const s = useStore();
  if (s.mode !== 'demo') return <p className="demo-note">ENVIRONNEMENT DE DÉVELOPPEMENT — WhatsApp et CAPTCHA de test. Les codes sont disponibles dans la console du serveur.</p>;
  return <p className="demo-note" style={{ margin: 0 }}><strong>DEMO</strong> : données simulées, aucun envoi réel (WhatsApp, paiement, notifications).</p>;
}

/** Accueil de l'application installée : nouveau compte, ou entrée en démo par personnage. */
export function Welcome({ onStart }: { onStart: () => void }) {
  const s = useStore();
  const nav = useNavigate();
  const [pinFor, setPinFor] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  if (s.mode === 'api') return <RemoteWelcome onStart={onStart} />;
  if (pinFor && resetting) return <ResetPin userId={pinFor} onBack={() => setResetting(false)} onDone={() => nav('/')} />;
  if (pinFor) return <PinLogin userId={pinFor} onBack={() => setPinFor(null)} onDone={() => nav('/')} onForgot={() => setResetting(true)} />;
  return (
    <div className="screen">
      <main className="pad stack" style={{ flex: 1, justifyContent: 'center', gap: 22 }}>
        <div className="center splash" style={{ gap: 12 }}>
          <Logo size={80} />
          <h1 className="h1">GoBilan</h1>
          <p className="muted" style={{ margin: 0 }}>Suivez votre business à distance.</p>
        </div>
        <button className="gb-btn" onClick={onStart}>Créer mon compte</button>
        <DemoTag />
        <div className="stack" style={{ gap: 8 }}>
          <span className="gb-label">Entrer en démo (PIN 1234)</span>
          {[[DEMO_PERSONAS.owner, 'Patron — Dossou Bio'], [DEMO_PERSONAS.manager, 'Gérant — Moussa Adam'], [DEMO_PERSONAS.cashier, 'Caissière — Awa Sanni']].map(([id, label]) => (
            <button key={id} className="gb-btn gb-btn--ghost" style={{ minHeight: 48 }} onClick={() => setPinFor(id as string)}>{label}</button>
          ))}
        </div>
        <button className="link" onClick={() => s.reset()}>Réinitialiser la démo</button>
      </main>
      <footer className="footer"><Link to="/legal">Mentions légales & Politiques de confidentialité</Link></footer>
    </div>
  );
}

function Keypad({ onDigit, onBack }: { onDigit: (d: string) => void; onBack: () => void }) {
  return (
    <div className="keypad" role="group" aria-label="Clavier numérique">
      {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => <button key={d} className="key" onClick={() => onDigit(d)}>{d}</button>)}
      <span />
      <button className="key" onClick={() => onDigit('0')}>0</button>
      <button className="key" onClick={onBack} aria-label="Effacer">⌫</button>
    </div>
  );
}

export function Countdown({ ms }: { ms: number }) {
  const [left, setLeft] = useState(ms);
  useEffect(() => {
    setLeft(ms);
    const t = setInterval(() => setLeft((v) => Math.max(0, v - 1000)), 1000);
    return () => clearInterval(t);
  }, [ms]);
  const m = Math.floor(left / 60000);
  const sec = Math.floor((left % 60000) / 1000);
  return <span aria-live="polite">{m}:{String(sec).padStart(2, '0')}</span>;
}

/** Saisie du PIN : s'ouvre dès le 4e chiffre, sans bouton (§4.2). Blocage et compte à rebours côté « serveur » (store). */
export function PinLogin({ userId, onBack, onDone, onForgot }: { userId: string; onBack: () => void; onDone: () => void; onForgot?: () => void }) {
  const s = useStore();
  const [pin, setPin] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [lock, setLock] = useState<number | null>(null);
  const user = s.userById(userId);

  const press = async (d: string) => {
    if (lock !== null) return;
    const next = (pin + d).slice(0, 4);
    setPin(next);
    if (next.length === 4) {
      const r = await s.loginPin(userId, next);
      if (r.ok) return onDone();
      setPin('');
      setMsg(r.error);
      if (r.locked) setLock(r.retryAfterMs ?? 0);
    }
  };
  useEffect(() => {
    if (lock === null) return;
    const t = setTimeout(() => {
      setLock(null);
      setMsg(null);
    }, lock);
    return () => clearTimeout(t);
  }, [lock]);

  return (
    <div className="screen">
      <div className="pad stack" style={{ paddingTop: 32, gap: 8 }}>
        <button className="link" style={{ alignSelf: 'flex-start' }} onClick={onBack}>← Retour</button>
        <div className="center" style={{ gap: 8 }}>
          <Logo size={56} />
          <h1 className="h1">Bonjour{user?.name ? `, ${user.name.split(' ')[0]}` : ''}</h1>
          <p className="muted" style={{ margin: 0 }}>Entrez votre code PIN</p>
        </div>
        <div className="pinrow" aria-label={`${pin.length} chiffres saisis sur 4`}>
          {[0, 1, 2, 3].map((i) => <span key={i} className={`pindot ${i < pin.length ? 'on' : ''}`} />)}
        </div>
        {lock !== null ? (
          <p className="gb-error" role="alert" style={{ margin: 0, textAlign: 'center' }}>Trop d’erreurs. Réessayez dans <Countdown ms={lock} /></p>
        ) : msg ? (
          <p className="gb-error" role="alert" style={{ margin: 0, textAlign: 'center' }}>{msg}</p>
        ) : null}
        <button className="link" onClick={onForgot} style={{ alignSelf: 'center' }}>PIN oublié ?</button>
      </div>
      <Keypad onDigit={press} onBack={() => setPin((p) => p.slice(0, -1))} />
    </div>
  );
}

type Step = 'country' | 'phone' | 'otp' | 'pin' | 'referral' | 'name' | 'role' | 'business';

/** Onboarding : un écran, une action (§4.1). */
export function Onboarding({ onCancel, purpose = 'signup' }: { onCancel: () => void; purpose?: 'signup' | 'pin_reset' }) {
  const s = useStore();
  const nav = useNavigate();
  const [step, setStep] = useState<Step>('country');
  const [country, setCountry] = useState<CountryCode>('BJ');
  const [local, setLocal] = useState('');
  const [code, setCode] = useState('');
  const [pin, setPin] = useState('');
  const [ref, setRef] = useState('');
  const [name, setName] = useState('');
  const [bizName, setBizName] = useState('');
  const [sector, setSector] = useState<Sector>('boutique');
  const [stock, setStock] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [exhausted, setExhausted] = useState(false);
  const cfg = COUNTRIES[country];

  const goError = (e: string) => setErr(e);
  const back = () => (step === 'country' ? onCancel() : setStep(({ phone: 'country', otp: 'phone', pin: 'otp', referral: 'pin', name: 'referral', role: 'name', business: 'role' } as Record<Step, Step>)[step]));

  const sendCode = async () => {
    setErr(null);
    const r = await s.startOtp(country, local, purpose);
    if (!r.ok) return goError(r.error);
    setCode('');
    setExhausted(false);
    setStep('otp');
  };
  const checkCode = async (c: string) => {
    const r = await s.verifyOtp(c);
    if (!r.ok) {
      setErr(r.error);
      if (r.exhausted) setExhausted(true);
      setCode('');
      return;
    }
    setErr(null);
    if (r.value.next === 'logged_in') return nav('/');
    setStep('pin');
  };
  const pressPin = async (d: string) => {
    const next = (pin + d).slice(0, 4);
    setPin(next);
    if (next.length === 4) {
      const r = await s.createPin(next);
      if (!r.ok) { setPin(''); return goError(r.error); }
      setErr(null);
      setStep('referral');
    }
  };

  return (
    <div className="screen">
      <div className="pad stack" style={{ paddingTop: 24, flex: 1, gap: 20 }}>
        <button className="link" style={{ alignSelf: 'flex-start' }} onClick={back}>← Retour</button>
        {step === 'country' && (
          <>
            <h1 className="h1">Choisissez votre pays</h1>
            <div className="stack" style={{ gap: 12 }}>
              {COUNTRY_CODES.map((c) => (
                <button key={c} className="countrybtn" onClick={() => { setCountry(c); setStep('phone'); }}>
                  <span className="flag" aria-hidden="true">{COUNTRIES[c].flag}</span>{COUNTRIES[c].name}
                </button>
              ))}
            </div>
          </>
        )}
        {step === 'phone' && (
          <>
            <h1 className="h1">Entrez un numéro WhatsApp</h1>
            <div className="field">
              <div className="phone">
                <span className="dial" aria-label={`Indicatif ${cfg.dialCode}`}>{cfg.dialCode}</span>
                <input className="gb-input" inputMode="numeric" autoComplete="tel-national" autoFocus value={local} onChange={(e) => setLocal(e.target.value.replace(/[^\d\s]/g, ''))} aria-label="Numéro WhatsApp" />
              </div>
              <span className="faint" style={{ fontSize: 13 }}>Exemple : {cfg.nationalExample}</span>
            </div>
            {err && <p className="gb-error" role="alert" style={{ margin: 0 }}>{err}</p>}
            <DemoTag />
            <button className="gb-btn" onClick={sendCode} disabled={local.trim().length < 6}>Recevoir le code</button>
          </>
        )}
        {step === 'otp' && (
          <>
            <h1 className="h1">Entrez le code à 4 chiffres reçu par WhatsApp</h1>
            <input className="gb-input otp" inputMode="numeric" maxLength={4} autoFocus value={code} aria-label="Code à 4 chiffres" onChange={(e) => { const v = e.target.value.replace(/\D/g, '').slice(0, 4); setCode(v); if (v.length === 4 && !exhausted) checkCode(v); }} disabled={exhausted} />
            {s.mode === 'demo' && <p className="demo-note" style={{ margin: 0 }}><strong>DEMO</strong> : aucun message WhatsApp n’est envoyé. Votre code : <strong>{s.mode === 'demo' ? s.lastDemoOtp : ''}</strong></p>}
            {err && <p className="gb-error" role="alert" style={{ margin: 0 }}>{err}</p>}
            {exhausted && <button className="link" onClick={sendCode}>Mot de passe oublié ? Recevoir un nouveau code</button>}
          </>
        )}
        {step === 'pin' && (
          <>
            <h1 className="h1">Créez votre code PIN</h1>
            <p className="muted" style={{ margin: 0 }}>4 chiffres. Vous en aurez besoin à chaque ouverture.</p>
            <div className="pinrow">{[0, 1, 2, 3].map((i) => <span key={i} className={`pindot ${i < pin.length ? 'on' : ''}`} />)}</div>
            {err && <p className="gb-error" role="alert" style={{ margin: 0 }}>{err}</p>}
          </>
        )}
        {step === 'referral' && (
          <>
            <h1 className="h1">Avez-vous un code de parrainage ?</h1>
            <input className="gb-input" placeholder="Ex. KOFFI225 (facultatif)" autoCapitalize="characters" value={ref} onChange={(e) => setRef(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20))} aria-label="Code de parrainage" />
            <button className="gb-btn" onClick={() => setStep('name')}>{ref ? 'Continuer' : 'Passer'}</button>
          </>
        )}
        {step === 'name' && (
          <>
            <h1 className="h1">Entrez votre nom</h1>
            <input className="gb-input" autoFocus autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} aria-label="Votre nom" />
            {err && <p className="gb-error" role="alert" style={{ margin: 0 }}>{err}</p>}
            <button className="gb-btn" disabled={!name.trim()} onClick={async () => { const r = await s.setProfile(name, ref); if (!r.ok) return goError(r.error); setErr(null); setStep('role'); }}>Continuer</button>
          </>
        )}
        {step === 'role' && (
          <>
            <h1 className="h1">Que voulez-vous faire ?</h1>
            <button className="gb-btn" onClick={() => setStep('business')}>Ajouter un business</button>
            <button className="gb-btn gb-btn--ghost" onClick={() => nav('/invitations')}>Rejoindre un business</button>
          </>
        )}
        {step === 'business' && (
          <>
            <h1 className="h1">Nom de votre business</h1>
            <input className="gb-input" autoFocus value={bizName} onChange={(e) => setBizName(e.target.value)} aria-label="Nom du business" />
            <div className="field">
              <label htmlFor="sector">Secteur d’activité</label>
              <select id="sector" className="gb-input" value={sector} onChange={(e) => setSector(e.target.value as Sector)}>
                <option value="boutique">Boutique</option>
                <option value="bar_restaurant">Bar / restaurant</option>
                <option value="ecommerce">E-commerce</option>
                <option value="other">Autre</option>
              </select>
            </div>
            <label className="row" style={{ justifyContent: 'flex-start', gap: 12 }}>
              <input type="checkbox" checked={stock} onChange={(e) => setStock(e.target.checked)} /> Activer le module Stock (facultatif)
            </label>
            {err && <p className="gb-error" role="alert" style={{ margin: 0 }}>{err}</p>}
            <p className="muted" style={{ margin: 0, fontSize: 14 }}>La validation lance votre période d’essai de 7 jours, sans paiement.</p>
            <button className="gb-btn" disabled={!bizName.trim()} onClick={async () => { const r = await s.createBusiness(bizName, sector, stock); if (!r.ok) return goError(r.error); nav(`/b/${r.value.id}`); }}>Commencer l’essai de 7 jours</button>
          </>
        )}
      </div>
      {step === 'pin' && <Keypad onDigit={pressPin} onBack={() => setPin((p) => p.slice(0, -1))} />}
    </div>
  );
}

/** « PIN oublié ? » : code WhatsApp (simulé) puis création d'un nouveau PIN (§4.2). */
function ResetPin({ userId, onBack, onDone }: { userId: string; onBack: () => void; onDone: () => void }) {
  const s = useStore();
  const user = s.userById(userId);
  const [stage, setStage] = useState<'otp' | 'pin'>('otp');
  const [code, setCode] = useState('');
  const [pin, setPin] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [requested, setRequested] = useState(false);
  const request = async () => {
    const c = user ? countryOfPhone(user.phone) : null;
    if (!user || !c) return setErr('Compte introuvable.');
    const r = await s.startOtp(c, user.phone.slice(COUNTRIES[c].dialCode.length), 'pin_reset');
    if (!r.ok) return setErr(r.error);
    setRequested(true);
  };
  const check = async (v: string) => {
    const r = await s.verifyOtp(v);
    if (!r.ok) {
      setErr(r.error);
      return setCode('');
    }
    setErr(null);
    setStage('pin');
  };
  const press = async (d: string) => {
    const next = (pin + d).slice(0, 4);
    setPin(next);
    if (next.length === 4) {
      const r = await s.createPin(next);
      if (r.ok) return onDone();
      setErr(r.error);
      setPin('');
    }
  };
  return (
    <div className="screen">
      <div className="pad stack" style={{ paddingTop: 24, flex: 1, gap: 20 }}>
        <button className="link" style={{ alignSelf: 'flex-start' }} onClick={onBack}>← Retour</button>
        {stage === 'otp' && !requested ? <button className="gb-btn" onClick={request}>Recevoir le code de réinitialisation</button> : stage === 'otp' ? (
          <>
            <h1 className="h1">Entrez le code à 4 chiffres reçu par WhatsApp</h1>
            <input className="gb-input otp" inputMode="numeric" maxLength={4} autoFocus value={code} aria-label="Code à 4 chiffres" onChange={(e) => { const v = e.target.value.replace(/\D/g, '').slice(0, 4); setCode(v); if (v.length === 4) check(v); }} />
            {s.mode === 'demo' && <p className="demo-note" style={{ margin: 0 }}><strong>DEMO</strong> : aucun message WhatsApp n’est envoyé. Votre code : <strong>{s.mode === 'demo' ? s.lastDemoOtp : ''}</strong></p>}
          </>
        ) : (
          <>
            <h1 className="h1">Créez un nouveau PIN</h1>
            <div className="pinrow">{[0, 1, 2, 3].map((i) => <span key={i} className={`pindot ${i < pin.length ? 'on' : ''}`} />)}</div>
          </>
        )}
        {err && <p className="gb-error" role="alert" style={{ margin: 0 }}>{err}</p>}
      </div>
      {stage === 'pin' && <Keypad onDigit={press} onBack={() => setPin((p) => p.slice(0, -1))} />}
    </div>
  );
}
