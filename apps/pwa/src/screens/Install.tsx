import { Logo } from '@gobilan/ui';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShareIcon } from '../components/Icons';
import type { Env } from '../lib/env';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * Page d'accueil dans le navigateur (CDC §3) : logo, message court, bouton « Installer
 * l'application », pages légales en bas. Règle d'affichage, pas une protection.
 */
export function InstallPage({ env }: { env: Env }) {
  const [evt, setEvt] = useState<BeforeInstallPromptEvent | null>(null);
  const [guide, setGuide] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  // Navigateur intégré (TikTok, Instagram, WhatsApp, Facebook) : installation impossible (§3.4).
  if (env.inAppBrowser) {
    return (
      <Shell>
        <div className="stack center" style={{ gap: 20, maxWidth: 320 }}>
          <Logo size={88} />
          <p className="h1">Ouvre ce lien dans Chrome / Safari</p>
          <p className="muted" style={{ margin: 0 }}>L’installation n’est pas possible dans ce navigateur. Touche les trois points ou l’icône de partage, puis « Ouvrir dans le navigateur ».</p>
        </div>
      </Shell>
    );
  }

  const install = async () => {
    setHint(null);
    if (env.platform === 'ios') {
      if (env.iosSafari) setGuide(true);
      else setHint('Sur iPhone, ouvre ce lien dans Safari pour installer GoBilan.');
      return;
    }
    if (evt) {
      await evt.prompt();
      await evt.userChoice;
      setEvt(null);
      return;
    }
    setHint('Pour installer, ouvre ce site dans Chrome, puis touche « Installer l’application » dans le menu du navigateur.');
  };

  return (
    <Shell>
      <div className="stack center" style={{ gap: 20, maxWidth: 340 }}>
        <Logo size={96} />
        <p className="muted" style={{ margin: 0, fontSize: 17 }}>Installez l’application sur votre téléphone pour suivre votre business.</p>
        <button className="gb-btn" onClick={install}>Installer l’application</button>
        {hint && <p className="gb-error" role="status" style={{ margin: 0 }}>{hint}</p>}
      </div>
      {guide && <IosGuide onClose={() => setGuide(false)} />}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="screen">
      <main className="pad center" style={{ flex: 1, justifyContent: 'center' }}>{children}</main>
      <footer className="footer"><Link to="/legal">Mentions légales & Politiques de confidentialité</Link></footer>
    </div>
  );
}

/**
 * Guide iPhone/Safari (§3.3). Aucune automatisation de l'installation. Le guide se réaffiche à
 * chaque visite (rien n'est mémorisé quand on le ferme). Captures d'écran et vidéo d'environ 10 s :
 * NON fournies à ce jour (voir docs/CODEX_HANDOFF.md) — illustrations vectorielles provisoires.
 */
function IosGuide({ onClose }: { onClose: () => void }) {
  return (
    <div className="overlay" role="presentation" style={{ alignItems: 'end', padding: 0 }}>
      <div className="dialog" role="dialog" aria-modal="true" aria-label="Installer GoBilan sur iPhone" style={{ borderRadius: '20px 20px 0 0', maxWidth: 520, maxHeight: '92dvh', overflowY: 'auto' }}>
        <div className="row"><h2 className="h2">Installer sur iPhone</h2><button className="link" onClick={onClose}>Fermer</button></div>
        <ol className="steps">
          <li><span>Appuie sur <strong>Partager</strong> <span style={{ display: 'inline-block', verticalAlign: 'middle' }}><ShareIcon /></span> en bas de Safari.</span></li>
          <li><span><strong>Fais défiler</strong> le menu vers le bas.</span></li>
          <li><span>Appuie sur <strong>« Sur l’écran d’accueil »</strong>.</span></li>
          <li><span>Appuie sur <strong>« Ajouter »</strong>.</span></li>
        </ol>
        <p className="muted" style={{ margin: 0, fontSize: 14 }}>L’installation est nécessaire pour recevoir les notifications.</p>
        <div className="center bob" aria-hidden="true" style={{ color: 'var(--text)' }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4v14M6 13l6 6 6-6" /></svg>
          <span style={{ fontSize: 12 }} className="faint">Le bouton Partager est ici, en bas de l’écran</span>
        </div>
      </div>
    </div>
  );
}
