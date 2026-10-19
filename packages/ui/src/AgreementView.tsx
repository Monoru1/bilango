import agreements from './legal/agreements-fr.json';

export type AgreementRole = 'agent' | 'manager' | 'influencer';
export const AGREEMENT_VERSION = agreements.version;
export const AGREEMENT_ROLE_LABEL: Record<AgreementRole, string> = { agent: 'agent de terrain', manager: 'manager', influencer: 'influenceur' };

/** Accord partenaire (annexe D, version 1.0) : partie commune + partie propre au rôle. Base de travail : relecture juridique requise. */
export function AgreementView({ role }: { role: AgreementRole }) {
  const part = (title: string, items: { title: string; text: string }[]) => (
    <section style={{ marginBottom: 20 }}>
      <h3 style={{ fontSize: 15, margin: '0 0 8px' }}>{title}</h3>
      {items.map((a) => <p key={a.title} style={{ margin: '0 0 10px', fontSize: 14, lineHeight: 1.55, color: '#374151' }}><strong>{a.title}.</strong> {a.text}</p>)}
    </section>
  );
  return (
    <div>
      {part('Partie commune (agents, managers et influenceurs)', agreements.common)}
      {part(`Accord ${AGREEMENT_ROLE_LABEL[role]}`, agreements[role])}
      <p style={{ fontSize: 12, color: 'var(--text-3)' }}>{agreements.closing}</p>
    </div>
  );
}

export const acceptanceText = (role: AgreementRole) => agreements.acceptance[role];
