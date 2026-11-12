import { useEffect, useState } from 'react';
import { audienceAvailable, audienceConsent, retryAudienceDeletion, setAudienceConsent, trackAudience } from '../lib/audience';
import type { Env } from '../lib/env';

export function AudienceConsent({ env, settings = false }: { env?: Env; settings?: boolean }) {
  const [consent, setConsent] = useState(audienceConsent);
  const available = audienceAvailable();
  useEffect(() => retryAudienceDeletion(), []);
  useEffect(() => {
    if (!available || consent !== 'yes' || !env) return;
    trackAudience(env.standalone ? 'first_open' : 'visit', env);
    if (env.standalone || env.platform !== 'android') return;
    const installed = () => trackAudience('android_install', env);
    window.addEventListener('appinstalled', installed);
    return () => window.removeEventListener('appinstalled', installed);
  }, [available, consent, env]);

  if (!available || (!settings && consent !== null)) return null;
  function choose(value: boolean) {
    setAudienceConsent(value);
    setConsent(audienceConsent());
  }

  return <aside className="pad stack" aria-label="Mesure d’audience">
    <p>Autoriser la mesure d’audience GoBilan ? Un identifiant aléatoire est conservé dans ce navigateur, sans cookie. Vous pouvez retirer votre choix dans les mentions légales.</p>
    <div className="row">
      <button className="gb-btn gb-btn--ghost" onClick={() => choose(false)} disabled={consent === 'no'}>{consent === 'yes' ? 'Retirer mon accord' : 'Refuser'}</button>
      <button className="gb-btn gb-btn--ghost" onClick={() => choose(true)} disabled={consent === 'yes'}>Autoriser la mesure</button>
    </div>
  </aside>;
}
