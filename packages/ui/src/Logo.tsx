/**
 * Logo GoBilan (annexe C) : icône carrée aux coins arrondis, fond vert, loupe blanche autour de
 * trois barres vert foncé, manche à droite. Reconstruction vectorielle de l'icône 256 px fournie
 * par le client ; à remplacer par le fichier source HD du client dès réception (docs/BRANDING.md).
 */
export function Logo({ size = 32, title = 'GoBilan' }: { size?: number; title?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 256 256" role="img" aria-label={title}>
      <rect width="256" height="256" rx="56" fill="#25D366" />
      <circle cx="123" cy="107" r="52" fill="none" stroke="#fff" strokeWidth="13" />
      <line x1="163" y1="147" x2="212" y2="198" stroke="#fff" strokeWidth="14" strokeLinecap="round" />
      <rect x="63" y="152" width="21" height="50" fill="#085041" />
      <rect x="94" y="124" width="22" height="78" fill="#085041" />
      <rect x="125" y="94" width="22" height="108" fill="#085041" />
    </svg>
  );
}
