import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useStore } from '../app/useStore';
import { ClosingTimeField } from '../components/ClosingTimeField';

/** Outils de démonstration (horloge simulée). Absents d'un build de production. */
export function DemoControls({ compact = false }: { compact?: boolean }) {
  const s = useStore();
  if (s.mode !== 'demo') return null;
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
  const [pushNote, setPushNote] = useState<string | null>(null);
  if (!user) return null;
  const enable = async () => {
    if (!('Notification' in window)) return setPerm('unsupported');
    const outcome = await s.enablePush();
    setPerm('Notification' in window ? Notification.permission : 'unsupported');
    setPushNote(
      outcome === 'unconfigured' ? (s.mode === 'api' ? 'Les notifications ne sont pas encore disponibles sur ce service. Réessayez plus tard.' : null)
      : outcome === 'failed' ? 'Activation impossible pour le moment. Réessayez.'
      : null,
    );
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
          {s.mode === 'demo' && <p className="demo-note" style={{ margin: 0 }}><strong>DEMO</strong> : aucune notification réelle n’est envoyée (abonnement Web Push non branché au serveur).</p>}
          {pushNote && <p className="muted" role="status" style={{ margin: 0 }}>{pushNote}</p>}
        </section>
        {owned.length > 0 && (
          <section className="stack" style={{ gap: 12 }}>
            <h2 className="h2">Heure de fermeture</h2>
            {/* Une heure PAR business (v1.2 §2), le business courant en premier. */}
            {[...owned].sort((a, b) => Number(b.id === bid) - Number(a.id === bid)).map((b) => (
              <ClosingTimeSetting key={b.id} businessId={b.id} name={b.name} initial={b.reminderTime} showName={owned.length > 1} />
            ))}
          </section>
        )}
        <DemoControls />
        <button className="gb-btn" onClick={async () => { const r = await s.logout(); if (s.mode === 'demo' || r?.ok) nav('/'); }}>Se déconnecter</button>
      </main>
    </div>
  );
}

function ClosingTimeSetting({ businessId, name, initial, showName }: { businessId: string; name: string; initial: string; showName: boolean }) {
  const s = useStore();
  const [time, setTime] = useState(initial);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <div className="stack" style={{ gap: 8 }}>
      <ClosingTimeField value={time} onChange={(v) => { setTime(v); setStatus(null); }} label={showName ? `Heure de fermeture — ${name}` : 'Heure de fermeture'} />
      <button
        className="gb-btn gb-btn--ghost"
        onClick={async () => {
          const r = await s.setReminder(businessId, time);
          setStatus(r.ok ? { ok: true, text: `Heure de fermeture réglée à ${time}.` } : { ok: false, text: r.error });
        }}
      >
        Enregistrer l’heure
      </button>
      {status && <span className={status.ok ? 'muted' : 'gb-error'} role="status" style={{ fontSize: 14 }}>{status.text}</span>}
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
            <div className="row"><button className="gb-btn gb-btn--ghost" style={{ minHeight: 48 }} onClick={() => s.respondInvitation(i.id, false)}>Refuser</button><button className="gb-btn" style={{ minHeight: 48 }} onClick={async () => { const r = await s.respondInvitation(i.id, true); if (!r.ok) setErr(r.error); else nav(`/b/${i.businessId}`); }}>Accepter</button></div>
          </section>
        ))}
        {err && <p className="gb-error">{err}</p>}
      </main>
    </div>
  );
}
