import { COUNTRIES, COUNTRY_CODES, normalizePhone, type CountryCode } from '@gobilan/domain';
import { Logo } from '@gobilan/ui';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../app/useStore';
import { Countdown, Onboarding } from './Auth';

export function RemoteWelcome({ onStart }: { onStart: () => void }) {
  const s = useStore();
  const [country, setCountry] = useState<CountryCode>('BJ');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [lockedUntil, setLockedUntil] = useState(0);
  const [reset, setReset] = useState(false);
  useEffect(() => {
    if (!lockedUntil) return;
    const t = setTimeout(() => { setLockedUntil(0); setError(''); }, Math.max(0, lockedUntil - Date.now()));
    return () => clearTimeout(t);
  }, [lockedUntil]);
  if (reset) return <Onboarding purpose="pin_reset" onCancel={() => setReset(false)} />;
  const login = async (value: string) => {
    if (s.mode !== 'api' || busy || Date.now() < lockedUntil) return;
    const normalized = normalizePhone(country, phone);
    if (!normalized) return setError('Entrez un numéro valide.');
    setPin(value);
    if (value.length !== 4) return;
    setBusy(true); setError('');
    const r = await s.loginPin(normalized, value);
    setBusy(false); setPin('');
    if (!r.ok) { setError(r.error); if (r.locked) setLockedUntil(Date.now() + (r.retryAfterMs ?? 0)); }
  };
  return <div className="screen"><main className="pad stack" style={{ gap: 18, paddingTop: 32 }}>
    <Logo size={80} /><h1 className="h1">Bienvenue sur GoBilan</h1>
    <label>Pays<select className="gb-input" value={country} onChange={e => setCountry(e.target.value as CountryCode)}>{COUNTRY_CODES.map(c => <option key={c} value={c}>{COUNTRIES[c].name}</option>)}</select></label>
    <label>Numéro WhatsApp ({COUNTRIES[country].dialCode})<input className="gb-input" inputMode="tel" autoComplete="tel-national" value={phone} onChange={e => setPhone(e.target.value)} /></label>
    <label>Code PIN<input className="gb-input" type="password" inputMode="numeric" autoComplete="current-password" maxLength={4} value={pin} disabled={busy} onChange={e => void login(e.target.value.replace(/\D/g, '').slice(0, 4))} /></label>
    {busy && <p role="status">Connexion…</p>}{error && <p role="alert" className="gb-error">{error}{lockedUntil > 0 && <> <Countdown ms={Math.max(0, lockedUntil - Date.now())} /></>}</p>}
    <button className="link" onClick={() => setReset(true)}>PIN oublié ?</button>
    <button className="gb-btn" onClick={onStart}>Créer mon compte / nouvel appareil</button>
    <p className="demo-note">ENVIRONNEMENT DE DÉVELOPPEMENT — données enregistrées sur le serveur ; WhatsApp, CAPTCHA et paiements externes restent simulés.</p>
    <Link to="/legal">Mentions légales & Politiques de confidentialité</Link>
  </main></div>;
}
