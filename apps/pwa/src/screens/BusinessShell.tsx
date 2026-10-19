import { COUNTRIES, can, canViewOwnerDashboard, subscriptionPopup, subscriptionStatus, formatFcfa, totalsOfDay, type Business } from '@gobilan/domain';
import { useEffect, useState } from 'react';
import { Link, Navigate, Outlet, useNavigate, useParams } from 'react-router-dom';
import { useStore } from '../app/useStore';
import { BottomNav } from '../components/BottomNav';
import { Header } from '../components/Header';
import { Dialog } from '../components/Popup';
import { DemoControls } from './Settings';

/** Contexte passé aux écrans enfants. */
export interface BizCtx {
  business: Business;
  base: string;
  isOwner: boolean;
}

export function BusinessShell() {
  const s = useStore();
  const { bid = '' } = useParams();
  const nav = useNavigate();
  const [menu, setMenu] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const user = s.user;
  const business = s.business(bid);
  const access = user && business ? s.accessOf(user.id, bid) : null;

  // Pop-up à chaque ouverture de l'application (§8.3) : on réarme quand on change de business.
  useEffect(() => setDismissed(false), [bid]);

  if (!user || !business || !access) return <Navigate to="/" replace />;
  const base = `/b/${bid}`;
  const owner = access.isOwner;
  const sub = s.subOf(bid);
  const now = s.now();
  const status = subscriptionStatus(sub, now);
  const popup = owner ? subscriptionPopup(sub, now) : { kind: 'none' as const };
  const blockedOwner = owner && !canViewOwnerDashboard(status);

  return (
    <div className="screen">
      <Header title={business.name} userName={user.name || '?'} left="menu" onMenu={() => setMenu(true)} onAvatar={() => nav('/profil')} />
      <div className="demo-banner gb-demo-banner">MODE DEMO — données simulées</div>
      {blockedOwner ? <BlockedOwner base={base} /> : <Outlet context={{ business, base, isOwner: owner } satisfies BizCtx} />}
      {!blockedOwner && <BottomNav base={base} variant={owner ? 'owner' : 'manager'} />}
      {menu && <Drawer onClose={() => setMenu(false)} bid={bid} />}
      {popup.kind !== 'none' && !dismissed && !blockedOwner && (
        <Dialog label="Abonnement" onClose={popup.dismissible ? () => setDismissed(true) : undefined}>
          <p className="h2" style={{ lineHeight: 1.35 }}>{popup.message}</p>
          <div className="btns">
            <button className="gb-btn gb-btn--ghost" onClick={() => setDismissed(true)}>OK</button>
            <button className="gb-btn" onClick={() => { setDismissed(true); nav(`${base}/abonnement`); }}>Renouveler</button>
          </div>
        </Dialog>
      )}
    </div>
  );
}

/** À partir du 4e jour : OK disparaît, seul « Renouveler » reste, tableau de bord masqué (§8.3). */
function BlockedOwner({ base }: { base: string }) {
  return (
    <main className="pad stack" style={{ flex: 1, justifyContent: 'center', gap: 18 }}>
      <h1 className="h1">Votre abonnement a expiré</h1>
      <p className="muted" style={{ margin: 0 }}>Vos données sont conservées. Renouvelez pour retrouver votre tableau de bord ; tout se réactive dès le paiement.</p>
      <Link className="gb-btn" to={`${base}/abonnement`} style={{ textDecoration: 'none' }}>Renouveler</Link>
    </main>
  );
}

function Drawer({ onClose, bid }: { onClose: () => void; bid: string }) {
  const s = useStore();
  const nav = useNavigate();
  const user = s.user;
  if (!user) return null;
  const list = s.businessesOfUser(user.id);
  const go = (to: string) => {
    onClose();
    nav(to);
  };
  const access = s.accessOf(user.id, bid);
  const sub = s.subOf(bid);
  const left = Math.max(0, Math.ceil((Date.parse(sub.paidUntil ?? sub.trialEndsAt ?? '1970-01-01T00:00:00Z') - s.now()) / 86_400_000));
  return (
    <>
      <div className="drawer-bg" onClick={onClose} role="presentation" />
      <aside className="drawer" aria-label="Menu">
        <div className="row" style={{ padding: '20px 20px 12px' }}>
          <strong>Mes business</strong>
          <button className="iconbtn" onClick={onClose} aria-label="Fermer le menu">✕</button>
        </div>
        {list.map((b) => {
          const a = s.accessOf(user.id, b.id);
          const t = a && can(a, 'viewDashboard') ? totalsOfDay(s.reportsOf(b.id), b.id, s.todayOf(b)).revenue : null;
          return (
            <button key={b.id} className="bizitem" aria-current={b.id === bid} onClick={() => go(`/b/${b.id}`)}>
              <span style={{ fontWeight: b.id === bid ? 700 : 500 }}>{b.name}</span>
              {t !== null && <span className="muted">{formatFcfa(t)}</span>}
            </button>
          );
        })}
        <div className="stack" style={{ padding: 20, gap: 10 }}>
          {access && can(access, 'submitReport') && <button className="gb-btn gb-btn--ghost" style={{ minHeight: 48 }} onClick={() => go(`/b/${bid}/bilan`)}>Faire le bilan du jour</button>}
          <button className="gb-btn gb-btn--ghost" style={{ minHeight: 48 }} onClick={() => go('/nouveau-business')}>+ Ajouter un business</button>
          {access?.isOwner && <button className="gb-btn gb-btn--ghost" style={{ minHeight: 48 }} onClick={() => go(`/b/${bid}/abonnement`)}>Abonnement · {left} jour{left > 1 ? 's' : ''} restant{left > 1 ? 's' : ''}</button>}
          {access && can(access, 'viewStock') && s.business(bid)?.stockEnabled && <button className="gb-btn gb-btn--ghost" style={{ minHeight: 48 }} onClick={() => go(`/b/${bid}/stock`)}>Stock</button>}
          <button className="gb-btn gb-btn--ghost" style={{ minHeight: 48 }} onClick={() => go('/aide')}>Aide</button>
        </div>
        <div style={{ marginTop: 'auto', padding: 20 }}>
          <button className="link" onClick={() => go('/legal')}>Mentions légales & Politiques de confidentialité</button>
          <div className="faint" style={{ fontSize: 12 }}>{COUNTRIES[user.country].name} · GoBilan (DEMO)</div>
        </div>
        <DemoControls compact />
      </aside>
    </>
  );
}
