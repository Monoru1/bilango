import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useStore } from '../app/useStore';

/** Outils de démonstration (horloge simulée). Absents d'un build de production. */
export function DemoControls({ compact = false }: { compact?: boolean }) {
  const s = useStore();
  return (
    <div className="demo-note" style={{ margin: compact ? 16 : 0 }}>
      <strong>DEMO</strong> — horloge simulée : <strong>+{s.state.clockOffsetDays} j</strong>
      <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
        <button className="link" onClick={() => s.advanceDemoClock(1)}>+1 j</button>
        <button className="link" onClick={() => s.advanceDemoClock(3)}>+3 j</button>
        <button className="link" onClick={() => s.advanceDemoClock(25)}>+25 j</button>
        <button className="link" onClick={() => s.reset()}>Réinitialiser</button>
      </div>
    </div>
  );
}

/** Profil : notifications (permission demandée sur action, jamais à l'arrivée, §9.3), rappel, déconnexion. */
export function ProfileScreen() {
  const s = useStore();
  const nav = useNavigate();
  const { bid } = useParams();
  const user = s.user;
  const [perm, setPerm] = useState<string>(() => ('Notification' in window ? Notification.permission : 'unsupported'));
  const owned = user ? s.businessesOfUser(user.id).filter((b) => b.ownerId === user.id) : [];
  const [time, setTime] = useState(owned[0]?.reminderTime ?? '20:00');
  const [saved, setSaved] = useState(false);
  if (!user) return null;
  const enable = async () => {
    if (!('Notification' in window)) return setPerm('unsupported');
    setPerm(await Notification.requestPermission());
  };
  return (
    <div className="screen">
      <main className="pad stack" style={{ paddingTop: 16, paddingBottom: 32, gap: 20 }}>
        <button className="link" style={{ alignSelf: 'flex-start' }} onClick={() => nav(-1)}>← Retour</button>
        <h1 className="h1">{user.name || 'Mon profil'}</h1>
        <p className="muted" style={{ margin: 0 }}>{user.phone}</p>
        <section className="stack" style={{ gap: 8 }}>
          <h2 className="h2">Notifications</h2>
          {perm === 'granted' ? <p className="muted" style={{ margin: 0 }}>Notifications activées.</p> : perm === 'denied' ? <p className="muted" style={{ margin: 0 }}>Notifications refusées dans les réglages du téléphone.</p> : perm === 'unsupported' ? <p className="muted" style={{ margin: 0 }}>Ce téléphone ne prend pas en charge les notifications (iPhone : iOS 16.4 minimum, application installée).</p> : <button className="gb-btn gb-btn--ghost" onClick={() => void enable()}>Activer les notifications</button>}
          <p className="demo-note" style={{ margin: 0 }}><strong>DEMO</strong> : aucune notification réelle n’est envoyée (abonnement Web Push non branché au serveur).</p>
        </section>
        {owned[0] && (
          <section className="stack" style={{ gap: 8 }}>
            <h2 className="h2">Rappel de bilan</h2>
            <input className="gb-input" type="time" value={time} onChange={(e) => { setTime(e.target.value); setSaved(false); }} aria-label="Heure du rappel" />
            <button className="gb-btn gb-btn--ghost" onClick={() => setSaved(s.setReminder(owned[0]?.id ?? bid ?? '', time).ok)}>Enregistrer l’heure</button>
            {saved && <span className="muted" style={{ fontSize: 14 }}>Rappel réglé à {time}.</span>}
          </section>
        )}
        <DemoControls />
        <button className="gb-btn" onClick={() => { s.logout(); nav('/'); }}>Se déconnecter</button>
      </main>
    </div>
  );
}

/** « Rejoindre un business » : invitations en attente (§4.1 écran 6, §4.5). */
export function InvitationsScreen() {
  const s = useStore();
  const nav = useNavigate();
  const user = s.user;
  const [err, setErr] = useState<string | null>(null);
  if (!user) return null;
  const list = s.invitationsFor(user.id);
  return (
    <div className="screen">
      <main className="pad stack" style={{ paddingTop: 16, gap: 18 }}>
        <button className="link" style={{ alignSelf: 'flex-start' }} onClick={() => nav('/')}>← Retour</button>
        <h1 className="h1">Invitations</h1>
        {list.length === 0 ? <p className="muted">Aucune invitation pour le moment. Votre patron doit vous ajouter depuis son tableau de bord.</p> : list.map((i) => (
          <section key={i.id} className="stack" style={{ gap: 8, border: '1px solid var(--sep)', borderRadius: 16, padding: 18 }}>
            <strong>{i.businessName}</strong>
            <span className="muted">Rôle proposé : {i.roleName}</span>
            <div className="row"><button className="gb-btn gb-btn--ghost" style={{ minHeight: 48 }} onClick={() => s.respondInvitation(i.id, false)}>Refuser</button><button className="gb-btn" style={{ minHeight: 48 }} onClick={() => { const r = s.respondInvitation(i.id, true); if (!r.ok) setErr(r.error); else nav(`/b/${i.businessId}`); }}>Accepter</button></div>
          </section>
        ))}
        {err && <p className="gb-error">{err}</p>}
      </main>
    </div>
  );
}
