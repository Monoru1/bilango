import { AudienceConsent } from './components/AudienceConsent';
import { useEffect, useMemo, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { Logo } from '@gobilan/ui';
import { store, useStore } from './app/useStore';
import { currentEnv } from './lib/env';
import { BusinessShell } from './screens/BusinessShell';
import { HelpScreen } from './screens/Help';
import { HomeRouter } from './screens/Home';
import { InstallPage } from './screens/Install';
import { LegalScreen } from './screens/Legal';
import { NewBusiness } from './screens/NewBusiness';
import { Onboarding, Welcome } from './screens/Auth';
import { ReportForm } from './screens/ReportForm';
import { DayDetail, ReportsList } from './screens/Reports';
import { InvitationsScreen, ProfileScreen } from './screens/Settings';
import { StockScreen } from './screens/Stock';
import { SubscriptionScreen } from './screens/Subscription';
import { TeamScreen } from './screens/Team';
import { OwnerReferralScreen } from './screens/OwnerReferral';

function Splash() {
  return <div className="screen center" style={{ justifyContent: 'center', minHeight: '100dvh' }}><div className="splash"><Logo size={88} /></div></div>;
}

function Landing() {
  const s = useStore();
  const nav = useNavigate();
  const u = s.user;
  if (!u || !u.name) return <AuthGate />;
  const list = s.businessesOfUser(u.id);
  const first = list[0];
  if (first) return <Navigate to={`/b/${first.id}`} replace />;
  return (
    <div className="screen">
      <main className="pad stack" style={{ flex: 1, justifyContent: 'center', gap: 16 }}>
        <h1 className="h1">Bonjour{u.name ? `, ${u.name.split(' ')[0]}` : ''}</h1>
        <button className="gb-btn" onClick={() => nav('/nouveau-business')}>Ajouter un business</button>
        <button className="gb-btn gb-btn--ghost" onClick={() => nav('/invitations')}>Rejoindre un business</button>
      </main>
    </div>
  );
}

/** Bandeau de recette : rend visible que WhatsApp n'est pas réellement branché dans cet environnement. */
function RecetteBanner() {
  const s = useStore();
  const [simulated, setSimulated] = useState(false);
  useEffect(() => {
    let active = true;
    if (s.mode === 'api') void s.whatsappSimulated().then((value) => { if (active) setSimulated(value); });
    return () => { active = false; };
  }, [s]);
  return simulated ? <div className="gb-demo-banner" role="note">DÉMO — WhatsApp simulé</div> : null;
}

function AuthGate() {
  const [onboarding, setOnboarding] = useState(false);
  return onboarding ? <Onboarding onCancel={() => setOnboarding(false)} /> : <Welcome onStart={() => setOnboarding(true)} />;
}

export function App() {
  const env = useMemo(currentEnv, []);
  const [ready, setReady] = useState(false);
  const s = useStore();
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 500); // chargement < 2 s, animation minimale (§11.6)
    // Ouverture de l'application : le badge rouge s'efface (§9.2).
    (navigator as Navigator & { clearAppBadge?: () => Promise<void> }).clearAppBadge?.().catch(() => undefined);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    if (!env.standalone || s.mode !== 'api') return;
    void s.initialize();
    const update = () => { if (document.visibilityState === 'visible' && s.user) void s.refreshIfIdle(); };
    window.addEventListener('focus', update);
    const timer = setInterval(update, 30000);
    return () => { window.removeEventListener('focus', update); clearInterval(timer); };
  }, [s, env.standalone]);
  // Le navigateur public ne charge pas les écrans métier. La mesure d’audience est facultative.
  if (!env.standalone) return <BrowserRouter><Routes><Route path="/legal" element={<LegalScreen />} /><Route path="*" element={<InstallPage env={env} />} /></Routes></BrowserRouter>;
  if (!ready) return <Splash />;
  if (s.mode === 'api' && !s.initialized) return <Splash />;
  if (s.mode === 'api' && s.loadError && !s.user) return <main className="pad stack"><p role="alert">{s.error}</p><button className="gb-btn" onClick={() => void s.refresh()}>Réessayer</button></main>;
  const installed = env.standalone;
  return (
    <BrowserRouter>
      {s.mode === 'api' && <AudienceConsent env={env} />}
      <RecetteBanner />
      {s.mode === 'api' && (s.loading || s.busy) && <p role="status">Chargement…</p>}
      {s.mode === 'api' && s.error && s.user && <p role="alert">{s.error}</p>}
      {s.mode === 'api' && s.otherDevices.length > 0 && <aside className="pad"><p>Vous êtes connecté sur un nouvel appareil.</p><button className="gb-btn" onClick={() => void s.logoutOtherDevices()}>Déconnecter les anciens appareils</button></aside>}
      <Routes>
        <Route path="/legal" element={<LegalScreen />} />
        {!installed ? (
          <Route path="*" element={<InstallPage env={env} />} />
        ) : (
          <>
            <Route path="/" element={<Landing />} />
            {s.user && (
              <>
                <Route path="/b/:bid" element={<BusinessShell />}>
                  <Route index element={<HomeRouter />} />
                  <Route path="bilan" element={<ReportForm />} />
                  <Route path="bilan/:reportId" element={<ReportForm />} />
                  <Route path="bilans" element={<ReportsList />} />
                  <Route path="bilans/:day" element={<DayDetail />} />
                  <Route path="equipe" element={<TeamScreen />} />
                  <Route path="stock" element={<StockScreen />} />
                  <Route path="abonnement" element={<SubscriptionScreen />} />
                  <Route path="parrainage" element={<OwnerReferralScreen />} />
                </Route>
                <Route path="/profil" element={<ProfileScreen />} />
                <Route path="/invitations" element={<InvitationsScreen />} />
                <Route path="/nouveau-business" element={<NewBusiness />} />
              </>
            )}
            <Route path="/aide" element={<HelpScreen />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </>
        )}
      </Routes>
    </BrowserRouter>
  );
}

export { store };
