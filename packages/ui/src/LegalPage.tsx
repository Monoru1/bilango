import data from './legal/legal-fr.json';

export const LEGAL_UPDATED = '19 octobre 2026';

type Block = { t: 'h'; text: string } | { t: 'p'; text: string } | { t: 'ul' | 'ol'; items: string[] };

/**
 * Page légale unique (CDC §12, annexe A) : texte intégral, corrections de §12 déjà incluses dans
 * l'annexe. À FAIRE RELIRE par un juriste au Bénin avant lancement (renonciation à poursuites,
 * clause de réquisition judiciaire).
 */
export function LegalPage() {
  const blocks = data as Block[];
  return (
    <article style={{ padding: '24px 20px 48px', lineHeight: 1.55, color: 'var(--text)' }}>
      <h1 style={{ fontSize: 22, margin: '0 0 4px' }}>Mentions légales & Politiques de confidentialité</h1>
      <p style={{ color: 'var(--text-3)', margin: '0 0 24px', fontSize: 13 }}>Dernière mise à jour : {LEGAL_UPDATED}</p>
      {blocks.map((b, i) => {
        if (b.t === 'h') {
          const major = b.text.startsWith('Section');
          return major ? (
            <h2 key={i} style={{ fontSize: 18, margin: '36px 0 12px', borderTop: '1px solid var(--sep)', paddingTop: 24 }}>{b.text}</h2>
          ) : (
            <h3 key={i} style={{ fontSize: 14, margin: '24px 0 8px', letterSpacing: 0.3 }}>{b.text}</h3>
          );
        }
        if (b.t === 'p') return <p key={i} style={{ margin: '0 0 12px', fontSize: 14, color: '#374151' }}>{b.text}</p>;
        const L = b.t === 'ol' ? 'ol' : 'ul';
        return (
          <L key={i} style={{ margin: '0 0 12px', paddingLeft: 20, fontSize: 14, color: '#374151' }}>
            {b.items.map((it, j) => <li key={j} style={{ marginBottom: 6 }}>{it}</li>)}
          </L>
        );
      })}
    </article>
  );
}
