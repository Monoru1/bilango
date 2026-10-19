import { LEVEL_DESCRIPTIONS, LEVEL_LABELS, canManageMember, grantableLevels, roleLabel, type PermissionLevel } from '@gobilan/domain';
import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useStore } from '../app/useStore';
import type { BizCtx } from './BusinessShell';

/** Équipe (propriétaire) : rôles personnalisables, invitations, retrait logique (§5). */
export function TeamScreen() {
  const s = useStore();
  const { business: b } = useOutletContext<BizCtx>();
  const user = s.user;
  const [roleName, setRoleName] = useState('');
  const [level, setLevel] = useState<PermissionLevel>('entry');
  const [phone, setPhone] = useState('');
  const [roleId, setRoleId] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  if (!user) return null;
  const me = s.accessOf(user.id, b.id);
  if (!me) return null;
  const roles = s.rolesOf(b.id);
  const members = s.membersOf(b.id);
  const levels = grantableLevels(me);
  const pending = s.state.invitations.filter((i) => i.businessId === b.id && i.status === 'pending');
  const report = (r: { ok: boolean; error?: string }, okText: string) => setMsg(r.ok ? { ok: true, text: okText } : { ok: false, text: r.error ?? 'Erreur' });

  return (
    <main className="pad stack" style={{ flex: 1, paddingTop: 22, paddingBottom: 24, gap: 22 }}>
      <h1 className="h1">Équipe</h1>
      {msg && <p className={msg.ok ? 'demo-note' : 'gb-error'} role="status" style={{ margin: 0 }}>{msg.text}</p>}
      <section>
        <h2 className="h2">Membres</h2>
        <ul className="list">
          {members.map((m) => {
            const a = s.accessOf(m.userId, b.id);
            const u = s.userById(m.userId);
            const removable = a && canManageMember(me, a);
            return (
              <li key={m.id}>
                <span><strong>{u?.name || 'Sans nom'}</strong><br /><span className="faint" style={{ fontSize: 13 }}>{a ? roleLabel(a) : ''}{a?.role ? ` · ${LEVEL_LABELS[a.role.level]}` : ''}</span></span>
                {removable && <button className="link" onClick={() => report(s.removeMember(b.id, m.id), 'Membre retiré. Ses bilans restent conservés avec son nom.')}>Retirer</button>}
              </li>
            );
          })}
        </ul>
        {pending.length > 0 && <p className="faint" style={{ fontSize: 13 }}>En attente : {pending.map((i) => `${i.phone} (${i.roleName})`).join(', ')}</p>}
      </section>
      <section className="stack" style={{ gap: 10 }}>
        <h2 className="h2">Inviter une personne</h2>
        <select className="gb-input" aria-label="Rôle" value={roleId} onChange={(e) => setRoleId(e.target.value)}>
          <option value="">Choisir un rôle…</option>
          {roles.filter((r) => levels.includes(r.level)).map((r) => <option key={r.id} value={r.id}>{r.name} — {LEVEL_LABELS[r.level]}</option>)}
        </select>
        <input className="gb-input" inputMode="numeric" placeholder="Numéro WhatsApp de la personne" aria-label="Numéro WhatsApp de la personne" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <button className="gb-btn" disabled={!roleId || !phone} onClick={() => { const r = s.invite(b.id, phone, roleId); report(r, 'Invitation enregistrée (statut « En attente » jusqu’à acceptation).'); if (r.ok) setPhone(''); }}>Inviter</button>
      </section>
      <section className="stack" style={{ gap: 10 }}>
        <h2 className="h2">Créer un rôle</h2>
        <input className="gb-input" placeholder="Nom du rôle (Caissier, Gérant, DG, Comptable…)" aria-label="Nom du rôle" value={roleName} onChange={(e) => setRoleName(e.target.value)} />
        <select className="gb-input" aria-label="Niveau de permission" value={level} onChange={(e) => setLevel(e.target.value as PermissionLevel)}>
          {levels.map((l) => <option key={l} value={l}>{LEVEL_LABELS[l]}</option>)}
        </select>
        <p className="faint" style={{ margin: 0, fontSize: 13 }}>{LEVEL_DESCRIPTIONS[level]}</p>
        <button className="gb-btn gb-btn--ghost" disabled={!roleName.trim()} onClick={() => { const r = s.createRole(b.id, roleName, level); report(r, 'Rôle créé.'); if (r.ok) setRoleName(''); }}>Créer le rôle</button>
      </section>
    </main>
  );
}
