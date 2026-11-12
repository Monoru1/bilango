import { createClient } from '@gobilan/ui';
import { useEffect, useState } from 'react';

interface ReferralView {
  eligible: boolean;
  code: { code: string; active: boolean } | null;
  registrations: number;
  paid: number;
  days: number;
}
const api = createClient();

export function OwnerReferralScreen() {
  const [view, setView] = useState<ReferralView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    void api<ReferralView>('/v1/me/owner-referral-code').then((result) => { if (active) setView(result); }).catch((err: unknown) => {
      if (active) setError(err instanceof Error ? err.message : 'Chargement impossible.');
    });
    return () => { active = false; };
  }, []);
  const generate = async () => {
    setBusy(true); setError(null);
    try {
      await api('/v1/me/owner-referral-code', { method: 'POST' });
      setView(await api<ReferralView>('/v1/me/owner-referral-code'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Génération impossible.');
    } finally { setBusy(false); }
  };
  return (
    <main className="pad stack" style={{ gap: 16 }}>
      <h1 className="h1">Parrainage</h1>
      {error && <p role="alert" className="gb-error">{error}</p>}
      {!view && !error && <p role="status">Chargement…</p>}
      {view && !view.eligible && <p>Le parrainage est disponible après votre premier abonnement payé.</p>}
      {view?.eligible && <>
        {view.code ? <p>Votre code : <strong>{view.code.code}</strong>{!view.code.active && ' (désactivé)'}</p> : <button className="gb-btn" disabled={busy} onClick={() => void generate()}>Générer mon code de parrainage</button>}
        <p>Inscriptions : {view.registrations}</p>
        <p>Premiers abonnements payés : {view.paid}</p>
        <p>Jours enregistrés : {view.days}</p>
        {view.days > 0 && <p className="muted">Les conditions d’utilisation des jours sont en cours de confirmation.</p>}
      </>}
    </main>
  );
}
