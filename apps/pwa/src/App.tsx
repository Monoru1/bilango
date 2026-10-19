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

/**
 * Contournement de la page d'installation, réservé à la DÉMO : `?demo=1` (mémorisé pour l'onglet).
 * Désactivé en construisant avec VITE_ALLOW_DEMO_BYPASS=0. La page d'installation reste une règle
 * d'affichage ; la vraie protection est côté serveur (CDC §3, §13).
 */
function demoBypass(): boolean {
  if (import.meta.env.VITE_ALLOW_DEMO_BYPASS === '0') return false;
  try {
    if (new URLSearchParams(window.location.search).get('demo') === '1') sessionStorage.setItem('gb-demo', '1');
    return sessionStorage.getItem('gb-demo') === '1';
  } catch {
    return new URLSearchParams(window.location.search).get('demo') === '1';
  }
}

function Splash() {
  return <div className="screen center" style={{ justifyContent: 'center', minHeight: '100dvh' }}><div className="splash"><Logo size={88} /></div></div>;
}

function Landing() {
  const s = useStore();
  const nav = useNavigate();
  const u = s.user;
  if (!u) return <AuthGate />;
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

function AuthGate() {
  const [onboarding, setOnboarding] = useState(false);
  return onboarding ? <Onboarding onCancel={() => setOnboarding(false)} /> : <Welcome onStart={() => setOnboarding(true)} />;
}

export function App() {
  const env = useMemo(currentEnv, []);
  const bypass = useMemo(demoBypass, []);
  const [ready, setReady] = useState(false);
  const s = useStore();
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 500); // chargement < 2 s, animation minimale (§11.6)
    // Ouverture de l'application : le badge rouge s'efface (§9.2).
    (navigator as Navigator & { clearAppBadge?: () => Promise<void> }).clearAppBadge?.().catch(() => undefined);
    return () => clearTimeout(t);
  }, []);
  if (!ready) return <Splash />;
  const installed = env.standalone || bypass;
  return (
    <BrowserRouter>
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
